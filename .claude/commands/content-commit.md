---
name: content-commit
description: Commit and push career-data changes, stage pointer in main repo
---

# Content Commit

Commits career-data submodule changes and stages the pointer update in damilola.tech.
Use your normal commit workflow (/commit) for the main repo after this.

## What it does

1. Stage all changes in career-data submodule
2. Commit with appropriate message (auto-generated based on changed files)
3. Push to career-data remote (origin main)
4. Stage pointer update in main repo (git add career-data)

## Implementation

```bash
npm run content:commit
```

Or directly:

```bash
npx tsx scripts/content-commit.ts
```

## After running
- Main repo has staged changes (the new submodule pointer)
- Use /commit or your normal workflow to commit the main repo
- Run /content-push to sync content to Vercel Blob

## Prerequisites
- career-data submodule must be initialized
- Git must be configured with push access to the career-data repo
