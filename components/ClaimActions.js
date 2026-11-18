'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

async function send(url, body) {
  const res = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error ?? 'Request failed');
  return data;
}

export function VerifyPanel({ claimId }) {
  const router = useRouter();
  const [remarks, setRemarks] = useState('');
  const [busy, setBusy] = useState(null);
  const [error, setError] = useState(null);

  async function decide(decision) {
    setBusy(decision);
    setError(null);
    try {
      await send(`/api/claims/${claimId}/verify`, { decision, remarks });
      router.refresh();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="form">
      {error && <div className="alert alert-error">{error}</div>}
      <div className="field">
        <label htmlFor="remarks">Remarks</label>
        <textarea id="remarks" value={remarks} onChange={(e) => setRemarks(e.target.value)} maxLength={255}
          placeholder="What did you check? e.g. 'IMEI and lock screen matched'" style={{ minHeight: 70 }} />
      </div>
      <div className="row">
        <button className="btn btn-success" disabled={!!busy} onClick={() => decide('APPROVED')}>
          {busy === 'APPROVED' ? 'Approving...' : 'Approve claim'}</button>
        <button className="btn btn-danger" disabled={!!busy} onClick={() => decide('REJECTED')}>
          {busy === 'REJECTED' ? 'Rejecting...' : 'Reject claim'}</button>
      </div>
      <p className="tiny muted mt-0">Runs <code>CALL sp_verify_claim(...)</code>: a transaction that locks the claim and the item.
        Approving automatically rejects the other pending claims for this item (trigger).</p>
    </div>
  );
}

export function ReturnPanel({ claimId, highValue }) {
  const router = useRouter();
  const [idChecked, setIdChecked] = useState(false);
  const [remarks, setRemarks] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await send(`/api/claims/${claimId}/return`, { id_proof_checked: idChecked, remarks });
      router.refresh();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="form" onSubmit={submit}>
      {error && <div className="alert alert-error">{error}</div>}
      <label className="row small">
        <input type="checkbox" checked={idChecked} onChange={(e) => setIdChecked(e.target.checked)} />
        Student ID card checked {highValue && <span className="badge b-red">REQUIRED FOR HIGH-VALUE ITEMS</span>}
      </label>
      <div className="field">
        <label htmlFor="ret-remarks">Remarks</label>
        <input id="ret-remarks" value={remarks} onChange={(e) => setRemarks(e.target.value)} maxLength={255} />
      </div>
      <button className="btn btn-primary" disabled={busy}>{busy ? 'Saving...' : 'Record hand-over'}</button>
      <p className="tiny muted mt-0">Runs <code>CALL sp_record_return(...)</code>; trigger <code>trg_item_returns_after_insert</code> marks the
        item RETURNED, the lost report RECOVERED and notifies the owner and the finder.</p>
    </form>
  );
}
