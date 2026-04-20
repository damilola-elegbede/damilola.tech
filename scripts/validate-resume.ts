/**
 * Validate career-data/data/resume-full.json against resume-full.schema.json.
 *
 * resume-full.json is the single source of truth for resume content consumed by
 * damilola.tech surfaces and the career-data chatbot corpus. Silent structural
 * drift (hand-edits that break the contract, or prebuild regeneration producing
 * malformed output) corrupts job-search-critical data; this validator fails
 * closed on any schema violation.
 *
 * Usage:
 *   npm run validate:resume
 *   tsx scripts/validate-resume.ts
 *
 * Exit: 0 on success, 1 on schema violation or I/O error.
 */

import { readFileSync } from "fs";
import { join } from "path";
import Ajv2020 from "ajv/dist/2020";
import addFormats from "ajv-formats";

const ROOT = process.cwd();
const DATA_PATH = join(ROOT, "career-data/data/resume-full.json");
const SCHEMA_PATH = join(ROOT, "data/resume-full.schema.json");

function readJson(path: string): unknown {
  const raw = readFileSync(path, "utf8");
  return JSON.parse(raw);
}

function main(): void {
  let schema: object;
  let data: unknown;

  try {
    schema = readJson(SCHEMA_PATH) as object;
  } catch (err) {
    console.error(`[validate-resume] failed to read/parse schema at ${SCHEMA_PATH}:`, err);
    process.exit(1);
  }

  try {
    data = readJson(DATA_PATH);
  } catch (err) {
    console.error(`[validate-resume] failed to read/parse data at ${DATA_PATH}:`, err);
    process.exit(1);
  }

  const ajv = new Ajv2020({ allErrors: true, strict: false });
  addFormats(ajv);
  const validate = ajv.compile(schema);
  const ok = validate(data);

  if (!ok) {
    console.error(`[validate-resume] ${DATA_PATH} FAILED schema validation:`);
    for (const err of validate.errors ?? []) {
      const loc = err.instancePath || "(root)";
      console.error(`  • ${loc} ${err.message ?? ""} ${err.params ? JSON.stringify(err.params) : ""}`);
    }
    process.exit(1);
  }

  console.log(`[validate-resume] OK — ${DATA_PATH} conforms to schema.`);
}

main();
