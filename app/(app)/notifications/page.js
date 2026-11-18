import Link from 'next/link';
import { requirePageSession } from '@/lib/auth';
import { getNotifications } from '@/lib/data';
import ActionButton from '@/components/ActionButton';
import { PageHeader, Empty, formatDateTime } from '@/components/ui';

export const metadata = { title: 'Notifications - Campus Lost & Found' };

const TYPE_STYLE = { MATCH: 'b-violet', CLAIM: 'b-amber', VERIFICATION: 'b-indigo', RETURN: 'b-green', SYSTEM: 'b-gray' };

export default async function NotificationsPage() {
  const session = await requirePageSession();
  const items = await getNotifications(session.userId, 100);
  const unread = items.filter((n) => !n.is_read).length;

  return (
    <>
      <PageHeader title="Notifications" subtitle="Created automatically by database triggers when something changes.">
        {unread > 0 && <ActionButton url="/api/notifications" label={`Mark ${unread} as read`} />}
      </PageHeader>
      <div className="card">
        {items.length === 0 ? <Empty>No notifications yet.</Empty> : items.map((n) => (
          <div key={n.notification_id} className={`notif ${n.is_read ? '' : 'unread'}`}>
            <span className={`badge ${TYPE_STYLE[n.notif_type]}`} style={{ alignSelf: 'flex-start' }}>{n.notif_type}</span>
            <div style={{ flex: 1 }}>
              <div className={n.is_read ? '' : 'bold'}>{n.message}</div>
              <div className="tiny muted">{formatDateTime(n.created_at)}</div>
            </div>
            {n.link && <Link className="btn btn-sm btn-secondary" href={n.link}>Open</Link>}
          </div>
        ))}
      </div>
    </>
  );
}
