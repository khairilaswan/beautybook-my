"use client";

import Papa from "papaparse";
import { readSheet } from "read-excel-file/universal";
import { useState, useTransition } from "react";
import { commitImport, type PreviewRow, previewImport, undoImport } from "@/app/admin/actions";
import { IMPORT_COLUMNS, IMPORT_EXAMPLE, MAX_IMPORT_ROWS } from "@/lib/import";

type Rows = Record<string, string>[];

function stringify(rows: Record<string, unknown>[]): Rows {
  return rows.map((r) =>
    Object.fromEntries(
      Object.entries(r)
        .filter(([k]) => k)
        .map(([k, v]) => [k.trim().toLowerCase(), v === null || v === undefined ? "" : String(v)]),
    ),
  );
}

async function readFile(file: File): Promise<Rows> {
  const name = file.name.toLowerCase();
  if (name.endsWith(".json")) {
    const data = JSON.parse(await file.text());
    if (!Array.isArray(data)) throw new Error("The JSON file must be a list of objects.");
    return stringify(data);
  }
  if (name.endsWith(".xlsx")) {
    const sheet = await readSheet(file);
    const [header, ...body] = sheet;
    const keys = header.map((h) => String(h ?? ""));
    return stringify(body.map((r) => Object.fromEntries(keys.map((k, i) => [k, r[i]]))));
  }
  const parsed = Papa.parse<Record<string, string>>(await file.text(), { header: true, skipEmptyLines: "greedy" });
  return stringify(parsed.data);
}

function downloadTemplate() {
  const csv = Papa.unparse({ fields: [...IMPORT_COLUMNS], data: [IMPORT_COLUMNS.map((c) => IMPORT_EXAMPLE[c])] });
  const url = URL.createObjectURL(new Blob([`﻿${csv}`], { type: "text/csv" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = "beautybook-import-template.csv";
  a.click();
  URL.revokeObjectURL(url);
}

export function ImportTool() {
  const [file, setFile] = useState<{ name: string; rows: Rows } | null>(null);
  const [preview, setPreview] = useState<PreviewRow[] | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const counts = preview?.reduce(
    (acc, r) => ({ ...acc, [r.action]: (acc[r.action] ?? 0) + 1 }),
    {} as Record<string, number>,
  );

  return (
    <div className="space-y-4 rounded-2xl border border-line bg-white p-5 text-sm">
      <div className="flex flex-wrap items-center gap-3">
        <label className="cursor-pointer rounded-full bg-ink px-4 py-2 font-medium text-white">
          Choose file
          <input
            type="file"
            accept=".csv,.xlsx,.json"
            className="sr-only"
            onChange={(e) => {
              const f = e.target.files?.[0];
              e.target.value = "";
              if (!f) return;
              setPreview(null);
              setMessage(null);
              start(async () => {
                try {
                  const rows = await readFile(f);
                  if (rows.length > MAX_IMPORT_ROWS) {
                    setMessage(`This file has ${rows.length} rows. Split it into files of ${MAX_IMPORT_ROWS} or fewer.`);
                    return;
                  }
                  setFile({ name: f.name, rows });
                  const result = await previewImport(rows);
                  if (result.error) setMessage(result.error);
                  else setPreview(result.preview ?? []);
                } catch (err) {
                  setMessage(err instanceof Error ? err.message : "Could not read the file.");
                }
              });
            }}
          />
        </label>
        <button type="button" onClick={downloadTemplate} className="underline">Download template</button>
        {pending && <span className="text-muted">Working…</span>}
      </div>
      {message && <p role="alert" className="rounded-xl bg-brand-50 p-3">{message}</p>}
      {preview && file && (
        <>
          <p>
            <strong>{file.name}</strong>: {counts?.create ?? 0} new, {counts?.update ?? 0} updates, {counts?.error ?? 0} rows with
            errors (skipped).
          </p>
          <div className="max-h-96 overflow-auto rounded-xl border border-line">
            <table className="w-full">
              <thead className="sticky top-0 bg-canvas text-left text-muted">
                <tr><th className="p-2">Line</th><th className="p-2">Name</th><th className="p-2">Action</th><th className="p-2">Notes</th></tr>
              </thead>
              <tbody>
                {preview.map((r) => (
                  <tr key={r.line} className="border-t border-line align-top">
                    <td className="p-2">{r.line}</td>
                    <td className="p-2">{r.name}</td>
                    <td className={`p-2 ${r.action === "error" ? "text-brand-700" : ""}`}>
                      {r.action}{r.matchSlug ? ` ${r.matchSlug}` : ""}
                    </td>
                    <td className="p-2">
                      {[...r.errors, ...r.warnings].map((n) => <span key={n} className="block">{n}</span>)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <button
            type="button"
            disabled={pending || !(counts?.create || counts?.update)}
            className="rounded-full bg-brand-600 px-5 py-2 font-medium text-white disabled:opacity-50"
            onClick={() =>
              start(async () => {
                const result = await commitImport(file.name, file.rows);
                if (result.error) {
                  setMessage(result.error);
                  return;
                }
                const c = result.counts!;
                setMessage(`Import saved: ${c.created} created, ${c.updated} updated, ${c.skipped} skipped, ${c.failed} failed.`);
                setPreview(null);
                setFile(null);
              })
            }
          >
            Save import
          </button>
        </>
      )}
    </div>
  );
}

export function UndoButton({ batchId }: { batchId: number }) {
  const [pending, start] = useTransition();
  const [done, setDone] = useState<string | null>(null);
  if (done) return <span className="text-muted">{done}</span>;
  return (
    <button
      disabled={pending}
      className="rounded-full border border-line px-3 py-1 disabled:opacity-50"
      onClick={() => {
        if (!window.confirm("Undo this import? Listings it created are archived and updated listings get their old values back.")) return;
        start(async () => {
          const r = await undoImport(batchId);
          setDone(r.error ?? r.message ?? "Done");
        });
      }}
    >
      Undo
    </button>
  );
}
