import { requirePageSession } from '@/lib/auth';
import { listUsers } from '@/lib/data';
import { ROLES } from '@/lib/constants';
import UserControls from '@/components/admin/UserControls';
import { PageHeader, StatusBadge, formatDate } from '@/components/ui';

export const metadata = { title: 'Users & roles - Campus Lost & Found' };

export default async function UsersPage() {
  const session = await requirePageSession('USER_MANAGE');
  const users = await listUsers();
  return (
    <>
      <PageHeader title="Users & roles"
        subtitle="Changing a role calls sp_change_user_role (transaction; refuses to remove the last admin). Permissions follow the role immediately." />
      <div className="card"><div className="table-wrap"><table className="table">
        <thead><tr><th>User</th><th>Profile</th><th>Reports</th><th>Joined</th><th>Last login</th><th>Status</th><th>Role</th></tr></thead>
        <tbody>{users.map((u) => (
          <tr key={u.user_id} style={{ opacity: u.is_active ? 1 : 0.55 }}>
            <td><div className="bold">{u.full_name}</div><div className="tiny muted">{u.email}</div></td>
            <td className="small">{u.srn ? <>{u.srn} <span className="muted">· {u.dept_code}</span></> : u.designation ?? <span className="muted">-</span>}</td>
            <td className="small">{u.lost_reports} lost · {u.found_reports} found</td>
            <td className="small nowrap">{formatDate(u.created_at)}</td>
            <td className="small nowrap">{u.last_login_at ? formatDate(u.last_login_at) : <span className="muted">never</span>}</td>
            <td>{u.is_active ? <span className="badge b-green">ACTIVE</span> : <span className="badge b-gray">INACTIVE</span>}</td>
            <td><div className="row"><StatusBadge status={u.role_name} />
              <UserControls user={{ user_id: u.user_id, role_name: u.role_name, is_active: Boolean(u.is_active) }}
                roles={ROLES} isSelf={u.user_id === session.userId} /></div></td>
          </tr>))}</tbody>
      </table></div></div>
    </>
  );
}
