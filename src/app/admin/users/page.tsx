import { Metadata } from 'next';
import type { SessionUser } from '@/lib/auth/session';
import { getCurrentUser } from '@/lib/auth/session';
import { hasFeaturePermission } from '@/lib/auth/permissions';
import { redirect } from 'next/navigation';
import UsersClient from './users-client';

export const metadata: Metadata = {
  title: 'User Management | InsightHub Admin',
  description: 'Manage users and their permission assignments',
};

export default async function UsersPage() {
  // Auth-gate pattern — see src/app/admin/page.tsx for the full rationale.
  // hasFeaturePermission() is intentionally NOT wrapped: a DB error there
  // is a real bug we want to surface in the error boundary, not silently
  // mask as "unauthorized".
  let user: SessionUser;
  try {
    user = await getCurrentUser();
  } catch {
    redirect('/dashboards?error=unauthorized');
  }

  const canManageUsers = await hasFeaturePermission(user, 'canManageUsers');
  const canManagePermissions = await hasFeaturePermission(user, 'canManagePermissions');

  if (!canManageUsers && !canManagePermissions) {
    redirect('/dashboards?error=access-denied');
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-[var(--text-primary)]">User Management</h1>
        <p className="text-[var(--text-secondary)] mt-2">
          Manage users and assign permission groups to control access to data and features.
        </p>
      </div>

      <UsersClient currentUser={user} />
    </div>
  );
}