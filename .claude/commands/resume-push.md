---
name: resume-push
description: Push base resume PDF to Vercel Blob storage
---

# Resume Push

Push base resume PDF from `career-data/resume/` to Vercel Blob storage.

Only syncs the base resume file (e.g., "Damilola Elegbede Resume.pdf").
AI-generated resumes in `generated/` are NOT synced (they're created at runtime).

## Implementation

```bash
npm run resume:push
```

Or directly:

```bash
npx tsx scripts/resume-push.ts
```

## Prerequisites
- BLOB_READ_WRITE_TOKEN must be set in `.env.local`
- Resume PDF must exist in `career-data/resume/`
- career-data submodule must be initialized
