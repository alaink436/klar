/**
 * NowFeed — fetches the README.md from alaink436/now and renders it.
 * Minimal markdown parsing: # headers + - bullets + plain paragraphs.
 * Revalidates every 30 minutes via Next.js fetch cache.
 */

const NOW_RAW =
  "https://raw.githubusercontent.com/alaink436/now/master/README.md";
const NOW_REPO = "https://github.com/alaink436/now";

async function fetchNow(): Promise<string | null> {
  try {
    const res = await fetch(NOW_RAW, { next: { revalidate: 1800 } });
    if (!res.ok) return null;
    return await res.text();
  } catch {
    return null;
  }
}

interface Block {
  type: "h1" | "h2" | "p" | "ul" | "blockquote" | "hr";
  text?: string;
  items?: string[];
}

function parse(md: string): Block[] {
  const lines = md.split("\n");
  const out: Block[] = [];
  let i = 0;
  while (i < lines.length) {
    const line = lines[i].trimEnd();
    if (!line) {
      i++;
      continue;
    }
    if (line.startsWith("# ")) {
      out.push({ type: "h1", text: line.slice(2) });
      i++;
    } else if (line.startsWith("## ")) {
      out.push({ type: "h2", text: line.slice(3) });
      i++;
    } else if (line.startsWith("---")) {
      out.push({ type: "hr" });
      i++;
    } else if (line.startsWith("> ")) {
      out.push({ type: "blockquote", text: line.slice(2) });
      i++;
    } else if (line.startsWith("- ")) {
      const items: string[] = [];
      while (i < lines.length && lines[i].trimStart().startsWith("- ")) {
        items.push(lines[i].trimStart().slice(2));
        i++;
      }
      out.push({ type: "ul", items });
    } else {
      out.push({ type: "p", text: line });
      i++;
    }
  }
  return out;
}

// Inline markdown: bold, italic, links, code
function inline(text: string): React.ReactNode[] {
  const out: React.ReactNode[] = [];
  let rest = text;
  let key = 0;

  // crude pattern matcher: **bold**, *italic*, `code`, [text](url)
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
    [/`([^`]+)`/, (m) => <code key={key++} className="font-mono">{m[1]}</code>],
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

export default async function NowFeed() {
  const md = await fetchNow();

  if (!md) {
    return (
      <div className="brut-line p-6">
        <p className="label mb-2">— offline —</p>
        <p className="t-body-lg text-[var(--fg-2)]">
          Couldn&apos;t fetch the live status. See{" "}
          <a
            href={NOW_REPO}
            target="_blank"
            rel="noopener noreferrer"
            className="underline decoration-dotted underline-offset-4"
          >
            the now repo on GitHub ↗
          </a>
          .
        </p>
      </div>
    );
  }

  const blocks = parse(md);

  return (
    <div className="brut-line bg-[var(--bg)]/85 backdrop-blur-sm">
      <div className="flex items-center justify-between px-5 sm:px-6 py-3 border-b border-[var(--line)]">
        <p className="label-fg">live · auto-fetched from /now</p>
        <a
          href={NOW_REPO}
          target="_blank"
          rel="noopener noreferrer"
          className="label hover:text-[var(--fg)] transition"
        >
          edit on github ↗
        </a>
      </div>
      <div className="px-5 sm:px-6 py-5 sm:py-6">
        {blocks.map((b, idx) => {
          switch (b.type) {
            case "h1":
              // skip — title is implicit
              return null;
            case "h2":
              return (
                <h4
                  key={idx}
                  className="display text-xl sm:text-2xl mt-5 first:mt-0 mb-3"
                >
                  {b.text?.toLowerCase()}
                </h4>
              );
            case "ul":
              return (
                <ul key={idx} className="space-y-1.5 mb-4">
                  {b.items?.map((it, j) => (
                    <li
                      key={j}
                      className="text-[var(--fg-2)] text-sm sm:text-base flex gap-2"
                    >
                      <span className="text-[var(--fg-3)] shrink-0">·</span>
                      <span>{inline(it)}</span>
                    </li>
                  ))}
                </ul>
              );
            case "blockquote":
              return (
                <p
                  key={idx}
                  className="label italic mt-4 mb-2 border-l-2 border-[var(--line)] pl-3"
                >
                  {inline(b.text || "")}
                </p>
              );
            case "hr":
              return (
                <hr
                  key={idx}
                  className="border-t border-[var(--line)] my-4"
                />
              );
            case "p":
              return (
                <p
                  key={idx}
                  className="text-[var(--fg-2)] text-sm sm:text-base mb-3"
                >
                  {inline(b.text || "")}
                </p>
              );
            default:
              return null;
          }
        })}
      </div>
    </div>
  );
}
