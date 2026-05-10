import fs from "node:fs";
import path from "node:path";
import matter from "gray-matter";

export interface LogPost {
  slug: string;
  date: string;
  project: string;
  title: string;
  body: string;
  /** original date the work was actually done (not the surface date) */
  originalDate?: string;
}

const LOG_DIR = path.join(process.cwd(), "content", "log");

export function getAllPosts(): LogPost[] {
  if (!fs.existsSync(LOG_DIR)) return [];
  const files = fs
    .readdirSync(LOG_DIR)
    .filter((f) => f.endsWith(".md"));

  const posts = files.map((file) => {
    const raw = fs.readFileSync(path.join(LOG_DIR, file), "utf-8");
    const { data, content } = matter(raw);
    const slug = (data.slug as string) ?? file.replace(/\.md$/, "");
    return {
      slug,
      date: String(data.date ?? ""),
      project: String(data.project ?? "Klar"),
      title: String(data.title ?? slug),
      body: content.trim(),
      originalDate: data.originalDate ? String(data.originalDate) : undefined,
    } satisfies LogPost;
  });

  return posts.sort((a, b) => b.date.localeCompare(a.date));
}

export function getPostBySlug(slug: string): LogPost | null {
  const all = getAllPosts();
  return all.find((p) => p.slug === slug) ?? null;
}

/**
 * Tiny markdown renderer for the lakonic body content.
 * Supports paragraphs (blank-line separated), `code spans`, **bold**, *italic*,
 * and [links](url). No headings (the title above is the heading).
 */
export function renderInline(text: string): React.ReactNode[] {
  const out: React.ReactNode[] = [];
  let rest = text;
  let key = 0;
  const patterns: Array<[RegExp, (m: RegExpMatchArray) => React.ReactNode]> = [
    [
      /\[([^\]]+)\]\(([^)]+)\)/,
      (m) => (
        <a
          key={key++}
          href={m[2]}
          target="_blank"
          rel="noopener noreferrer"
          className="underline decoration-dotted underline-offset-4 hover:text-[var(--fg)]"
        >
          {m[1]}
        </a>
      ),
    ],
    [/\*\*([^*]+)\*\*/, (m) => <strong key={key++}>{m[1]}</strong>],
    [/`([^`]+)`/, (m) => <code key={key++} className="font-mono text-[0.9em]">{m[1]}</code>],
    [/\*([^*]+)\*/, (m) => <em key={key++}>{m[1]}</em>],
  ];

  while (rest.length) {
    let earliest: { idx: number; len: number; node: React.ReactNode } | null = null;
    for (const [re, render] of patterns) {
      const m = rest.match(re);
      if (m && m.index !== undefined) {
        if (earliest === null || m.index < earliest.idx) {
          earliest = { idx: m.index, len: m[0].length, node: render(m) };
        }
      }
    }
    if (!earliest) {
      out.push(rest);
      break;
    }
    if (earliest.idx > 0) out.push(rest.slice(0, earliest.idx));
    out.push(earliest.node);
    rest = rest.slice(earliest.idx + earliest.len);
  }
  return out;
}
