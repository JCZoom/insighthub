import { Metadata } from 'next';
import { getCurrentUser } from '@/lib/auth/session';
import { hasFeaturePermission } from '@/lib/auth/permissions';
import { redirect } from 'next/navigation';
import UsersClient from './users-client';

export const metadata: Metadata = {
  title: 'User Management | InsightHub Admin',
  description: 'Manage users and their permission assignments',
};

export default async function UsersPage() {
  try {
    const user = await getCurrentUser();

    // Check if user has permission to manage users or permissions
    const canManageUsers = await hasFeaturePermission(user, 'canManageUsers');
    const canManagePermissions = await hasFeaturePermission(user, 'canManagePermissions');

    if (!canManageUsers && !canManagePermissions) {
      redirect('/dashboard?error=access-denied');
    }

    return (
      <div className="container mx-auto px-4 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">User Management</h1>
          <p className="text-gray-600 dark:text-gray-300 mt-2">
            Manage users and assign permission groups to control access to data and features.
          </p>
        </div>

        <UsersClient currentUser={user} />
      </div>
    );
  } catch (error) {
    console.error('Error loading users page:', error);
    redirect('/dashboard?error=unauthorized');
  }
}