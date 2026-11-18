'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';

export default function Sidebar({ sections, user, unread }) {
  const pathname = usePathname();
  const router = useRouter();

  async function logout() {
    await fetch('/api/auth/logout', { method: 'POST' });
    router.push('/login');
    router.refresh();
  }

  const isActive = (href) => pathname === href || (href !== '/dashboard' && pathname.startsWith(`${href}/`));

  return (
    <aside className="sidebar">
      <div className="brand">
        <div className="brand-logo">LF</div>
        <div>
          <div className="brand-name">Campus Lost &amp; Found</div>
          <div className="brand-sub">Smart matching system</div>
        </div>
      </div>

      {sections.map((section) => (
        <div key={section.title}>
          <div className="nav-section">{section.title}</div>
          {section.links.map((link) => (
            <Link key={link.href} href={link.href} className={`nav-link ${isActive(link.href) ? 'active' : ''}`}>
              <span>{link.label}</span>
              {link.href === '/notifications' && unread > 0 && <span className="nav-count">{unread}</span>}
            </Link>
          ))}
        </div>
      ))}

      <div className="sidebar-footer">
        <div className="user-name">{user.name}</div>
        <div className="tiny">{user.email}</div>
        <span className="role-pill">{user.role}</span>
        <div style={{ marginTop: 12 }}>
          <button className="btn btn-sm btn-secondary" onClick={logout}>Log out</button>
        </div>
      </div>
    </aside>
  );
}
