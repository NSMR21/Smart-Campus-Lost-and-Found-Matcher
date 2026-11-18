import Sidebar from '@/components/Sidebar';
import { requirePageSession, can } from '@/lib/auth';
import { getUnreadCount } from '@/lib/data';

// Navigation is built from the permissions the database grants the user's role.
function buildNav(session) {
  const sections = [
    {
      title: 'Overview',
      links: [
        { href: '/dashboard', label: 'Dashboard' },
        { href: '/notifications', label: 'Notifications' },
      ],
    },
    {
      title: 'Items',
      links: [
        { href: '/lost', label: 'Lost items' },
        { href: '/found', label: 'Found items' },
        { href: '/search', label: 'Smart search' },
        ...(can(session, 'REPORT_LOST') ? [{ href: '/lost/new', label: 'Report lost item' }] : []),
        ...(can(session, 'REPORT_FOUND') ? [{ href: '/found/new', label: 'Report found item' }] : []),
      ],
    },
    {
      title: 'Claims',
      links: [{ href: '/claims', label: can(session, 'CLAIM_VERIFY') ? 'Claims queue' : 'My claims' }],
    },
  ];

  const insights = [];
  if (can(session, 'REPORTS_VIEW')) insights.push({ href: '/reports', label: 'Reports & analytics' });
  if (can(session, 'SQL_LAB_VIEW')) insights.push({ href: '/sql-lab', label: 'SQL Lab' });
  if (insights.length) sections.push({ title: 'Insights', links: insights });

  const admin = [];
  if (can(session, 'USER_MANAGE')) admin.push({ href: '/admin/users', label: 'Users & roles' });
  if (can(session, 'RBAC_MANAGE')) admin.push({ href: '/admin/rbac', label: 'Permissions (RBAC)' });
  if (can(session, 'MASTER_DATA_MANAGE')) admin.push({ href: '/admin/master-data', label: 'Categories & locations' });
  if (can(session, 'VECTOR_DB_MANAGE')) admin.push({ href: '/admin/vector', label: 'Vector database' });
  if (can(session, 'AUDIT_VIEW')) admin.push({ href: '/admin/audit', label: 'Audit log' });
  if (admin.length) sections.push({ title: 'Administration', links: admin });
  return sections;
}

export default async function AppLayout({ children }) {
  const session = await requirePageSession();
  const unread = await getUnreadCount(session.userId);
  return (
    <div className="shell">
      <Sidebar sections={buildNav(session)} unread={unread}
        user={{ name: session.name, email: session.email, role: session.role }} />
      <main className="main">{children}</main>
    </div>
  );
}
