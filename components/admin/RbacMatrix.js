'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function RbacMatrix({ roles, permissions, grants }) {
  const router = useRouter();
  const [granted, setGranted] = useState(new Set(grants));
  const [busy, setBusy] = useState(null);
  const [error, setError] = useState(null);

  async function toggle(roleId, permissionId) {
    const key = `${roleId}:${permissionId}`;
    const next = !granted.has(key);
    setBusy(key);
    setError(null);
    const res = await fetch('/api/admin/rbac', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ role_id: roleId, permission_id: permissionId, granted: next }),
    });
    const data = await res.json().catch(() => ({}));
    if (res.ok) {
      const copy = new Set(granted);
      if (next) copy.add(key); else copy.delete(key);
      setGranted(copy);
      router.refresh();
    } else {
      setError(data.error ?? 'Failed');
    }
    setBusy(null);
  }

  return (
    <div className="card">
      {error && <div className="alert alert-error" style={{ margin: 12 }}>{error}</div>}
      <div className="table-wrap"><table className="table matrix">
        <thead><tr><th>Permission</th>{roles.map((r) => <th key={r.role_id}>{r.role_name}</th>)}</tr></thead>
        <tbody>{permissions.map((p) => (
          <tr key={p.permission_id}>
            <td><div className="mono small bold">{p.permission_code}</div><div className="tiny muted">{p.description}</div></td>
            {roles.map((r) => {
              const key = `${r.role_id}:${p.permission_id}`;
              return (
                <td key={key}>
                  <input type="checkbox" checked={granted.has(key)} disabled={busy === key}
                    onChange={() => toggle(r.role_id, p.permission_id)} aria-label={`${r.role_name} ${p.permission_code}`} />
                </td>
              );
            })}
          </tr>))}</tbody>
      </table></div>
    </div>
  );
}
