import type { NextAuthOptions } from 'next-auth';
import CredentialsProvider from 'next-auth/providers/credentials';

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
        token.role = 'ADMIN';
        token.department = 'Engineering';
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
  },
};

export function getDevUser() {
  return DEV_USER;
}
