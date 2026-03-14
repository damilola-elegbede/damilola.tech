/**
 * Generate Resume JSON
 *
 * Syncs career-data/data/resume-full.json from src/lib/resume-data.ts.
 *
 * Mapping rules:
 * - tagline            ← resumeData.tagline
 * - experience[i].responsibilities ← resumeData.experiences[i].highlights
 * - skills "Programming" items ← add JavaScript/TypeScript if missing
 * - skillsAssessment.proficient ← add JavaScript/TypeScript if missing; remove from familiar
 *
 * Fields preserved as-is from resume-full.json (not in resume-data.ts):
 * - phone, website, summary (richer than brandingStatement)
 * - experience[i].description
 * - education year, focus
 * - targetRoles (resume-full.json has a curated short list)
 */

import { existsSync, readFileSync, writeFileSync } from "fs";
import { fileURLToPath } from "url";
import { join } from "path";
import { resumeData } from "../src/lib/resume-data";
import { fetchBlob } from "../src/lib/blob";

export const JSON_PATH = join(
  process.cwd(),
  "career-data/data/resume-full.json",
);
export const TARGET_SKILL = "JavaScript/TypeScript";

type ExistingExperience = {
  company: string;
  title: string;
  location: string;
  dates: string;
  description: string;
  responsibilities: string[];
};

type SkillCategory = { category: string; items: string[] };

type SkillsAssessment = {
  expert: string[];
  proficient: string[];
  familiar: string[];
};

type ExistingResumeJson = {
  tagline: string;
  experience: ExistingExperience[];
  skills: SkillCategory[];
  skillsAssessment: SkillsAssessment;
  [key: string]: unknown;
};

export function generateResumeJson(
  existing: ExistingResumeJson,
): ExistingResumeJson {
  // ── 1. Sync tagline ──────────────────────────────────────────────────────────
  const tagline = resumeData.tagline;

  // ── 2. Sync experience responsibilities ──────────────────────────────────────
  // Key-based lookup using company::title composite key to avoid silent
  // misassignment when arrays are reordered.
  const sourceByRole = new Map(
    resumeData.experiences.map(
      (exp) => [`${exp.company}::${exp.title}`, exp.highlights] as const,
    ),
  );

  const experience: ExistingExperience[] = existing.experience.map(
    (exp: ExistingExperience) => {
      const highlights = sourceByRole.get(`${exp.company}::${exp.title}`);
      return highlights ? { ...exp, responsibilities: highlights } : exp;
    },
  );

  // ── 3. Sync skills: add JavaScript/TypeScript to Programming ─────────────────
  const skills: SkillCategory[] = existing.skills.map((cat: SkillCategory) => {
    if (cat.category === "Programming") {
      const items = cat.items.includes(TARGET_SKILL)
        ? cat.items
        : [...cat.items, TARGET_SKILL];
      return { ...cat, items };
    }
    return cat;
  });

  // ── 4. Sync skillsAssessment: move JS/TS to proficient ───────────────────────
  const sa: SkillsAssessment = existing.skillsAssessment;

  const skillsAssessment: SkillsAssessment = {
    expert: sa.expert,
    proficient: sa.proficient.includes(TARGET_SKILL)
      ? sa.proficient
      : [...sa.proficient, TARGET_SKILL],
    familiar: sa.familiar.filter((s: string) => s !== TARGET_SKILL),
  };

  // ── 5. Assemble ───────────────────────────────────────────────────────────────
  return {
    ...existing,
    tagline,
    experience,
    skills,
    skillsAssessment,
  };
}

export function readExistingResumeJson(
  jsonPath: string = JSON_PATH,
): ExistingResumeJson {
  if (!existsSync(jsonPath)) {
    throw new Error(`Local file not found: ${jsonPath}`);
  }
  const content = readFileSync(jsonPath, "utf-8");
  return JSON.parse(content) as ExistingResumeJson;
}

async function readExistingResumeJsonWithFallback(
  jsonPath: string = JSON_PATH,
): Promise<ExistingResumeJson> {
  // Try local file first (submodule available)
  if (existsSync(jsonPath)) {
    console.log(`  Reading existing resume from local: ${jsonPath}`);
    return readExistingResumeJson(jsonPath);
  }

  // Fallback: fetch from Vercel Blob (CI/Vercel builds where submodule is unavailable)
  console.log(
    `  Local file not found, fetching resume-full.json from Vercel Blob...`,
  );
  try {
    const blobContent = await fetchBlob("resume-full.json");
    if (!blobContent) {
      throw new Error("Empty response from Vercel Blob");
    }
    console.log(`  ✓ Fetched resume-full.json from Vercel Blob`);
    return JSON.parse(blobContent) as ExistingResumeJson;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(
      `❌ Failed to read resume-full.json from any source: ${message}`,
    );
    process.exit(1);
  }
}

export function writeResumeJson(
  result: ExistingResumeJson,
  jsonPath: string = JSON_PATH,
): void {
  try {
    writeFileSync(jsonPath, JSON.stringify(result, null, 2) + "\n");
    console.log(`✅ Generated ${jsonPath}`);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`❌ Failed to write ${jsonPath}: ${message}`);
    process.exit(1);
  }
}

export async function main(): Promise<void> {
  const existing = await readExistingResumeJsonWithFallback();
  const result = generateResumeJson(existing);
  writeResumeJson(result);
}

const isDirectRun = process.argv[1] === fileURLToPath(import.meta.url);

if (isDirectRun) {
  main().catch((error) => {
    console.error("Error:", error);
    process.exit(1);
  });
}
