import { Metadata } from 'next';
import { getCurrentUser } from '@/lib/auth/session';
import TemplatesClient from './templates-client';

export const metadata: Metadata = {
  title: 'Templates | InsightHub',
  description: 'Browse and use dashboard templates to jumpstart your analytics',
};

export default async function TemplatesPage() {
  try {
    const user = await getCurrentUser();

    return (
      <div className="container mx-auto px-4 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-[var(--text-primary)]">Dashboard Templates</h1>
          <p className="text-[var(--text-secondary)] mt-2">
            Browse professionally designed dashboard templates and create your own in minutes.
          </p>
        </div>

        <TemplatesClient currentUser={user} />
      </div>
    );
  } catch (error) {
    console.error('Error loading templates page:', error);
    // If there's an auth error, still show templates (they can be viewed by anyone)
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-[var(--text-primary)]">Dashboard Templates</h1>
          <p className="text-[var(--text-secondary)] mt-2">
            Browse professionally designed dashboard templates and create your own in minutes.
          </p>
        </div>

        <TemplatesClient currentUser={null} />
      </div>
    );
  }
}