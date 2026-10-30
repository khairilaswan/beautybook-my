// Finds beauty businesses in Klang Valley with Google Places API (New) Text
// Search and queues their place IDs for data entry staff.
//
// Google's terms allow storing place IDs indefinitely but not other Places
// content, so this asks Google for IDs only (the cheapest request type) and
// stores nothing else. Staff then collect details from each shop's own
// Instagram, Facebook or website.
//
// Usage:
//   node --env-file=.env.local scripts/discover-places.ts --dry-run
//   node --env-file=.env.local scripts/discover-places.ts --terms "barbershop,nail salon" --cell 0.04
//
// Text Search returns at most 60 results per query, so the area is split into
// a grid and every term is searched in every cell.

const KLANG_VALLEY = { south: 2.85, west: 101.4, north: 3.35, east: 101.8 };
const DEFAULT_TERMS = [
  "barbershop",
  "hair salon",
  "beauty salon facial",
  "nail salon",
  "eyelash extension",
  "mak andam bridal makeup",
  "spa massage",
  "waxing threading",
];

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : undefined;
}
const dryRun = process.argv.includes("--dry-run");
const terms = arg("terms")?.split(",").map((t) => t.trim()).filter(Boolean) ?? DEFAULT_TERMS;
const cellSize = Number(arg("cell") ?? 0.04);

const apiKey = process.env.GOOGLE_PLACES_API_KEY;
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const secretKey = process.env.SUPABASE_SECRET_KEY;
if (!dryRun && (!apiKey || !supabaseUrl || !secretKey)) {
  console.error("Set GOOGLE_PLACES_API_KEY, NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SECRET_KEY (see .env.example).");
  process.exit(1);
}

type Cell = { name: string; low: { latitude: number; longitude: number }; high: { latitude: number; longitude: number } };

function grid(): Cell[] {
  const cells: Cell[] = [];
  for (let lat = KLANG_VALLEY.south; lat < KLANG_VALLEY.north; lat += cellSize) {
    for (let lng = KLANG_VALLEY.west; lng < KLANG_VALLEY.east; lng += cellSize) {
      cells.push({
        name: `${lat.toFixed(3)},${lng.toFixed(3)}`,
        low: { latitude: lat, longitude: lng },
        high: { latitude: Math.min(lat + cellSize, KLANG_VALLEY.north), longitude: Math.min(lng + cellSize, KLANG_VALLEY.east) },
      });
    }
  }
  return cells;
}

async function searchCell(term: string, cell: Cell): Promise<string[]> {
  const ids: string[] = [];
  let pageToken: string | undefined;
  for (let page = 0; page < 3; page++) {
    const res = await fetch("https://places.googleapis.com/v1/places:searchText", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": apiKey!,
        // IDs only: the cheapest field mask, and the only field we may keep.
        "X-Goog-FieldMask": "places.id,nextPageToken",
      },
      body: JSON.stringify({
        textQuery: term,
        pageSize: 20,
        pageToken,
        regionCode: "MY",
        locationRestriction: { rectangle: { low: cell.low, high: cell.high } },
      }),
    });
    if (res.status === 429) {
      await new Promise((r) => setTimeout(r, 5000));
      page--;
      continue;
    }
    if (!res.ok) throw new Error(`Places API ${res.status}: ${await res.text()}`);
    const data = (await res.json()) as { places?: { id: string }[]; nextPageToken?: string };
    ids.push(...(data.places ?? []).map((p) => p.id));
    pageToken = data.nextPageToken;
    if (!pageToken) break;
  }
  return ids;
}

async function queue(rows: { google_place_id: string; search_term: string; cell: string }[]) {
  if (rows.length === 0) return;
  const res = await fetch(`${supabaseUrl}/rest/v1/discovery_queue?on_conflict=google_place_id`, {
    method: "POST",
    headers: {
      apikey: secretKey!,
      Authorization: `Bearer ${secretKey}`,
      "Content-Type": "application/json",
      Prefer: "resolution=ignore-duplicates,return=minimal",
    },
    body: JSON.stringify(rows),
  });
  if (!res.ok) throw new Error(`Supabase ${res.status}: ${await res.text()}`);
}

const cells = grid();
console.log(`${terms.length} terms × ${cells.length} cells = up to ${terms.length * cells.length * 3} requests`);
if (dryRun) process.exit(0);

let found = 0;
for (const term of terms) {
  for (const cell of cells) {
    const ids = await searchCell(term, cell);
    await queue(ids.map((id) => ({ google_place_id: id, search_term: term, cell: cell.name })));
    found += ids.length;
    process.stdout.write(`\r${term} · ${cell.name} · ${found} place IDs so far   `);
  }
}
console.log(`\nDone. ${found} results queued (duplicates ignored).`);
export {};
