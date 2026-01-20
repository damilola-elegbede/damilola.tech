/**
 * Content Pull Script
 *
 * Downloads all content files from Vercel Blob to local .tmp/content/ directory.
 * Dynamically lists files from blob storage - no hardcoded file list.
 * Used for local development and content editing.
 */

import { mkdir, writeFile } from 'fs/promises';
import { join } from 'path';
import { list } from '@vercel/blob';
import * as dotenv from 'dotenv';

// Load environment variables from .env.local
dotenv.config({ path: '.env.local' });

const BLOB_PATH_PREFIX = 'damilola.tech/content';
const LOCAL_CONTENT_DIR = join(process.cwd(), '.tmp/content');

type FetchResult =
  | { status: 'ok'; content: string }
  | { status: 'error'; error: unknown };

async function fetchFile(url: string, filename: string): Promise<FetchResult> {
  try {
    const response = await fetch(url);

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    return { status: 'ok', content: await response.text() };
  } catch (error) {
    console.error(`  [ERROR] ${filename}:`, error);
    return { status: 'error', error };
  }
}

async function main() {
  const token = process.env.BLOB_READ_WRITE_TOKEN;

  if (!token) {
    console.error('Error: BLOB_READ_WRITE_TOKEN not found in environment');
    console.error('Make sure it is set in .env.local');
    process.exit(1);
  }

  console.log('Content Pull - Downloading from Vercel Blob\n');
  console.log(`Source: ${BLOB_PATH_PREFIX}/`);
  console.log(`Target: ${LOCAL_CONTENT_DIR}\n`);

  // List all files in the blob storage prefix
  console.log('Listing files in blob storage...');
  const { blobs } = await list({
    prefix: `${BLOB_PATH_PREFIX}/`,
    token,
  });

  if (blobs.length === 0) {
    console.log('No files found in blob storage.');
    return;
  }

  console.log(`Found ${blobs.length} files\n`);

  // Create local content directory
  await mkdir(LOCAL_CONTENT_DIR, { recursive: true });

  let successCount = 0;
  let errorCount = 0;

  for (const blob of blobs) {
    // Extract filename from pathname (remove prefix)
    const filename = blob.pathname.replace(`${BLOB_PATH_PREFIX}/`, '');
    const result = await fetchFile(blob.url, filename);

    switch (result.status) {
      case 'ok': {
        const localPath = join(LOCAL_CONTENT_DIR, filename);
        await writeFile(localPath, result.content, 'utf-8');
        console.log(`  [OK] ${filename}`);
        successCount++;
        break;
      }
      case 'error':
        errorCount++;
        break;
    }
  }

  console.log(`\nComplete: ${successCount} downloaded, ${errorCount} errors`);
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
