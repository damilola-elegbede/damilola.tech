import { describe, it, expect } from "vitest";
import { parseFrontmatter, formatDate } from "@/lib/blog-frontmatter";

describe("parseFrontmatter", () => {
  it("parses well-formed frontmatter with all fields", () => {
    const raw = [
      "---",
      'title: "Building a Fleet"',
      'subtitle: "Eight root causes"',
      "date: 2026-04-12",
      'author: "Damilola Elegbede"',
      'tags: ["infra", "ai", "incidents"]',
      "---",
      "Body starts here.",
    ].join("\n");

    const { meta, body } = parseFrontmatter(raw);
    expect(meta.title).toBe("Building a Fleet");
    expect(meta.subtitle).toBe("Eight root causes");
    expect(meta.date).toBe("2026-04-12");
    expect(meta.author).toBe("Damilola Elegbede");
    expect(meta.tags).toEqual(["infra", "ai", "incidents"]);
    expect(body).toBe("Body starts here.");
  });

  it("returns defaults when no frontmatter delimiters are present", () => {
    const raw = "Just a plain body with no frontmatter.\n\nSecond line.";
    const { meta, body } = parseFrontmatter(raw);
    expect(meta.title).toBe("Untitled");
    expect(meta.date).toBe("");
    expect(meta.tags).toEqual([]);
    expect(meta.author).toBe("Damilola Elegbede");
    expect(body).toBe(raw);
  });

  it("handles missing fields by applying defaults", () => {
    const raw = [
      "---",
      "title: Only A Title",
      "---",
      "Body.",
    ].join("\n");

    const { meta } = parseFrontmatter(raw);
    expect(meta.title).toBe("Only A Title");
    expect(meta.date).toBe("");
    expect(meta.tags).toEqual([]);
    expect(meta.author).toBe("Damilola Elegbede");
    expect(meta.subtitle).toBeUndefined();
  });

  it("strips quoted and unquoted tag variants and filters empty entries", () => {
    const raw = [
      "---",
      "title: Tags Parsing",
      'tags: ["quoted", unquoted,  spaced  , ""]',
      "---",
      "Body.",
    ].join("\n");

    const { meta } = parseFrontmatter(raw);
    expect(meta.tags).toEqual(["quoted", "unquoted", "spaced"]);
  });

  it("handles empty body gracefully", () => {
    const raw = [
      "---",
      "title: Empty Body",
      "---",
      "",
    ].join("\n");

    const { meta, body } = parseFrontmatter(raw);
    expect(meta.title).toBe("Empty Body");
    expect(body).toBe("");
  });

  it("ignores frontmatter lines that don't match key: value", () => {
    const raw = [
      "---",
      "title: Has Garbage",
      "not a valid line",
      "also-not-valid",
      "date: 2026-01-01",
      "---",
      "Body.",
    ].join("\n");

    const { meta } = parseFrontmatter(raw);
    expect(meta.title).toBe("Has Garbage");
    expect(meta.date).toBe("2026-01-01");
  });

  it("strips surrounding double quotes from string fields", () => {
    const raw = [
      "---",
      'title: "Quoted Title"',
      'author: "A. Person"',
      "---",
      "Body.",
    ].join("\n");

    const { meta } = parseFrontmatter(raw);
    expect(meta.title).toBe("Quoted Title");
    expect(meta.author).toBe("A. Person");
  });
});

describe("formatDate", () => {
  it("returns empty string for empty input", () => {
    expect(formatDate("")).toBe("");
  });

  it("returns original string when date is invalid", () => {
    expect(formatDate("not-a-date")).toBe("not-a-date");
    expect(formatDate("2026-13-45")).toBe("2026-13-45");
  });

  it("formats valid ISO dates as Month Day, Year in UTC", () => {
    expect(formatDate("2026-04-12")).toBe("April 12, 2026");
    expect(formatDate("2026-04-12T00:00:00Z")).toBe("April 12, 2026");
  });

  it("uses UTC timezone regardless of local offset", () => {
    // Even at midnight UTC, should still show April 12 (not April 11)
    expect(formatDate("2026-04-12T00:00:00Z")).toBe("April 12, 2026");
    // Even at 23:59 UTC, should show April 12 (not April 13)
    expect(formatDate("2026-04-12T23:59:59Z")).toBe("April 12, 2026");
  });
});
