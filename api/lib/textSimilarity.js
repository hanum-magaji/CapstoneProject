/**
 * Shared lexical / surface-form similarity for clustering and conflict detection.
 */

const STOPWORDS = new Set([
  "the", "a", "an", "and", "or", "for", "to", "of", "in", "on", "at", "by", "as", "is", "are",
  "be", "been", "being", "shall", "must", "should", "could", "would", "may", "might", "that",
  "this", "these", "those", "with", "from", "into", "via", "per", "all", "any", "each",
]);

export function normalizeWords(text) {
  return String(text || "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length > 1 && !STOPWORDS.has(w));
}

export function wordSetJaccard(a, b) {
  const ta = new Set(normalizeWords(a));
  const tb = new Set(normalizeWords(b));
  if (ta.size === 0 && tb.size === 0) return 1;
  if (ta.size === 0 || tb.size === 0) return 0;
  let inter = 0;
  for (const w of ta) if (tb.has(w)) inter++;
  const union = ta.size + tb.size - inter;
  return union ? inter / union : 0;
}

export function charBigrams(text) {
  const s = String(text || "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
  if (s.length < 2) return new Set();
  const set = new Set();
  for (let i = 0; i < s.length - 1; i++) set.add(s.slice(i, i + 2));
  return set;
}

export function bigramJaccard(a, b) {
  const ba = charBigrams(a);
  const bb = charBigrams(b);
  if (ba.size === 0 && bb.size === 0) return 1;
  if (ba.size === 0 || bb.size === 0) return 0;
  let inter = 0;
  for (const x of ba) if (bb.has(x)) inter++;
  const union = ba.size + bb.size - inter;
  return union ? inter / union : 0;
}

/** Combined syntactic score in [0, 1] */
export function syntacticSimilarity(textA, textB) {
  return 0.55 * wordSetJaccard(textA, textB) + 0.45 * bigramJaccard(textA, textB);
}
