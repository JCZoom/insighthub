import Link from 'next/link';

/**
 * /auth/mfa-required — landing page shown when a privileged sign-in is
 * rejected because the Google `amr` claim did not assert MFA.
 *
 * G-02 / Policy 3692 AUTH-02, AUTH-06.
 */
export default function MfaRequiredPage() {
  return (
    <main className="min-h-screen flex items-center justify-center bg-[var(--bg-primary)] px-4">
      <div className="max-w-lg w-full bg-[var(--bg-elevated)] border border-[var(--border-default)] rounded-lg p-8 shadow-lg">
        <div className="flex items-center gap-3 mb-6">
          <span className="text-3xl" aria-hidden>🔐</span>
          <h1 className="text-2xl font-semibold text-[var(--text-primary)]">
            Multi-factor authentication required
          </h1>
        </div>

        <div className="space-y-4 text-[var(--text-primary)]">
          <p>
            Your USZoom account has a privileged role (Admin or Power User) that
            requires multi-factor authentication for every sign-in. The sign-in
            attempt did not include an MFA assertion.
          </p>

          <p>
            This control is enforced by InsightHub itself in addition to Google
            Workspace policies — auditor evidence for{' '}
            <em>Authentication &amp; Password Policy 3692</em> (AUTH-02, AUTH-06).
          </p>

          <div className="border-l-4 border-amber-400 bg-amber-50 dark:bg-amber-950/30 p-4 rounded-r">
            <h2 className="font-semibold mb-2">How to resolve</h2>
            <ol className="list-decimal list-inside space-y-1 text-sm">
              <li>Verify 2-step verification is enabled on your USZoom Google account.</li>
              <li>
                Sign out of Google completely (
                <a
                  href="https://accounts.google.com/Logout"
                  target="_blank"
                  rel="noreferrer"
                  className="underline"
                >
                  accounts.google.com/Logout
                </a>
                ).
              </li>
              <li>Sign back in to Google — you will be prompted for your second factor.</li>
              <li>Return here and sign in again.</li>
            </ol>
          </div>

          <p className="text-sm text-[var(--text-muted)]">
            If you believe this is a misconfiguration, contact Jeff Coy
            (jeff.coy@uszoom.com) or the IT security team.
          </p>

          <div className="pt-4">
            <Link
              href="/login"
              className="inline-block px-4 py-2 bg-[var(--accent)] text-white rounded hover:bg-[var(--accent-hover)] transition"
            >
              Back to sign-in
            </Link>
          </div>
        </div>
      </div>
    </main>
  );
}
