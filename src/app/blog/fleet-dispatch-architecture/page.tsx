import fs from "node:fs/promises";
import path from "node:path";
import Link from "next/link";
import type { Metadata } from "next";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

export const metadata: Metadata = {
  title:
    "Building a Multi-Agent Fleet Dispatch System | Damilola Elegbede",
  description:
    "Eight root causes in one incident, and what it taught me about running a dozen LLM agents on one laptop.",
  openGraph: {
    title: "Building a Multi-Agent Fleet Dispatch System",
    description:
      "Eight root causes in one incident, and what it taught me about running a dozen LLM agents on one laptop.",
    type: "article",
    publishedTime: "2026-04-12T00:00:00Z",
  },
};

interface Frontmatter {
  title: string;
  subtitle?: string;
  date: string;
  tags: string[];
  author: string;
}

function parseFrontmatter(raw: string): { meta: Frontmatter; body: string } {
  const match = raw.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
  if (!match) {
    return {
      meta: {
        title: "Untitled",
        date: "",
        tags: [],
        author: "Damilola Elegbede",
      },
      body: raw,
    };
  }
  const [, fm, body] = match;
  const meta: Partial<Frontmatter> & { tags?: string[] } = {
    tags: [],
    author: "Damilola Elegbede",
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
      author: meta.author ?? "Damilola Elegbede",
    },
    body,
  };
}

function formatDate(dateStr: string): string {
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

export default async function FleetDispatchArchitecturePost() {
  const contentPath = path.join(process.cwd(), "src/app/blog/fleet-dispatch-architecture/content.md");
  const raw = await fs.readFile(contentPath, "utf-8");
  const { meta, body } = parseFrontmatter(raw);

  return (
    <main
      style={{
        minHeight: "100vh",
        backgroundColor: "var(--color-bg)",
        color: "var(--color-text)",
        padding: "4rem 1.5rem",
      }}
    >
      <article
        style={{
          maxWidth: "720px",
          margin: "0 auto",
        }}
      >
        <nav style={{ marginBottom: "2rem", fontSize: "0.875rem" }}>
          <Link
            href="/"
            style={{ color: "var(--color-accent)", textDecoration: "none" }}
          >
            ← Back to home
          </Link>
        </nav>

        <header style={{ marginBottom: "3rem" }}>
          <h1
            style={{
              fontSize: "2.5rem",
              fontWeight: 700,
              lineHeight: 1.15,
              marginBottom: "0.75rem",
              letterSpacing: "-0.02em",
            }}
          >
            {meta.title}
          </h1>
          {meta.subtitle ? (
            <p
              style={{
                fontSize: "1.25rem",
                lineHeight: 1.4,
                color: "var(--color-text-muted)",
                marginBottom: "1.25rem",
                fontWeight: 400,
              }}
            >
              {meta.subtitle}
            </p>
          ) : null}
          <div
            style={{
              display: "flex",
              gap: "0.75rem",
              alignItems: "center",
              fontSize: "0.875rem",
              color: "var(--color-text-muted)",
            }}
          >
            <span>{meta.author}</span>
            <span aria-hidden="true">•</span>
            <time dateTime={meta.date}>{formatDate(meta.date)}</time>
          </div>
          {meta.tags.length ? (
            <div
              style={{
                display: "flex",
                flexWrap: "wrap",
                gap: "0.5rem",
                marginTop: "1rem",
              }}
            >
              {meta.tags.map((tag) => (
                <span
                  key={tag}
                  style={{
                    fontSize: "0.75rem",
                    padding: "0.25rem 0.6rem",
                    borderRadius: "9999px",
                    backgroundColor: "var(--color-card)",
                    color: "var(--color-text-muted)",
                    textTransform: "lowercase",
                    letterSpacing: "0.02em",
                  }}
                >
                  {tag}
                </span>
              ))}
            </div>
          ) : null}
        </header>

        <div className="prose">
          <ReactMarkdown remarkPlugins={[remarkGfm]}>{body}</ReactMarkdown>
        </div>
      </article>
    </main>
  );
}
