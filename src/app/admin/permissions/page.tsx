import { Metadata } from 'next';
import { getCurrentUser } from '@/lib/auth/session';
import { hasFeaturePermission } from '@/lib/auth/permissions';
import { redirect } from 'next/navigation';
import PermissionGroupsClient from './permissions-client';

export const metadata: Metadata = {
  title: 'Permission Groups | InsightHub Admin',
  description: 'Manage permission groups and data access controls',
};

export default async function PermissionGroupsPage() {
  try {
    const user = await getCurrentUser();

    // Check if user has permission to manage permissions
    const canManage = await hasFeaturePermission(user, 'canManagePermissions');

    if (!canManage) {
      redirect('/dashboard?error=access-denied');
    }

    return (
      <div className="container mx-auto px-4 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-[var(--text-primary)]">Permission Groups</h1>
          <p className="text-[var(--text-secondary)] mt-2">
            Manage permission groups and control access to data sources and features.
          </p>
        </div>

        <PermissionGroupsClient user={user} />
      </div>
    );
  } catch (error) {
    console.error('Error loading permissions page:', error);
    redirect('/dashboard?error=unauthorized');
  }
}