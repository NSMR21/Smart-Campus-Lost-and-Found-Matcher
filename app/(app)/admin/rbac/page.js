import { requirePageSession } from '@/lib/auth';
import { getRbacMatrix } from '@/lib/data';
import RbacMatrix from '@/components/admin/RbacMatrix';
import { PageHeader } from '@/components/ui';

export const metadata = { title: 'Permissions - Campus Lost & Found' };

export default async function RbacPage() {
  await requirePageSession('RBAC_MANAGE');
  const { roles, permissions, grants } = await getRbacMatrix();
  return (
    <>
      <PageHeader title="Role-based access control"
        subtitle="Rows of the role_permissions table. Every API call and stored procedure checks fn_has_permission(), so a change here takes effect on the next request." />
      <div className="alert alert-info small" style={{ marginBottom: 16 }}>
        Try it: untick <b>CLAIM_VERIFY</b> for STAFF, then sign in as staff and approve a claim. The stored procedure
        <code> sp_verify_claim</code> refuses with &quot;Permission denied&quot;, and so does the trigger on <code>verifications</code>.
      </div>
      <RbacMatrix roles={roles} permissions={permissions} grants={grants} />
    </>
  );
}
