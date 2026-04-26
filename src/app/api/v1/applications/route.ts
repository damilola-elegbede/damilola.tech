import { requireApiKey } from '@/lib/api-key-auth';
import { Errors } from '@/lib/api-response';
import { listApplicationIds, getApplications } from '@/lib/applications-store';
import { APPLICATION_STATUSES } from '@/lib/types/application';
import type { Application, ApplicationStatus } from '@/lib/types/application';

export const runtime = 'nodejs';

const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 100;

export async function GET(req: Request): Promise<Response> {
  const authResult = await requireApiKey(req);
  if (authResult instanceof Response) {
    return authResult;
  }

  const { searchParams } = new URL(req.url);

  // Validate status filter
  const statusParam = searchParams.get('status');
  if (statusParam !== null && !APPLICATION_STATUSES.includes(statusParam as ApplicationStatus)) {
    return Errors.validationError(`invalid status value: '${statusParam}'`);
  }
  const statusFilter = statusParam as ApplicationStatus | null;

  // company filter (case-insensitive contains)
  const companyParam = searchParams.get('company');
  const companyFilter = companyParam ? companyParam.toLowerCase() : null;

  // limit / offset
  const rawLimit = parseInt(searchParams.get('limit') ?? String(DEFAULT_LIMIT), 10);
  const limit = isNaN(rawLimit) ? DEFAULT_LIMIT : Math.min(Math.max(1, rawLimit), MAX_LIMIT);

  const rawOffset = parseInt(searchParams.get('offset') ?? '0', 10);
  const offset = isNaN(rawOffset) || rawOffset < 0 ? 0 : rawOffset;

  try {
    // Fetch all IDs (ordered by applied_at DESC from Redis sorted set)
    const allIds = await listApplicationIds();

    // When filters are active we must fetch all records before applying them,
    // because we can't filter server-side on Redis without fetching hash fields.
    // For small N (job search scale) this is acceptable.
    if (statusFilter !== null || companyFilter !== null) {
      const allApps = await getApplications(allIds);
      const filtered = applyFilters(allApps, statusFilter, companyFilter);
      const total = filtered.length;
      const page = filtered.slice(offset, offset + limit);

      return Response.json({
        success: true,
        data: {
          applications: page,
          total,
          limit,
          offset,
        },
      });
    }

    // No filters — slice IDs first, then fetch only the page
    const total = allIds.length;
    const pageIds = allIds.slice(offset, offset + limit);
    const applications = await getApplications(pageIds);

    return Response.json({
      success: true,
      data: {
        applications,
        total,
        limit,
        offset,
      },
    });
  } catch (err) {
    console.error('[api/v1/applications] Failed to list applications:', err);
    return Errors.internalError('Failed to list applications.');
  }
}

function applyFilters(
  apps: Application[],
  status: ApplicationStatus | null,
  company: string | null
): Application[] {
  return apps.filter((app) => {
    if (status !== null && app.status !== status) return false;
    if (company !== null && !app.company.toLowerCase().includes(company)) return false;
    return true;
  });
}
