'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';

const today = () => new Date().toISOString().slice(0, 10);

/** Create or edit a lost / found report. */
export default function ItemReportForm({ kind, meta, initial, itemId }) {
  const router = useRouter();
  const isFound = kind === 'found';
  const dateKey = isFound ? 'found_date' : 'lost_date';
  const [form, setForm] = useState({
    title: initial?.title ?? '',
    description: initial?.description ?? '',
    category_id: initial?.category_id ?? '',
    location_id: initial?.location_id ?? '',
    color: initial?.color ?? 'black',
    brand: initial?.brand ?? '',
    [dateKey]: initial?.[dateKey] ?? today(),
    held_at_id: initial?.held_at_id ?? '',
    hidden_marks: initial?.hidden_marks ?? '',
  });
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);
  const set = (key) => (e) => setForm({ ...form, [key]: e.target.value });

  const byBuilding = useMemo(() => {
    const groups = new Map();
    for (const l of meta.locations) {
      if (!groups.has(l.building_name)) groups.set(l.building_name, []);
      groups.get(l.building_name).push(l);
    }
    return [...groups.entries()];
  }, [meta.locations]);
  const collectionPoints = meta.locations.filter((l) => l.is_collection_point);

  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const url = itemId ? `/api/${kind}/${itemId}` : `/api/${kind}`;
      const res = await fetch(url, {
        method: itemId ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? 'Could not save the report');
      const id = itemId ?? data[`${kind}_id`];
      router.push(`/${kind}/${id}?saved=1&matches=${data.matches ?? 0}`);
      router.refresh();
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  }

  return (
    <form className="form card card-body" onSubmit={submit}>
      {error && <div className="alert alert-error">{error}</div>}
      <div className="field">
        <label htmlFor="title">Item name</label>
        <input id="title" value={form.title} onChange={set('title')} maxLength={100} required
          placeholder={isFound ? 'e.g. Black wallet near the bus bay' : 'e.g. Blue Wildcraft backpack'} />
      </div>
      <div className="field">
        <label htmlFor="description">Description</label>
        <textarea id="description" value={form.description} onChange={set('description')} required minLength={10}
          placeholder={isFound
            ? 'What does it look like? Where exactly was it? Do not reveal everything - keep some details secret.'
            : 'Describe the item: brand, colour, stickers, contents, scratches... The more detail, the better the match.'} />
        <span className="hint">This text is embedded into the vector database and compared with other reports.</span>
      </div>
      <div className="grid grid-3">
        <div className="field">
          <label htmlFor="category">Category</label>
          <select id="category" value={form.category_id} onChange={set('category_id')} required>
            <option value="">Select...</option>
            {meta.categories.map((c) => (
              <option key={c.category_id} value={c.category_id}>{'  '.repeat(c.depth)}{c.category_name}</option>
            ))}
          </select>
        </div>
        <div className="field">
          <label htmlFor="color">Main colour</label>
          <select id="color" value={form.color} onChange={set('color')}>
            {meta.colors.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
        <div className="field">
          <label htmlFor="brand">Brand (optional)</label>
          <input id="brand" value={form.brand ?? ''} onChange={set('brand')} maxLength={40} />
        </div>
      </div>
      <div className="grid grid-2">
        <div className="field">
          <label htmlFor="location">{isFound ? 'Where did you find it?' : 'Where did you last see it?'}</label>
          <select id="location" value={form.location_id} onChange={set('location_id')} required>
            <option value="">Select...</option>
            {byBuilding.map(([building, locs]) => (
              <optgroup key={building} label={building}>
                {locs.map((l) => <option key={l.location_id} value={l.location_id}>{l.location_name}</option>)}
              </optgroup>
            ))}
          </select>
        </div>
        <div className="field">
          <label htmlFor="date">{isFound ? 'Date found' : 'Date lost'}</label>
          <input id="date" type="date" max={today()} value={form[dateKey]} onChange={set(dateKey)} required />
        </div>
      </div>
      {isFound && (
        <div className="grid grid-2">
          <div className="field">
            <label htmlFor="held">Handed in at</label>
            <select id="held" value={form.held_at_id} onChange={set('held_at_id')} required>
              <option value="">Select collection point...</option>
              {collectionPoints.map((l) => <option key={l.location_id} value={l.location_id}>{l.full_name}</option>)}
            </select>
            <span className="hint">Please drop the item at this desk.</span>
          </div>
          <div className="field">
            <label htmlFor="hidden">Secret identifying details (optional)</label>
            <input id="hidden" value={form.hidden_marks ?? ''} onChange={set('hidden_marks')} maxLength={255}
              placeholder="e.g. name inside, wallpaper, serial number" />
            <span className="hint">Only staff can see this; it is used to verify claims.</span>
          </div>
        </div>
      )}
      <div className="row">
        <button className="btn btn-primary" disabled={busy}>
          {busy ? 'Saving and matching...' : itemId ? 'Save changes' : 'Submit report'}
        </button>
        <button type="button" className="btn btn-ghost" onClick={() => router.back()}>Cancel</button>
      </div>
    </form>
  );
}
