import type { NextAuthOptions } from 'next-auth';
import CredentialsProvider from 'next-auth/providers/credentials';
import GoogleProvider from 'next-auth/providers/google';
import { logUserAction, AuditAction } from '@/lib/audit';
import prisma from '@/lib/db/prisma';

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
              },
            });
          } else {
            // Update last login time
            await prisma.user.update({
              where: { id: dbUser.id },
              data: { lastLoginAt: new Date() },
            });
          }

          token.sub = dbUser.id; // Set user ID in token
          token.role = dbUser.role;
          token.department = dbUser.department;
          token.hasOnboarded = dbUser.hasOnboarded;
          token.iat = Math.floor(Date.now() / 1000);

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
