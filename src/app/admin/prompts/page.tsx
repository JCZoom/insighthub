import { Metadata } from 'next';
import { getCurrentUser } from '@/lib/auth/session';
import { redirect } from 'next/navigation';
import PromptsClient from './prompts-client';

export const metadata: Metadata = {
  title: 'AI Prompts | InsightHub Admin',
  description: 'View and edit the system prompts used by the AI dashboard builder',
};

export default async function PromptsPage() {
  try {
    const user = await getCurrentUser();

    if (user.role !== 'ADMIN') {
      redirect('/dashboard?error=access-denied');
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
  } catch (error) {
    console.error('Error loading prompts page:', error);
    redirect('/dashboard?error=unauthorized');
  }
}
