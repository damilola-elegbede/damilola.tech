import { cookies } from 'next/headers';
import { verifyToken, ADMIN_COOKIE_NAME } from '@/lib/admin-auth';
import { getAggregatedStats } from '@/lib/usage-logger';

export const runtime = 'nodejs';

export async function GET() {
  // Verify authentication
  const cookieStore = await cookies();
  const token = cookieStore.get(ADMIN_COOKIE_NAME)?.value;
  if (!token || !(await verifyToken(token))) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const stats = await getAggregatedStats();
    const environment = process.env.VERCEL_ENV || 'development';

    return Response.json({
      ...stats,
      environment,
    });
  } catch (error) {
    console.error('[admin/usage] Error getting usage stats:', error);
    return Response.json({ error: 'Failed to get usage stats' }, { status: 500 });
  }
}
