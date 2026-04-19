import { Metadata } from 'next';
import { getCurrentUser } from '@/lib/auth/session';
import { redirect } from 'next/navigation';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'Admin Panel | InsightHub',
  description: 'System administration and configuration',
};

const ADMIN_SECTIONS = [
  {
    title: 'Users',
    description: 'Manage user accounts and assign roles',
    href: '/admin/users',
    icon: '👤',
    color: 'from-accent-blue/15 to-accent-blue/5 border-accent-blue/20',
  },
  {
    title: 'Permissions',
    description: 'Configure permission groups and data access levels',
    href: '/admin/permissions',
    icon: '🔒',
    color: 'from-accent-red/15 to-accent-red/5 border-accent-red/20',
  },
  {
    title: 'AI Prompts',
    description: 'View and edit the system prompts used by the AI dashboard builder',
    href: '/admin/prompts',
    icon: '🧠',
    color: 'from-accent-purple/15 to-accent-purple/5 border-accent-purple/20',
  },
  {
    title: 'System Settings',
    description: 'Feature flags, AI models, defaults, and maintenance mode',
    href: '/admin/settings',
    icon: '⚙️',
    color: 'from-accent-green/15 to-accent-green/5 border-accent-green/20',
  },
  {
    title: 'Templates',
    description: 'Manage dashboard templates available in the gallery',
    href: '/admin/templates',
    icon: '📋',
    color: 'from-accent-amber/15 to-accent-amber/5 border-accent-amber/20',
  },
  {
    title: 'Audit Log',
    description: 'View user actions, API calls, and security events',
    href: '/admin/audit',
    icon: '📜',
    color: 'from-accent-cyan/15 to-accent-cyan/5 border-accent-cyan/20',
  },
];

export default async function AdminPage() {
  try {
    const user = await getCurrentUser();

    if (user.role !== 'ADMIN') {
      redirect('/dashboard?error=access-denied');
    }

    return (
      <div className="min-h-screen bg-[var(--bg-primary)]">
        <div className="container mx-auto px-4 py-8 max-w-4xl">
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-[var(--text-primary)]">Admin Panel</h1>
            <p className="text-[var(--text-secondary)] mt-2">
              System administration for InsightHub. Signed in as <span className="font-medium text-[var(--text-primary)]">{user.name}</span> ({user.role}).
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {ADMIN_SECTIONS.map((section) => (
              <Link
                key={section.href}
                href={section.href}
                className={`group p-5 rounded-xl border bg-gradient-to-b ${section.color} transition-all hover:scale-[1.02] hover:shadow-lg`}
              >
                <div className="text-2xl mb-3">{section.icon}</div>
                <h3 className="text-sm font-semibold text-[var(--text-primary)] mb-1.5 group-hover:text-accent-blue transition-colors">
                  {section.title}
                </h3>
                <p className="text-xs leading-relaxed text-[var(--text-secondary)]">
                  {section.description}
                </p>
              </Link>
            ))}
          </div>
        </div>
      </div>
    );
  } catch (error) {
    console.error('Error loading admin page:', error);
    redirect('/dashboard?error=unauthorized');
  }
}
