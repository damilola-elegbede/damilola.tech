/**
 * Content Push Script
 *
 * Uploads all content files from local .tmp/content/ to Vercel Blob storage.
 * Requires BLOB_READ_WRITE_TOKEN environment variable.
 */

import { readdir, readFile } from 'fs/promises';
import { join } from 'path';
import { put } from '@vercel/blob';
import * as dotenv from 'dotenv';

// Load environment variables from .env.local
dotenv.config({ path: '.env.local' });

const BLOB_PATH_PREFIX = 'damilola.tech/content';
const LOCAL_CONTENT_DIR = join(process.cwd(), '.tmp/content');

async function uploadFile(filename: string, content: string): Promise<boolean> {
  const blobPath = `${BLOB_PATH_PREFIX}/${filename}`;

  try {
    const blob = await put(blobPath, content, {
      access: 'public',
      addRandomSuffix: false,
    });

    console.log(`  [OK] ${filename} -> ${blob.url}`);
    return true;
  } catch (error) {
    console.error(`  [ERROR] ${filename}:`, error);
    return false;
  }
}

async function main() {
  const token = process.env.BLOB_READ_WRITE_TOKEN;

  if (!token) {
    console.error('Error: BLOB_READ_WRITE_TOKEN not found in environment');
    console.error('Make sure it is set in .env.local');
    process.exit(1);
  }

  console.log('Content Push - Uploading to Vercel Blob\n');
  console.log(`Source: ${LOCAL_CONTENT_DIR}`);
  console.log(`Target: ${BLOB_PATH_PREFIX}/\n`);

  let files: string[];

  try {
    files = await readdir(LOCAL_CONTENT_DIR);
  } catch {
    console.error(`Error: Directory not found: ${LOCAL_CONTENT_DIR}`);
    console.error('Run "npm run content:pull" first to download content files.');
    process.exit(1);
  }

  if (files.length === 0) {
    console.log('No files found in .tmp/content/');
    return;
  }

  let successCount = 0;
  let errorCount = 0;

  for (const filename of files) {
    const localPath = join(LOCAL_CONTENT_DIR, filename);
    const content = await readFile(localPath, 'utf-8');
    const success = await uploadFile(filename, content);

    if (success) {
      successCount++;
    } else {
      errorCount++;
    }
  }

  console.log(`\nComplete: ${successCount} uploaded, ${errorCount} errors`);

  if (errorCount > 0) {
    process.exit(1);
  }
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
