'use client';

import { useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';

// Seeded demo accounts (see db/06_seed.sql). All use the same demo password.
const DEMO_PASSWORD = 'Password@123';
const DEMO_ACCOUNTS = [
  { label: 'Student', email: 'mukesh@pes.edu' },
  { label: 'Student 2', email: 'rushieswar@pes.edu' },
  { label: 'Staff', email: 'staff@pes.edu' },
  { label: 'Admin', email: 'admin@pes.edu' },
];

async function post(url, body) {
  const res = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error ?? 'Request failed');
  return data;
}

export function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await post('/api/auth/login', { email, password });
      const next = params.get('next');
      router.push(next && next.startsWith('/') && !next.startsWith('//') ? next : '/dashboard');
      router.refresh();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="form" onSubmit={submit}>
      {params.get('expired') && !error && <div className="alert alert-warning">Your session has ended. Please sign in again.</div>}
      {error && <div className="alert alert-error">{error}</div>}
      <div className="field">
        <label htmlFor="email">Email</label>
        <input id="email" type="email" autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} required />
      </div>
      <div className="field">
        <label htmlFor="password">Password</label>
        <input id="password" type="password" autoComplete="current-password" value={password}
          onChange={(e) => setPassword(e.target.value)} required />
      </div>
      <button className="btn btn-primary" disabled={busy}>{busy ? 'Signing in...' : 'Sign in'}</button>
      <div className="demo-accounts muted">
        Demo accounts:
        <div>
          {DEMO_ACCOUNTS.map((a) => (
            <button key={a.email} type="button" className="btn btn-ghost btn-sm"
              onClick={() => { setEmail(a.email); setPassword(DEMO_PASSWORD); }}>
              {a.label}
            </button>
          ))}
        </div>
      </div>
      <p className="small muted">New student? <Link href="/register">Create an account</Link></p>
    </form>
  );
}

export function RegisterForm({ departments }) {
  const router = useRouter();
  const [form, setForm] = useState({ full_name: '', email: '', phone: '', srn: '', dept_id: '', year_of_study: '1', password: '' });
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);
  const set = (key) => (e) => setForm({ ...form, [key]: e.target.value });

  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await post('/api/auth/register', form);
      router.push('/dashboard');
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
      <div className="field"><label>Full name</label><input value={form.full_name} onChange={set('full_name')} required /></div>
      <div className="grid grid-2">
        <div className="field"><label>College email</label><input type="email" value={form.email} onChange={set('email')} required /></div>
        <div className="field"><label>Phone (optional)</label><input value={form.phone} onChange={set('phone')} placeholder="10 digits" /></div>
      </div>
      <div className="grid grid-2">
        <div className="field">
          <label>SRN</label>
          <input value={form.srn} onChange={set('srn')} placeholder="PES1UG24AM170" required />
        </div>
        <div className="field">
          <label>Year of study</label>
          <select value={form.year_of_study} onChange={set('year_of_study')}>
            {[1, 2, 3, 4].map((y) => <option key={y} value={y}>{y}</option>)}
          </select>
        </div>
      </div>
      <div className="field">
        <label>Department</label>
        <select value={form.dept_id} onChange={set('dept_id')} required>
          <option value="">Select...</option>
          {departments.map((d) => <option key={d.dept_id} value={d.dept_id}>{d.dept_name}</option>)}
        </select>
      </div>
      <div className="field">
        <label>Password</label>
        <input type="password" autoComplete="new-password" value={form.password} onChange={set('password')} required />
        <span className="hint">At least 8 characters with letters and numbers. Stored only as a bcrypt hash.</span>
      </div>
      <button className="btn btn-primary" disabled={busy}>{busy ? 'Creating account...' : 'Create account'}</button>
      <p className="small muted">Already registered? <Link href="/login">Sign in</Link></p>
    </form>
  );
}
