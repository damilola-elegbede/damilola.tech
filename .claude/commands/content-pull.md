---
name: content-pull
description: Pull content files from Vercel Blob to career-data directories
---

# Content Pull

Pull all content files from Vercel Blob to `career-data/` subdirectories.

Files are automatically routed to appropriate directories:
- `career-data/instructions/` ← instruction files
- `career-data/templates/` ← prompt templates
- `career-data/context/` ← career narrative and background
- `career-data/data/` ← structured JSON data
- `career-data/examples/` ← fit assessment samples

## Implementation

Run the TypeScript script which dynamically lists and downloads all files from blob storage:

```bash
npm run content:pull
```

Or directly:

```bash
npx tsx scripts/content-pull.ts
```

The script uses `@vercel/blob`'s `list()` function to discover all files in the
`damilola.tech/content/` prefix and routes them to the correct local directories.

## Prerequisites
- BLOB_READ_WRITE_TOKEN must be set in `.env.local`
