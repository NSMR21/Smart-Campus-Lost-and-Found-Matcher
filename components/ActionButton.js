'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

/**
 * Button that calls one API endpoint and then refreshes (or navigates).
 * Used for small actions: dismiss a match, run matching, withdraw a claim, delete...
 */
export default function ActionButton({
  url, method = 'POST', body, label, busyLabel = 'Working...', className = 'btn btn-secondary btn-sm',
  confirmText, redirectTo, showResult = false,
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState(null);

  async function run() {
    if (confirmText && !window.confirm(confirmText)) return;
    setBusy(true);
    setMessage(null);
    try {
      const res = await fetch(url, {
        method,
        headers: body ? { 'Content-Type': 'application/json' } : undefined,
        body: body ? JSON.stringify(body) : undefined,
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setMessage({ type: 'error', text: data.error ?? 'Request failed' });
        return;
      }
      if (showResult && data.message) setMessage({ type: 'success', text: data.message });
      if (redirectTo) router.push(redirectTo);
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <span className="row" style={{ display: 'inline-flex' }}>
      <button className={className} onClick={run} disabled={busy}>{busy ? busyLabel : label}</button>
      {message && <span className={`small ${message.type === 'error' ? '' : 'muted'}`}
        style={{ color: message.type === 'error' ? 'var(--danger)' : undefined }}>{message.text}</span>}
    </span>
  );
}
