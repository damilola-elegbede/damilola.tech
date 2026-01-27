---
name: content-push
description: Push career-data content files to Vercel Blob storage
---

# Content Push

Push content files from `career-data/` subdirectories to Vercel Blob storage.

Files from multiple directories are flattened to `damilola.tech/content/` in blob:
- `career-data/instructions/` → instructions files
- `career-data/templates/` → prompt templates
- `career-data/context/` → career narrative and background
- `career-data/data/` → structured JSON data
- `career-data/examples/` → fit assessment samples

## Implementation

Run the TypeScript script which handles checksum comparison and upload:

```bash
npm run content:push
```

Or directly:

```bash
npx tsx scripts/content-push.ts
```

## Prerequisites
- BLOB_READ_WRITE_TOKEN must be set in `.env.local`
- career-data submodule must be initialized
- Content files must exist in career-data subdirectories
