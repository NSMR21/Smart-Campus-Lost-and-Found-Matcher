// Input validation for API requests. The database enforces the same rules
// with CHECK constraints and triggers; validating here gives friendlier messages.
import { HttpError } from './api.js';
import { COLORS } from './constants.js';

export function text(value, label, { min = 1, max = 255, optional = false } = {}) {
  const v = typeof value === 'string' ? value.trim() : '';
  if (!v) {
    if (optional) return null;
    throw new HttpError(400, `${label} is required.`);
  }
  if (v.length < min) throw new HttpError(400, `${label} must have at least ${min} characters.`);
  if (v.length > max) throw new HttpError(400, `${label} must have at most ${max} characters.`);
  return v;
}

export function id(value, label, { optional = false } = {}) {
  if ((value === null || value === undefined || value === '') && optional) return null;
  const n = Number(value);
  if (!Number.isInteger(n) || n <= 0) throw new HttpError(400, `${label} is required.`);
  return n;
}

export function date(value, label) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value) || Number.isNaN(Date.parse(value))) {
    throw new HttpError(400, `${label} must be a valid date.`);
  }
  return value;
}

export function color(value) {
  const v = String(value ?? 'other').toLowerCase();
  if (!COLORS.includes(v)) throw new HttpError(400, 'Unknown colour.');
  return v;
}

export function oneOf(value, allowed, label) {
  if (!allowed.includes(value)) throw new HttpError(400, `${label} must be one of ${allowed.join(', ')}.`);
  return value;
}

/** Common fields of a lost / found report. */
export function itemFields(body) {
  return {
    title: text(body.title, 'Title', { min: 3, max: 100 }),
    description: text(body.description, 'Description', { min: 10, max: 2000 }),
    category_id: id(body.category_id, 'Category'),
    location_id: id(body.location_id, 'Location'),
    color: color(body.color),
    brand: text(body.brand, 'Brand', { max: 40, optional: true }),
  };
}
