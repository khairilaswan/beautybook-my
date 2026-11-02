import Link from "next/link";
import type { ReactNode } from "react";

// A small, safe Markdown subset for guides: ## and ### headings, paragraphs,
// - and 1. lists, **bold**, *italic* and [links](/path). Builds React
// elements, never raw HTML, so editors can't inject scripts.

function inline(text: string, key: string): ReactNode[] {
  const out: ReactNode[] = [];
  const re = /\*\*(.+?)\*\*|\*(.+?)\*|\[([^\]]+)\]\(([^)\s]+)\)/g;
  let last = 0;
  let m: RegExpExecArray | null;
  let i = 0;
  while ((m = re.exec(text))) {
    if (m.index > last) out.push(text.slice(last, m.index));
    const k = `${key}-${i++}`;
    if (m[1]) out.push(<strong key={k}>{m[1]}</strong>);
    else if (m[2]) out.push(<em key={k}>{m[2]}</em>);
    else if (m[3] && m[4]) {
      const href = m[4];
      if (href.startsWith("/")) {
        out.push(<Link key={k} href={href} className="underline">{m[3]}</Link>);
      } else if (/^https:\/\//.test(href)) {
        out.push(<a key={k} href={href} rel="noopener noreferrer nofollow" target="_blank" className="underline">{m[3]}</a>);
      } else {
        out.push(m[3]);
      }
    }
    last = re.lastIndex;
  }
  if (last < text.length) out.push(text.slice(last));
  return out;
}

export function Markdown({ source }: { source: string }) {
  const blocks = source.replace(/\r\n/g, "\n").split(/\n{2,}/);
  return (
    <div className="space-y-4 leading-relaxed">
      {blocks.map((block, b) => {
        const lines = block.split("\n").filter((l) => l.trim());
        if (!lines.length) return null;
        const key = `b${b}`;
        if (lines[0].startsWith("### ")) return <h3 key={key} className="pt-2 text-lg font-semibold">{inline(lines[0].slice(4), key)}</h3>;
        if (lines[0].startsWith("## ")) return <h2 key={key} className="pt-4 text-xl font-semibold">{inline(lines[0].slice(3), key)}</h2>;
        if (lines.every((l) => /^[-*] /.test(l))) {
          return (
            <ul key={key} className="list-disc space-y-1 pl-5">
              {lines.map((l, i) => <li key={i}>{inline(l.slice(2), `${key}-${i}`)}</li>)}
            </ul>
          );
        }
        if (lines.every((l) => /^\d+\. /.test(l))) {
          return (
            <ol key={key} className="list-decimal space-y-1 pl-5">
              {lines.map((l, i) => <li key={i}>{inline(l.replace(/^\d+\. /, ""), `${key}-${i}`)}</li>)}
            </ol>
          );
        }
        return <p key={key}>{inline(lines.join(" "), key)}</p>;
      })}
    </div>
  );
}
