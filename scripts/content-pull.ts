/**
 * Content Pull Script
 *
 * Downloads all content files from Vercel Blob to local .tmp/content/ directory.
 * Used for local development and content editing.
 */

import { mkdir, writeFile } from 'fs/promises';
import { join } from 'path';

const BLOB_BASE_URL = 'https://mikya8vluytqhmff.public.blob.vercel-storage.com';
const BLOB_PATH_PREFIX = 'damilola.tech/content';
const LOCAL_CONTENT_DIR = join(process.cwd(), '.tmp/content');

const CONTENT_FILES = [
  'star-stories.json',
  'verily-feedback.md',
  'anecdotes.md',
  'shared-context.md',
  'chatbot-instructions.md',
  'fit-assessment-instructions.md',
  'leadership-philosophy.md',
  'technical-expertise.md',
  'ai-context.md',
  'resume-full.json',
  'chatbot-architecture.md',
  'fit-example-strong.md',
  'fit-example-weak.md',
];

async function fetchFile(filename: string): Promise<string | null> {
  const url = `${BLOB_BASE_URL}/${BLOB_PATH_PREFIX}/${filename}`;

  try {
    const response = await fetch(url);

    if (!response.ok) {
      if (response.status === 404) {
        console.warn(`  [SKIP] ${filename} - not found in blob storage`);
        return null;
      }
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    return await response.text();
  } catch (error) {
    console.error(`  [ERROR] ${filename}:`, error);
    return null;
  }
}

async function main() {
  console.log('Content Pull - Downloading from Vercel Blob\n');
  console.log(`Source: ${BLOB_BASE_URL}/${BLOB_PATH_PREFIX}/`);
  console.log(`Target: ${LOCAL_CONTENT_DIR}\n`);

  // Create local content directory
  await mkdir(LOCAL_CONTENT_DIR, { recursive: true });

  let successCount = 0;
  let skipCount = 0;
  let errorCount = 0;

  for (const filename of CONTENT_FILES) {
    const content = await fetchFile(filename);

    if (content !== null) {
      const localPath = join(LOCAL_CONTENT_DIR, filename);
      await writeFile(localPath, content, 'utf-8');
      console.log(`  [OK] ${filename}`);
      successCount++;
    } else {
      skipCount++;
    }
  }

  console.log(`\nComplete: ${successCount} downloaded, ${skipCount} skipped, ${errorCount} errors`);
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
