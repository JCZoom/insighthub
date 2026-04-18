import type { NextAuthOptions } from 'next-auth';
import CredentialsProvider from 'next-auth/providers/credentials';
import { logUserAction, AuditAction } from '@/lib/audit';

const DEV_USER = {
  id: 'dev-admin-user',
  email: 'jeff.coy@uszoom.com',
  name: 'Jeff Coy',
  role: 'ADMIN' as const,
  department: 'Engineering',
  image: null,
};

export const authOptions: NextAuthOptions = {
  providers: [
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
    async jwt({ token, user }) {
      if (user) {
        // TODO: When Google OAuth is wired up, query the DB for the user's actual role:
        //   const dbUser = await prisma.user.findUnique({ where: { id: user.id } });
        //   token.role = dbUser?.role || 'VIEWER';
        //   token.department = dbUser?.department || null;
        // For now, use the dev user's role from the constant (only CredentialsProvider is active)
        token.role = DEV_USER.role;
        token.department = DEV_USER.department;
        token.iat = Math.floor(Date.now() / 1000); // Set issued at time

        // Log user login for audit
        try {
          await logUserAction(
            user.id,
            AuditAction.USER_LOGIN,
            user.id,
            {
              email: user.email,
              name: user.name,
              loginTime: new Date().toISOString(),
            }
          );
        } catch (error) {
          console.error('Failed to log user login audit:', error);
        }
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        (session.user as Record<string, unknown>).id = token.sub;
        (session.user as Record<string, unknown>).role = token.role;
        (session.user as Record<string, unknown>).department = token.department;
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
