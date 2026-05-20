import type { NextAuthOptions } from 'next-auth';
import CredentialsProvider from 'next-auth/providers/credentials';
import GoogleProvider from 'next-auth/providers/google';
import { logUserAction, createAuditLog, AuditAction, ResourceType } from '@/lib/audit';
import prisma from '@/lib/db/prisma';
import { parseIdTokenAMR, requiresMfa, verifyMfa } from './mfa';

const DEV_USER = {
  id: 'dev-admin-user',
  email: 'jeff.coy@uszoom.com',
  name: 'Jeff Coy',
  role: 'ADMIN' as const,
  department: 'Engineering',
  image: null,
};

// Admin user list — emails that get ADMIN role on first sign-in.
//
// IMPORTANT: this allowlist is consulted ONLY when creating a new User row
// (jwt callback below, line ~152). For an existing User row the persisted
// `role` column wins, so adding an email here does NOT retroactively
// promote a user who has already signed in once. To promote an existing
// row, UPDATE the DB directly.
//
// `jeffrey.coy@uszoom.com` (with the `jeffrey.` prefix) is Jeff Coy's real
// Google identity. The earlier `jeff.coy@uszoom.com` entry was a
// near-miss left over from the seed data — keep both so either spelling
// auto-promotes if the row doesn't exist yet, but the canonical address
// is `jeffrey.coy@uszoom.com`. Added 2026-05-20 after first OAuth sign-in
// landed Jeff in a VIEWER row and locked him out of /admin.
const ADMIN_EMAILS = [
  'jeffrey.coy@uszoom.com',
];

// Helper function to determine user role based on email
function determineUserRole(email: string): 'VIEWER' | 'CREATOR' | 'POWER_USER' | 'ADMIN' {
  if (ADMIN_EMAILS.includes(email.toLowerCase())) {
    return 'ADMIN';
  }
  return 'VIEWER'; // Default role
}

export const authOptions: NextAuthOptions = {
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
      // `prompt: 'login'` forces Google to re-prompt for password every
      // time, so a stolen session cookie can't be used to walk into a
      // privileged account. Google still honors normal 2SV-touch on the
      // YubiKey in this mode.
      //
      // What we deliberately do NOT set, after discovering it the hard way
      // 2026-05-20 (~13:45 ET):
      //   - max_age=0       : per OIDC spec the IdP MUST actively re-
      //                       authenticate. Google interprets this as
      //                       "use the highest-assurance credential
      //                       available", which on a YubiKey means
      //                       FIDO2 PIN verification — a PIN set ON the
      //                       hardware key itself, separate from any
      //                       account password. Most enterprise YubiKeys
      //                       are enrolled in 2SV-touch mode and have NO
      //                       PIN. Setting max_age=0 produces an
      //                       unrecoverable "Enter PIN" prompt for those
      //                       users.
      //   - acr_values=mfa  : OIDC standard for requesting a specific
      //                       authentication context. Google's
      //                       implementation appears to behave the same
      //                       as max_age=0 here — escalates to
      //                       user-verifying credentials.
      //
      // We don't need either to satisfy our MFA gate. The id_token's `amr`
      // claim is documented-unreliable (Google routinely omits it for
      // second-factor flows); we already verified that even with these
      // two flags set, Google still returns amr=[]. The application's
      // MFA evidence comes from the TRUSTED_MFA_DOMAINS-backed
      // domain-trust fallback in mfa.ts — we accept the Workspace 2SV
      // policy as the authoritative MFA control for listed domains, with
      // a loud journald audit line on every fallback use.
      authorization: {
        params: {
          prompt: 'login',
        },
      },
    }),
    // Keep dev provider for development
    CredentialsProvider({
      name: 'Dev Login',
      credentials: {
        email: { label: 'Email', type: 'email' },
      },
      async authorize(credentials) {
        // SECURITY: read DEV_MODE (server-only, runtime), not NEXT_PUBLIC_DEV_MODE
        // (which is inlined at build time and cannot be toggled at runtime).
        if (process.env.DEV_MODE === 'true') {
          return {
            id: DEV_USER.id,
            email: credentials?.email || DEV_USER.email,
            name: DEV_USER.name,
            image: DEV_USER.image,
          };
        }
        return null;
      },
    }),
  ],
  callbacks: {
    async signIn({ user, account }) {
      // Domain restriction - only allow @uszoom.com emails
      if (account?.provider === 'google') {
        const email = user.email;
        if (!email || !email.toLowerCase().endsWith(`@${process.env.ALLOWED_DOMAIN || 'uszoom.com'}`)) {
          return false; // Reject sign in
        }

        // G-02 / Policy 3692 AUTH-02, AUTH-06: enforce MFA at the application
        // layer for privileged accounts. We parse the Google OIDC `amr` claim
        // out of the id_token and reject the sign-in if MFA is not asserted
        // for an account whose effective role requires it.
        //
        // We determine "effective role" from two signals:
        //   (a) The ADMIN_EMAILS allowlist (used for the very first login,
        //       when the User row doesn't exist yet).
        //   (b) The persisted role on the User row, if one exists.
        // Whichever is more permissive wins — we err on the side of requiring
        // MFA more often, not less.
        const amr = parseIdTokenAMR(account.id_token as string | undefined);
        const allowlistRole = determineUserRole(email);
        let dbRole: string | null = null;
        try {
          const dbUser = await prisma.user.findUnique({
            where: { email: email.toLowerCase() },
            select: { role: true },
          });
          dbRole = dbUser?.role ?? null;
        } catch {
          dbRole = null;
        }
        const effectiveRole =
          dbRole && (dbRole === 'ADMIN' || dbRole === 'POWER_USER')
            ? dbRole
            : allowlistRole;

        // Combined MFA check: amr claim first, domain-trust list as fallback.
        // Google's amr claim is documented-unreliable for second-factor flows;
        // see mfa.ts for the trust assumption that backs the fallback.
        const mfa = verifyMfa(email, amr);
        if (mfa.verified && mfa.via === 'domain-trust') {
          // Loud audit signal so this is greppable in journald. If you ever
          // see this for an account that should be MFA-asserting at Google
          // level (i.e. amr should be populated), investigate the IdP — the
          // fallback is meant to be the safety net, not the steady state.
          console.warn(
            `[auth] MFA verified via domain-trust fallback for ${email} ` +
              `(role=${effectiveRole}, amr=${JSON.stringify(amr.amrValues)}, ` +
              `TRUSTED_MFA_DOMAINS=${process.env.TRUSTED_MFA_DOMAINS ?? ''}). ` +
              `Google did not populate the amr claim; we trust the Workspace ` +
              `2SV enforcement on the listed domain as the MFA control.`
          );
        }
        if (requiresMfa(effectiveRole) && !mfa.verified) {
          // Best-effort audit of the rejection. We need a real User.id to
          // satisfy the AuditLog.userId FK constraint, so look the user up
          // by email. If no row exists yet (first-time sign-in being
          // rejected), we skip the DB write — the console.warn below still
          // produces a structured journald line that ops can grep for. A
          // future improvement would be to seed a synthetic 'system:auth'
          // User row at boot and use that as the universal fallback so we
          // get DB-grade audit even for never-seen-before emails.
          let auditUserId: string | null = null;
          try {
            const existing = await prisma.user.findUnique({
              where: { email: email.toLowerCase() },
              select: { id: true },
            });
            auditUserId = existing?.id ?? null;
          } catch {
            auditUserId = null;
          }

          if (auditUserId) {
            createAuditLog({
              userId: auditUserId,
              action: AuditAction.USER_LOGIN,
              resourceType: ResourceType.USER,
              resourceId: auditUserId,
              metadata: {
                outcome: 'rejected',
                reason: 'mfa_required',
                effectiveRole,
                amrValues: amr.amrValues,
                parseError: amr.parseError,
              },
            }).catch(() => undefined);
          }

          console.warn(
            `[auth] Rejected sign-in for ${email} — role=${effectiveRole} requires MFA but amr=${JSON.stringify(amr.amrValues)} (parseError=${amr.parseError}, domainTrusted=false).`
          );

          // Returning a string path causes NextAuth to redirect there with
          // an error code; the page explains what to do.
          return '/auth/mfa-required';
        }
      }
      return true;
    },
    async jwt({ token, user, account }) {
      if (user && account) {
        const email = user.email!;

        // Check if this is a dev mode login (server-only DEV_MODE, runtime).
        if (account.provider === 'credentials' && process.env.DEV_MODE === 'true') {
          token.role = DEV_USER.role;
          token.department = DEV_USER.department;
          token.iat = Math.floor(Date.now() / 1000);
          return token;
        }

        // G-02: capture MFA assertion (if any) from the id_token. By the time
        // we reach this callback, `signIn` has already enforced the MFA gate
        // for privileged roles, so a missing `amr` here means the user is a
        // non-privileged role and we still want to RECORD that MFA was not
        // asserted (auditor-relevant).
        const amr = parseIdTokenAMR(account.id_token as string | undefined);
        const mfaVerifiedAt = amr.mfaVerified ? new Date() : undefined;

        // For Google OAuth, find or create user in database
        try {
          let dbUser = await prisma.user.findUnique({
            where: { email: email.toLowerCase() },
          });

          // Auto-create user record on first login
          if (!dbUser) {
            const role = determineUserRole(email);
            dbUser = await prisma.user.create({
              data: {
                email: email.toLowerCase(),
                name: user.name || '',
                avatarUrl: user.image,
                role,
                department: '', // Could be mapped from email domain or set later
                hasOnboarded: false,
                lastLoginAt: new Date(),
                mfaVerifiedAt: mfaVerifiedAt ?? null,
              },
            });
          } else {
            // Update last login time + MFA timestamp (only if MFA was asserted
            // on THIS sign-in — never null-out a previous verification).
            await prisma.user.update({
              where: { id: dbUser.id },
              data: {
                lastLoginAt: new Date(),
                ...(mfaVerifiedAt ? { mfaVerifiedAt } : {}),
              },
            });
          }

          token.sub = dbUser.id; // Set user ID in token
          token.role = dbUser.role;
          token.department = dbUser.department;
          token.hasOnboarded = dbUser.hasOnboarded;
          token.iat = Math.floor(Date.now() / 1000);
          token.mfaVerified = amr.mfaVerified;

          // Log user login for audit
          try {
            await logUserAction(
              dbUser.id,
              AuditAction.USER_LOGIN,
              dbUser.id,
              {
                email: dbUser.email,
                name: dbUser.name,
                loginTime: new Date().toISOString(),
                provider: account.provider,
              }
            );
          } catch (error) {
            console.error('Failed to log user login audit:', error);
          }
        } catch (error) {
          console.error('Failed to create/update user:', error);
          // In case of error, we still need to return the token but can mark it as invalid
          return token; // Return token to avoid type error
        }
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        (session.user as Record<string, unknown>).id = token.sub;
        (session.user as Record<string, unknown>).role = token.role;
        (session.user as Record<string, unknown>).department = token.department;
        (session.user as Record<string, unknown>).hasOnboarded = token.hasOnboarded;
      }
      return session;
    },
  },
  pages: {
    signIn: '/login',
  },
  session: {
    strategy: 'jwt',
    maxAge: 8 * 60 * 60, // 8 hours in seconds
    updateAge: 24 * 60 * 60, // 24 hours - how often to update the session
  },
  jwt: {
    maxAge: 8 * 60 * 60, // 8 hours in seconds
  },
};

export function getDevUser() {
  return DEV_USER;
}
