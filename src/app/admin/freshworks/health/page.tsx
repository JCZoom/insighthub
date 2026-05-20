import { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { getCurrentUser, isAdmin } from '@/lib/auth/session';
import { Navbar } from '@/components/layout/Navbar';
import { FreshworksHealthClient } from './health-client';

export const metadata: Metadata = {
  title: 'Freshworks Health | InsightHub Admin',
  description:
    'Per-source data-integrity probe across all 17 Freshworks dashboard sources.',
};

/**
 * Freshworks Health page — admin only.
 *
 * The companion to `/admin/freshworks/diagnostics` (connector state). Where
 * diagnostics answers "is the connector configured?", this page answers "is
 * the data we're showing on dashboards actually correct?" by exercising every
 * registered source and flagging the smells the eye doesn't catch:
 *   - sources returning zero rows
 *   - count widgets that collapsed everything into one bucket (parsing bug)
 *   - every row's timestamp / duration field being null (field-name mismatch)
 *   - status fields stuck at 'unknown' across all rows
 *
 * The probe is initiated by the client component on mount and on the
 * "Refresh" button. Server-side rendering on first paint kept simple
 * (skeleton table) so we don't block on the slowest upstream API.
 */
export default async function FreshworksHealthPage() {
  let user;
  try {
    user = await getCurrentUser();
  } catch {
    redirect('/dashboards?error=unauthorized');
  }
  if (!isAdmin(user)) {
    redirect('/dashboards?error=access-denied');
  }

  return (
    <>
      <Navbar />
      <FreshworksHealthClient />
    </>
  );
}
