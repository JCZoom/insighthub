import type { NextAuthOptions } from 'next-auth';
import CredentialsProvider from 'next-auth/providers/credentials';
import GoogleProvider from 'next-auth/providers/google';
import { logUserAction, createAuditLog, AuditAction, ResourceType } from '@/lib/audit';
import prisma from '@/lib/db/prisma';
import { parseIdTokenAMR, requiresMfa } from './mfa';

const DEV_USER = {
  id: 'dev-admin-user',
  email: 'jeff.coy@uszoom.com',
  name: 'Jeff Coy',
  role: 'ADMIN' as const,
  department: 'Engineering',
  image: null,
};

// Admin user list - emails that should get ADMIN role
const ADMIN_EMAILS = [
  'jeff.coy@uszoom.com',
  // Add other admin emails here
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
    }),
    // Keep dev provider for development
    CredentialsProvider({
      name: 'Dev Login',
      credentials: {
        email: { label: 'Email', type: 'email' },
      },
      async authorize(credentials) {
        if (process.env.NEXT_PUBLIC_DEV_MODE === 'true') {
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

        if (requiresMfa(effectiveRole) && !amr.mfaVerified) {
          // Fire-and-forget audit of the rejection. Best-effort: a failed audit
          // here must not crash the sign-in handler (which would already be
          // reporting the legitimate "rejected" outcome to the user).
          createAuditLog({
            userId: 'system:auth',
            action: AuditAction.USER_LOGIN,
            resourceType: ResourceType.USER,
            resourceId: email.toLowerCase(),
            metadata: {
              outcome: 'rejected',
              reason: 'mfa_required',
              effectiveRole,
              amrValues: amr.amrValues,
              parseError: amr.parseError,
            },
          }).catch(() => undefined);

          console.warn(
            `[auth] Rejected sign-in for ${email} — role=${effectiveRole} requires MFA but amr=${JSON.stringify(amr.amrValues)} (parseError=${amr.parseError}).`
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

        // Check if this is a dev mode login
        if (account.provider === 'credentials' && process.env.NEXT_PUBLIC_DEV_MODE === 'true') {
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
