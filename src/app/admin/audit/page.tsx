import { getCurrentUser, isAdmin } from '@/lib/auth/session';
import { Navbar } from '@/components/layout/Navbar';
import { AuditLogClient } from './audit-client';
import { redirect } from 'next/navigation';

export default async function AuditLogPage() {
  const user = await getCurrentUser();

  if (!isAdmin(user)) {
    redirect('/dashboards');
  }

  return (
    <>
      <Navbar />
      <AuditLogClient />
    </>
  );
}