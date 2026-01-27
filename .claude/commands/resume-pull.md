---
name: resume-pull
description: Pull base resume PDF from Vercel Blob storage
---

# Resume Pull

Pull base resume PDF from Vercel Blob to `career-data/resume/`.

Only syncs the base resume file (e.g., "Damilola Elegbede Resume.pdf").
AI-generated resumes in `generated/` are skipped.

## Implementation

```bash
npm run resume:pull
```

Or directly:

```bash
npx tsx scripts/resume-pull.ts
```

## Prerequisites
- BLOB_READ_WRITE_TOKEN must be set in `.env.local`
