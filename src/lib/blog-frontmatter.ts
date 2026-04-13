export interface Frontmatter {
  title: string;
  subtitle?: string;
  date: string;
  tags: string[];
  author: string;
}

const DEFAULT_AUTHOR = "Damilola Elegbede";

export function parseFrontmatter(raw: string): { meta: Frontmatter; body: string } {
  const match = raw.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
  if (!match) {
    return {
      meta: {
        title: "Untitled",
        date: "",
        tags: [],
        author: DEFAULT_AUTHOR,
      },
      body: raw,
    };
  }
  const [, fm, body] = match;
  const meta: Partial<Frontmatter> & { tags?: string[] } = {
    tags: [],
    author: DEFAULT_AUTHOR,
  };
  for (const line of fm.split("\n")) {
    const m = line.match(/^(\w+):\s*(.*)$/);
    if (!m) continue;
    const key = m[1];
    const value = m[2].trim().replace(/^"(.*)"$/, "$1");
    if (key === "tags") {
      const inner = value.replace(/^\[/, "").replace(/\]$/, "");
      meta.tags = inner
        .split(",")
        .map((s) => s.trim().replace(/^"(.*)"$/, "$1"))
        .filter(Boolean);
    } else if (key === "title" || key === "subtitle" || key === "date" || key === "author") {
      (meta as Record<string, string>)[key] = value;
    }
  }
  return {
    meta: {
      title: meta.title ?? "Untitled",
      subtitle: meta.subtitle,
      date: meta.date ?? "",
      tags: meta.tags ?? [],
      author: meta.author ?? DEFAULT_AUTHOR,
    },
    body,
  };
}

export function formatDate(dateStr: string): string {
  if (!dateStr) return "";
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return dateStr;
  return d.toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
    timeZone: "UTC",
  });
}
