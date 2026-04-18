import { getServerSession } from 'next-auth/next';
import { authOptions } from './config';
import { getDevUser } from './config';

export interface SessionUser {
  id: string;
  email: string;
  name: string;
  role: 'VIEWER' | 'CREATOR' | 'POWER_USER' | 'ADMIN';
  department: string;
}

export async function getCurrentUser(): Promise<SessionUser> {
  // In dev mode, return dev user for convenience
  if (process.env.NEXT_PUBLIC_DEV_MODE === 'true') {
    const dev = getDevUser();
    return {
      id: dev.id,
      email: dev.email,
      name: dev.name,
      role: dev.role,
      department: dev.department,
    };
  }

  // Get session from NextAuth
  const session = await getServerSession(authOptions);

  if (!session?.user) {
    throw new Error('Unauthorized: No valid session found');
  }

  // Type-safe session user extraction
  const sessionUser = session.user as Record<string, unknown>;

  return {
    id: sessionUser.id as string || 'unknown',
    email: sessionUser.email as string || '',
    name: sessionUser.name as string || '',
    role: (sessionUser.role as SessionUser['role']) || 'VIEWER',
    department: sessionUser.department as string || '',
  };
}

// For backwards compatibility - sync version that throws in production
export function getCurrentUserSync(): SessionUser {
  if (process.env.NEXT_PUBLIC_DEV_MODE === 'true') {
    const dev = getDevUser();
    return {
      id: dev.id,
      email: dev.email,
      name: dev.name,
      role: dev.role,
      department: dev.department,
    };
  }

  throw new Error('getCurrentUserSync can only be used in dev mode. Use getCurrentUser() instead.');
}

export function isAdmin(user: SessionUser): boolean {
  return user.role === 'ADMIN';
}

export function canCreateDashboard(user: SessionUser): boolean {
  return ['CREATOR', 'POWER_USER', 'ADMIN'].includes(user.role);
}

export function canEditGlossary(user: SessionUser): boolean {
  return user.role === 'ADMIN';
}

export function canAccessSensitiveData(user: SessionUser): boolean {
  return ['POWER_USER', 'ADMIN'].includes(user.role);
}
