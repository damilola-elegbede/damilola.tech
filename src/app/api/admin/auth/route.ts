import { cookies } from 'next/headers';
import {
  verifyPassword,
  signToken,
  getAuthCookieOptions,
  ADMIN_COOKIE_NAME,
} from '@/lib/admin-auth';
import {
  checkRateLimit,
  recordFailedAttempt,
  clearRateLimit,
  getClientIp,
} from '@/lib/rate-limit';
import { validateCsrfToken, clearCsrfToken, CSRF_HEADER } from '@/lib/csrf';
import { logAdminEvent } from '@/lib/audit-server';
import { logger, logColdStartIfNeeded } from '@/lib/logger';
import { withRequestContext, createRequestContext, captureContext } from '@/lib/request-context';

export const runtime = 'nodejs';

interface LoginRequest {
  password: string;
}

export async function POST(req: Request) {
  const ctx = createRequestContext(req, '/api/admin/auth');

  return withRequestContext(ctx, async () => {
    logColdStartIfNeeded();
    logger.request.received('/api/admin/auth', { method: 'POST' });
    const ip = getClientIp(req);

    try {
      // Validate CSRF token first
      const csrfToken = req.headers.get(CSRF_HEADER);
      const validCsrf = await validateCsrfToken(csrfToken);
      if (!validCsrf) {
        logger.security.csrfFailure(ip, 'invalid_token');
        await logAdminEvent('admin_login_failure', { reason: 'invalid_csrf' }, ip);
        return Response.json({ error: 'Invalid request' }, { status: 403 });
      }

      // Check rate limit before processing
      const rateLimit = await checkRateLimit(ip);
      if (rateLimit.limited) {
        logger.security.rateLimitTriggered(ip, '/api/admin/auth', {
          retryAfter: rateLimit.retryAfter,
        });
        await logAdminEvent('admin_login_failure', { reason: 'rate_limited' }, ip);
        return Response.json(
          {
            error: 'Too many login attempts. Please try again later.',
            retryAfter: rateLimit.retryAfter,
          },
          {
            status: 429,
            headers: {
              'Retry-After': String(rateLimit.retryAfter),
            },
          }
        );
      }

      // Helper to record failed attempt and check for lockout
      const recordAndCheckLimit = async () => {
        await recordFailedAttempt(ip);
        const newLimit = await checkRateLimit(ip);
        if (newLimit.limited) {
          return Response.json(
            {
              error: 'Too many login attempts. Please try again later.',
              retryAfter: newLimit.retryAfter,
            },
            {
              status: 429,
              headers: {
                'Retry-After': String(newLimit.retryAfter),
              },
            }
          );
        }
        return null;
      };

      let body: unknown;
      try {
        body = await req.json();
      } catch (error) {
        // Distinguish JSON parse errors from other failures
        const reason = error instanceof SyntaxError ? 'invalid_json' : 'request_error';
        logger.auth.failure('password', reason, { ip });
        await logAdminEvent('admin_login_failure', { reason }, ip);
        const limitResponse = await recordAndCheckLimit();
        if (limitResponse) return limitResponse;
        return Response.json({ error: 'Invalid JSON body' }, { status: 400 });
      }

      const { password } = body as LoginRequest;

      if (typeof password !== 'string' || !password) {
        // Record attempt for missing password to prevent rate limit bypass
        logger.auth.failure('password', 'missing_password', { ip });
        await logAdminEvent('admin_login_failure', { reason: 'missing_password' }, ip);
        const limitResponse = await recordAndCheckLimit();
        if (limitResponse) return limitResponse;
        return Response.json({ error: 'Password is required' }, { status: 400 });
      }

      const result = verifyPassword(password);
      if (!result.success) {
        // Record failed attempt and check for lockout
        logger.auth.failure('password', result.reason, { ip });
        await logAdminEvent('admin_login_failure', { reason: result.reason }, ip);
        const limitResponse = await recordAndCheckLimit();
        if (limitResponse) return limitResponse;

        return Response.json({ error: 'Invalid password' }, { status: 401 });
      }

      // Clear rate limit on successful login
      await clearRateLimit(ip);

      // Clear CSRF token after successful login
      await clearCsrfToken();

      const token = await signToken();
      const cookieOptions = getAuthCookieOptions();

      const cookieStore = await cookies();
      cookieStore.set(ADMIN_COOKIE_NAME, token, cookieOptions);

      // Capture context for fire-and-forget logging
      const capturedCtx = captureContext();

      // Fire-and-forget: log success without awaiting to prevent blob failures
      // from triggering catch block (which would log a false admin_login_failure)
      logAdminEvent('admin_login_success', {}, ip).catch((err) => {
        logger.error('audit.log_failed', {
          requestId: capturedCtx?.requestId,
          event: 'admin_login_success',
          error: err instanceof Error ? err.message : String(err),
        });
      });

      logger.auth.success('password', { ip });
      logger.request.completed('/api/admin/auth', ctx.startTime);

      return Response.json({ success: true });
    } catch (error) {
      logger.auth.error('password', error, { ip });
      await logAdminEvent('admin_login_failure', { reason: 'internal_error' }, ip);
      return Response.json({ error: 'Login failed' }, { status: 500 });
    }
  });
}

export async function DELETE(req: Request) {
  const ctx = createRequestContext(req, '/api/admin/auth');

  return withRequestContext(ctx, async () => {
    logColdStartIfNeeded();
    logger.request.received('/api/admin/auth', { method: 'DELETE' });
    const ip = getClientIp(req);

    try {
      const cookieStore = await cookies();
      cookieStore.delete(ADMIN_COOKIE_NAME);

      await logAdminEvent('admin_logout', {}, ip);

      logger.auth.success('logout', { ip });
      logger.request.completed('/api/admin/auth', ctx.startTime);

      return Response.json({ success: true });
    } catch (error) {
      logger.request.failed('/api/admin/auth', ctx.startTime, error);
      return Response.json({ error: 'Logout failed' }, { status: 500 });
    }
  });
}
