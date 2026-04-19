import { Metadata } from 'next';
import { getCurrentUser } from '@/lib/auth/session';
import { hasFeaturePermission } from '@/lib/auth/permissions';
import { redirect } from 'next/navigation';
import TemplateManagementClient from './template-management-client';

export const metadata: Metadata = {
  title: 'Template Management | InsightHub Admin',
  description: 'Manage dashboard templates and promote dashboards to the template gallery',
};

export default async function TemplateManagementPage() {
  try {
    const user = await getCurrentUser();

    // Check if user has permission to manage templates (we'll use canManageUsers as proxy for admin)
    const canManageUsers = await hasFeaturePermission(user, 'canManageUsers');
    const canManagePermissions = await hasFeaturePermission(user, 'canManagePermissions');

    if (!canManageUsers && !canManagePermissions) {
      redirect('/dashboard?error=access-denied');
    }

    return (
      <div className="container mx-auto px-4 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-[var(--text-primary)]">Template Management</h1>
          <p className="text-[var(--text-secondary)] mt-2">
            Manage the dashboard template gallery. Promote high-quality dashboards to templates for the organization.
          </p>
        </div>

        <TemplateManagementClient currentUser={user} />
      </div>
    );
  } catch (error) {
    console.error('Error loading template management page:', error);
    redirect('/dashboard?error=unauthorized');
  }
}