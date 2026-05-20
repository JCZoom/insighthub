import { NextResponse } from 'next/server';
import { withAuth } from 'next-auth/middleware';

export default withAuth(
  function middleware() {
    const response = NextResponse.next();

    // Security Headers
    response.headers.set('X-Frame-Options', 'DENY');
    response.headers.set('X-Content-Type-Options', 'nosniff');
    response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
    response.headers.set('X-XSS-Protection', '1; mode=block');

    // HSTS is set at the edge (nginx) — see infra/nginx-tls-options.conf.
    // Setting it here too produced a duplicate response header which SSL Labs
    // graded as `hstsPolicy: invalid` ("server provided more than one HSTS
    // header"), capping the cert at A-. Single source of truth = nginx.
    // Closes evidence note P-01 in docs/evidence/smoke-test-2026-05-19-track-b.md.

    // Content Security Policy
    // - 'unsafe-eval' only in dev (Next.js hot reload); removed in production
    // - 'unsafe-inline' required for Next.js inline scripts and Tailwind styles
    // - https://vercel.live removed (not using Vercel)
    const isDev = process.env.NODE_ENV !== 'production';
    const scriptSrc = isDev
      ? `'self' 'unsafe-eval' 'unsafe-inline'`
      : `'self' 'unsafe-inline'`;
    const cspHeader = `
      default-src 'self';
      script-src ${scriptSrc};
      style-src 'self' 'unsafe-inline' https://fonts.googleapis.com;
      font-src 'self' https://fonts.gstatic.com;
      img-src 'self' data: blob:;
      connect-src 'self' https://api.anthropic.com;
      frame-src 'self';
      object-src 'none';
      base-uri 'self';
      form-action 'self';
      frame-ancestors 'none';
      upgrade-insecure-requests;
    `.replace(/\s{2,}/g, ' ').trim();

    response.headers.set('Content-Security-Policy', cspHeader);

    // CSRF protection is handled by NextAuth's built-in cookie-based mechanism.
    // Custom header-based CSRF is not wired into the client — do not gate here.

    return response;
  },
  {
    callbacks: {
      authorized: ({ token, req }) => {
        // Allow public routes
        const publicPaths = ['/login', '/api/health', '/api/auth'];
        const isPublicPath = publicPaths.some(path =>
          req.nextUrl.pathname.startsWith(path)
        );

        if (isPublicPath) return true;

        // For dev mode, allow access.
        //
        // SECURITY: DEV_MODE (not NEXT_PUBLIC_DEV_MODE) — must be a server-only
        // env var so its value is read at runtime, not inlined into the JS
        // bundle at `next build` time. Post-2026-05-19 incident: when this
        // gate read NEXT_PUBLIC_DEV_MODE, editing /opt/insighthub/.env.local
        // on prod did NOT close the bypass because the value was already
        // frozen in the standalone server.js. See docs/INCIDENT_RESPONSE_RUNBOOK.md.
        if (process.env.DEV_MODE === 'true') return true;

        // For protected routes, require valid token
        return !!token;
      },
    },
  }
);

// Specify which routes this middleware should run on
export const config = {
  matcher: [
    // Match all routes except static files and Next.js internals
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};