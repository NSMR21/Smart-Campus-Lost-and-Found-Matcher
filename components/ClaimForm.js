'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function ClaimForm({ foundId, lostReports, defaultLostId }) {
  const router = useRouter();
  const [lostId, setLostId] = useState(defaultLostId ? String(defaultLostId) : '');
  const [proof, setProof] = useState('');
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const res = await fetch('/api/claims', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ found_id: foundId, lost_id: lostId || null, proof_details: proof }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(data.error ?? 'Could not submit the claim');
      setBusy(false);
      return;
    }
    router.push(`/claims/${data.claim_id}?submitted=1`);
    router.refresh();
  }

  return (
    <form className="form" onSubmit={submit}>
      {error && <div className="alert alert-error">{error}</div>}
      <div className="field">
        <label htmlFor="lost">Link to your lost report (optional)</label>
        <select id="lost" value={lostId} onChange={(e) => setLostId(e.target.value)}>
          <option value="">No linked report</option>
          {lostReports.map((l) => <option key={l.lost_id} value={l.lost_id}>L-{l.lost_id} · {l.title}</option>)}
        </select>
      </div>
      <div className="field">
        <label htmlFor="proof">Proof of ownership</label>
        <textarea id="proof" value={proof} onChange={(e) => setProof(e.target.value)} required minLength={15}
          placeholder="Describe details that only the owner would know: contents, marks, wallpaper, serial number..." />
        <span className="hint">Staff compare this with the secret details recorded by the finder.</span>
      </div>
      <button className="btn btn-primary" disabled={busy}>{busy ? 'Submitting...' : 'Submit claim'}</button>
    </form>
  );
}
