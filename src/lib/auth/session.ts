import { getDevUser } from './config';

export interface SessionUser {
  id: string;
  email: string;
  name: string;
  role: 'VIEWER' | 'CREATOR' | 'POWER_USER' | 'ADMIN';
  department: string;
}

export function getCurrentUser(): SessionUser {
  const dev = getDevUser();
  return {
    id: dev.id,
    email: dev.email,
    name: dev.name,
    role: dev.role,
    department: dev.department,
  };
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
