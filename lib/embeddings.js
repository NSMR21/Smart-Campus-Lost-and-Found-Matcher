// Converts item text into 384-dimensional vectors for the vector database.
//
// Default: the sentence-transformer model all-MiniLM-L6-v2 running locally
// through ONNX (downloaded once into .cache/models, about 23 MB).
// Fallback: a deterministic hashed n-gram embedding that needs no download,
// used when EMBEDDING_MODE=hash or when the model cannot be loaded (offline).
import path from 'node:path';

export const EMBEDDING_DIM = 384;
export const TRANSFORMER_MODEL = 'Xenova/all-MiniLM-L6-v2';
export const HASH_MODEL = 'hash-ngram-384';

const state = globalThis.__lfEmbeddings ?? (globalThis.__lfEmbeddings = { extractor: null, fallback: false });

async function loadTransformer() {
  const { pipeline, env } = await import('@huggingface/transformers');
  env.cacheDir = path.join(process.cwd(), '.cache', 'models');
  return pipeline('feature-extraction', TRANSFORMER_MODEL, { dtype: 'fp32' });
}

/** Text used to describe an item in the vector space. */
export function itemText(item) {
  return `${item.title}. ${item.description}`.replace(/\s+/g, ' ').trim();
}

/** @returns {Promise<{model: string, vectors: number[][]}>} */
export async function embedTexts(texts) {
  const wantTransformer = (process.env.EMBEDDING_MODE ?? 'transformer') !== 'hash';
  if (wantTransformer && !state.fallback) {
    try {
      state.extractor ??= loadTransformer();
      const extractor = await state.extractor;
      const output = await extractor(texts, { pooling: 'mean', normalize: true });
      return { model: TRANSFORMER_MODEL, vectors: output.tolist() };
    } catch (err) {
      console.warn(`[embeddings] ${TRANSFORMER_MODEL} unavailable (${err.message}); using ${HASH_MODEL}`);
      state.extractor = null;
      state.fallback = true;
    }
  }
  return { model: HASH_MODEL, vectors: texts.map(hashEmbed) };
}

export async function embedText(text) {
  const { model, vectors } = await embedTexts([text]);
  return { model, vector: vectors[0] };
}

/** Cosine similarity of two L2-normalised vectors, clamped to 0..1. */
export function similarity(a, b) {
  let dot = 0;
  for (let i = 0; i < a.length; i++) dot += a[i] * b[i];
  return Math.max(0, Math.min(1, dot));
}

// ---------------------------------------------------------------- offline fallback
const STOP_WORDS = new Set(('a an and are as at be by for from has have in is it its my of on or the this to was with ' +
  'i me we our found lost near left inside').split(' '));

function fnv1a(text) {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

function hashEmbed(text) {
  const vector = new Array(EMBEDDING_DIM).fill(0);
  const add = (feature, weight) => {
    const h = fnv1a(feature);
    vector[h % EMBEDDING_DIM] += (fnv1a(`#${feature}`) & 1 ? 1 : -1) * weight;
  };
  const words = text.toLowerCase().replace(/[^a-z0-9\s]/g, ' ').split(/\s+/)
    .filter((w) => w.length > 1 && !STOP_WORDS.has(w));
  words.forEach((word, i) => {
    add(`w:${word}`, 1);
    if (i > 0) add(`b:${words[i - 1]}_${word}`, 0.5);
    const padded = `^${word}$`;
    for (let j = 0; j + 3 <= padded.length; j++) add(`c:${padded.slice(j, j + 3)}`, 0.25);
  });
  const norm = Math.hypot(...vector) || 1;
  return vector.map((x) => x / norm);
}
