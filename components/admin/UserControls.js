'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function UserControls({ user, roles, isSelf }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  async function patch(body) {
    setBusy(true);
    setError(null);
    const res = await fetch(`/api/admin/users/${user.user_id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) setError(data.error ?? 'Failed');
    setBusy(false);
    router.refresh();
  }

  return (
    <div className="row">
      <select value={user.role_name} disabled={busy} style={{ width: 'auto' }}
        onChange={(e) => patch({ role: e.target.value })}>
        {roles.map((r) => <option key={r} value={r}>{r}</option>)}
      </select>
      {!isSelf && (
        <button className={`btn btn-sm ${user.is_active ? 'btn-ghost' : 'btn-secondary'}`} disabled={busy}
          onClick={() => patch({ is_active: !user.is_active })}>
          {user.is_active ? 'Deactivate' : 'Activate'}
        </button>
      )}
      {error && <span className="small" style={{ color: 'var(--danger)' }}>{error}</span>}
    </div>
  );
}
