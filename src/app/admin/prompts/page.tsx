import { Metadata } from 'next';
import type { SessionUser } from '@/lib/auth/session';
import { getCurrentUser } from '@/lib/auth/session';
import { redirect } from 'next/navigation';
import PromptsClient from './prompts-client';

export const metadata: Metadata = {
  title: 'AI Prompts | InsightHub Admin',
  description: 'View and edit the system prompts used by the AI dashboard builder',
};

export default async function PromptsPage() {
  // Auth-gate pattern — see src/app/admin/page.tsx for the full rationale.
  // Narrow try around getCurrentUser() only; redirects live outside so
  // Next.js's NEXT_REDIRECT can propagate. Plural `/dashboards` path.
  let user: SessionUser;
  try {
    user = await getCurrentUser();
  } catch {
    redirect('/dashboards?error=unauthorized');
  }

  if (user.role !== 'ADMIN') {
    redirect('/dashboards?error=access-denied');
  }

  return (
    <div className="min-h-screen bg-[var(--bg-primary)]">
      <div className="container mx-auto px-4 py-8 max-w-6xl">
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <a
              href="/admin"
              className="text-sm text-[var(--text-muted)] hover:text-[var(--text-secondary)] transition-colors"
            >
              Admin
            </a>
            <span className="text-[var(--text-muted)]">/</span>
            <h1 className="text-2xl font-bold text-[var(--text-primary)]">AI Prompts</h1>
          </div>
          <p className="text-[var(--text-secondary)]">
            View the full system prompt sent to the AI dashboard builder, and add custom instructions that get appended at runtime.
          </p>
        </div>

        <PromptsClient />
      </div>
    </div>
  );
}
