/**
 * Job application persistence via Upstash Redis.
 *
 * Data layout:
 *   Hash:        applications:<id>         — full Application record fields
 *   Sorted set:  applications:by_applied_at — members=id, scores=applied_at UNIX ms
 */

import { Redis } from '@upstash/redis';
import type { Application } from '@/lib/types/application';

// Redis key helpers
const HASH_KEY = (id: string) => `applications:${id}`;
const SORTED_SET_KEY = 'applications:by_applied_at';

// Lazy-init Redis client
let redis: Redis | null = null;
function getRedis(): Redis {
  if (!redis) {
    redis = new Redis({
      url: process.env.UPSTASH_REDIS_REST_URL!,
      token: process.env.UPSTASH_REDIS_REST_TOKEN!,
    });
  }
  return redis;
}

/**
 * Persist a new application. Returns the stored record.
 */
export async function saveApplication(app: Application): Promise<void> {
  const client = getRedis();
  const hashKey = HASH_KEY(app.id);
  const score = new Date(app.applied_at).getTime();

  // Store all fields as strings in a hash (Redis hash values are strings)
  const hashFields: Record<string, string> = {
    id: app.id,
    company: app.company,
    title: app.title,
    url: app.url ?? '',
    role_id: app.role_id ?? '',
    applied_at: app.applied_at,
    status: app.status,
    score: app.score !== null ? String(app.score) : '',
    notes: app.notes ?? '',
    created_at: app.created_at,
    updated_at: app.updated_at,
  };

  await Promise.all([
    client.hset(hashKey, hashFields),
    client.zadd(SORTED_SET_KEY, { score, member: app.id }),
  ]);
}

/**
 * Retrieve all application IDs ordered by applied_at descending.
 * Returns IDs from highest score (most recent) to lowest.
 */
export async function listApplicationIds(): Promise<string[]> {
  const client = getRedis();
  // zrange with REV returns highest score first
  const ids = await client.zrange(SORTED_SET_KEY, 0, -1, { rev: true });
  return ids as string[];
}

/**
 * Fetch a single application by ID. Returns null if not found.
 */
export async function getApplication(id: string): Promise<Application | null> {
  const client = getRedis();
  const raw = await client.hgetall(HASH_KEY(id));
  if (!raw || Object.keys(raw).length === 0) {
    return null;
  }
  return deserialize(raw as Record<string, string>);
}

/**
 * Fetch multiple applications by IDs in one pipeline.
 */
export async function getApplications(ids: string[]): Promise<Application[]> {
  if (ids.length === 0) return [];

  const client = getRedis();
  const pipeline = client.pipeline();
  for (const id of ids) {
    pipeline.hgetall(HASH_KEY(id));
  }
  const results = await pipeline.exec<Record<string, string>[]>();

  const apps: Application[] = [];
  for (const raw of results) {
    if (raw && Object.keys(raw).length > 0) {
      apps.push(deserialize(raw));
    }
  }
  return apps;
}

function deserialize(raw: Record<string, string>): Application {
  return {
    id: raw['id'] ?? '',
    company: raw['company'] ?? '',
    title: raw['title'] ?? '',
    url: raw['url'] || null,
    role_id: raw['role_id'] || null,
    applied_at: raw['applied_at'] ?? '',
    status: (raw['status'] ?? 'applied') as Application['status'],
    score: raw['score'] !== '' && raw['score'] !== undefined ? Number(raw['score']) : null,
    notes: raw['notes'] || null,
    created_at: raw['created_at'] ?? '',
    updated_at: raw['updated_at'] ?? '',
  };
}
