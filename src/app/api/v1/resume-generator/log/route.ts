import { put, list } from '@vercel/blob';
import { requireApiKey } from '@/lib/api-key-auth';
import { logApiAccess } from '@/lib/api-audit';
import { apiSuccess, Errors } from '@/lib/api-response';
import type {
  ResumeGenerationLogV2,
  GenerationHistoryEntry,
  ResumeGenerationLog,
  EstimatedCompatibility,
} from '@/lib/types/resume-generation';
import type { JobIdentifier } from '@/lib/job-id';
import { getClientIp } from '@/lib/rate-limit';
import { sanitizeScoreValue } from '@/lib/score-utils';

export const runtime = 'nodejs';

function getEnvironment(): string {
  if (process.env.VERCEL) {
    return process.env.VERCEL_ENV === 'production' ? 'production' : 'preview';
  }
  return process.env.NODE_ENV === 'production' ? 'production' : 'preview';
}

async function fetchExistingRecord(
  environment: string,
  jobId: string
): Promise<{ log: ResumeGenerationLog; url: string } | null> {
  const blobPath = `damilola.tech/resume-generations/${environment}/${jobId}.json`;

  try {
    const { blobs } = await list({ prefix: blobPath, limit: 1 });

    if (blobs.length === 0) {
      return null;
    }

    const blob = blobs[0];
    const response = await fetch(blob.url);
    if (!response.ok) {
      console.warn(`[api/v1/resume-generator/log] Failed to fetch existing record: ${response.status}`);
      return null;
    }

    const log = await response.json();
    return { log, url: blob.url };
  } catch (error) {
    console.warn('[api/v1/resume-generator/log] Error fetching existing record:', error);
    return null;
  }
}

function normalizeEstimatedCompatibility(input: unknown): EstimatedCompatibility {
  const value = input && typeof input === 'object'
    ? input as Record<string, unknown>
    : {};

  const breakdown = value.breakdown && typeof value.breakdown === 'object'
    ? value.breakdown as Record<string, unknown>
    : {};

  const before = sanitizeScoreValue(value.before, 0, 100);
  const after = sanitizeScoreValue(value.after, 0, 100);
  const possibleMax = sanitizeScoreValue(value.possibleMax, after, 100);

  return {
    before,
    after,
    possibleMax,
    breakdown: {
      keywordRelevance: sanitizeScoreValue(breakdown.keywordRelevance, 0, 45),
      skillsQuality: sanitizeScoreValue(breakdown.skillsQuality, 0, 25),
      experienceAlignment: sanitizeScoreValue(breakdown.experienceAlignment, 0, 20),
      contentQuality: sanitizeScoreValue(breakdown.contentQuality, 0, 10),
    },
  };
}

export async function POST(req: Request) {
  const authResult = await requireApiKey(req);
  if (authResult instanceof Response) {
    return authResult;
  }

  const ip = getClientIp(req);

  try {
    const body = await req.json();
    const {
      generationId,
      jobId,
      jobIdentifier,
      companyName,
      roleTitle,
      jobDescriptionFull,
      datePosted,
      inputType,
      extractedUrl,
      estimatedCompatibility,
      changesAccepted,
      changesRejected,
      gapsIdentified,
      pdfUrl,
      optimizedResumeJson,
    } = body;

    if (!generationId || !companyName || !roleTitle || !jobDescriptionFull) {
      return Errors.badRequest('Missing required fields');
    }

    if (!jobId || !jobIdentifier) {
      return Errors.badRequest('Missing jobId or jobIdentifier for v2 format');
    }

    const environment = getEnvironment();
    const now = new Date().toISOString();
    const normalizedEstimatedCompatibility = normalizeEstimatedCompatibility(estimatedCompatibility);

    const existing = await fetchExistingRecord(environment, jobId);

    let log: ResumeGenerationLogV2;

    if (existing) {
      const existingLog = existing.log;

      let generationHistory: GenerationHistoryEntry[] = [];

      if (existingLog.version === 2) {
        const currentEntry: GenerationHistoryEntry = {
          generationId: existingLog.generationId,
          generatedAt: existingLog.updatedAt || existingLog.createdAt,
          pdfUrl: existingLog.pdfUrl,
          scoreBefore: existingLog.estimatedCompatibility.before,
          scoreAfter: existingLog.estimatedCompatibility.after,
          changesAccepted: existingLog.changesAccepted.length,
          changesRejected: existingLog.changesRejected.length,
        };
        generationHistory = [currentEntry, ...existingLog.generationHistory];
      } else {
        const v1Entry: GenerationHistoryEntry = {
          generationId: existingLog.generationId,
          generatedAt: existingLog.createdAt,
          pdfUrl: existingLog.pdfUrl,
          scoreBefore: existingLog.estimatedCompatibility.before,
          scoreAfter: existingLog.estimatedCompatibility.after,
          changesAccepted: existingLog.changesAccepted.length,
          changesRejected: existingLog.changesRejected.length,
        };
        generationHistory = [v1Entry];
      }

      log = {
        version: 2,
        jobId,
        jobIdentifier: jobIdentifier as JobIdentifier,
        environment,
        createdAt: existingLog.createdAt,
        updatedAt: now,
        inputType: inputType || 'text',
        extractedUrl,
        companyName,
        roleTitle,
        jobDescriptionFull,
        datePosted,
        estimatedCompatibility: normalizedEstimatedCompatibility,
        changesAccepted: changesAccepted || [],
        changesRejected: changesRejected || [],
        gapsIdentified: gapsIdentified || [],
        generationId,
        pdfUrl: pdfUrl || '',
        optimizedResumeJson: optimizedResumeJson || {},
        generationHistory,
        applicationStatus: existingLog.applicationStatus,
        appliedDate: existingLog.appliedDate,
        notes: existingLog.notes,
      };
    } else {
      log = {
        version: 2,
        jobId,
        jobIdentifier: jobIdentifier as JobIdentifier,
        environment,
        createdAt: now,
        updatedAt: now,
        inputType: inputType || 'text',
        extractedUrl,
        companyName,
        roleTitle,
        jobDescriptionFull,
        datePosted,
        estimatedCompatibility: normalizedEstimatedCompatibility,
        changesAccepted: changesAccepted || [],
        changesRejected: changesRejected || [],
        gapsIdentified: gapsIdentified || [],
        generationId,
        pdfUrl: pdfUrl || '',
        optimizedResumeJson: optimizedResumeJson || {},
        generationHistory: [],
        applicationStatus: 'draft',
      };
    }

    const blobPath = `damilola.tech/resume-generations/${environment}/${jobId}.json`;

    const blob = await put(blobPath, JSON.stringify(log, null, 2), {
      access: 'public',
      contentType: 'application/json',
    });

    const responseData = {
      url: blob.url,
      generationId,
      jobId,
      isUpdate: !!existing,
      generationCount: log.generationHistory.length + 1,
    };

    logApiAccess('api_generation_logged', authResult.apiKey, {
      environment,
      jobId,
      generationId,
      isUpdate: !!existing,
      generationCount: responseData.generationCount,
    }, ip).catch((err) => console.warn('[api/v1/resume-generator/log] Failed to log audit:', err));

    return apiSuccess(responseData);
  } catch (error) {
    console.error('[api/v1/resume-generator/log] Error:', error);
    return Errors.internalError('Failed to save generation log');
  }
}
