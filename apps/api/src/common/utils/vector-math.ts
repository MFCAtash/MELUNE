/**
 * Minimal dense-vector helpers for RecommendationsService. Deliberately
 * plain arithmetic (no ML library) — vectors here are small (a few dozen
 * dimensions: the genres/artists/moods a single user has actually
 * interacted with), so a dependency like `mathjs` or a Python service
 * would be overkill for what is a handful of multiplications per song.
 */

/** Cosine similarity of two equal-length vectors, in [-1, 1] (in practice
 *  [0, 1] here since every dimension we build is non-negative). Returns 0
 *  for a zero vector on either side instead of NaN/Infinity, so an
 *  all-unknown-features song never breaks the ranking. */
export function cosineSimilarity(a: readonly number[], b: readonly number[]): number {
  if (a.length !== b.length) {
    throw new Error(`cosineSimilarity: dimension mismatch (${a.length} vs ${b.length})`);
  }

  let dot = 0;
  let magA = 0;
  let magB = 0;

  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    magA += a[i] * a[i];
    magB += b[i] * b[i];
  }

  if (magA === 0 || magB === 0) return 0;
  return dot / (Math.sqrt(magA) * Math.sqrt(magB));
}

/** Element-wise weighted sum of vectors, e.g. building a user's taste
 *  profile as the weighted average of their liked/played songs. */
export function weightedAverage(vectors: readonly number[][], weights: readonly number[]): number[] {
  if (vectors.length === 0) return [];
  const dims = vectors[0].length;
  const sum = new Array<number>(dims).fill(0);
  let totalWeight = 0;

  for (let i = 0; i < vectors.length; i++) {
    const w = weights[i] ?? 1;
    totalWeight += w;
    for (let d = 0; d < dims; d++) {
      sum[d] += vectors[i][d] * w;
    }
  }

  if (totalWeight === 0) return sum;
  return sum.map((v) => v / totalWeight);
}
