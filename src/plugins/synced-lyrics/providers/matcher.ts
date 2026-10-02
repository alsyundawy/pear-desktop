import { jaroWinkler } from '@skyra/jaro-winkler';

/**
 * Removes noise commonly found in YouTube Music video titles, such as
 * "(Official Music Video)", "[MV]", "(feat. ...)", etc.
 */
export function cleanTitle(title?: string | null): string {
  if (!title) return '';
  return title
    .replace(
      /\[(?:official\s*)?(?:music\s*)?(?:video|audio|mv|lyric|lyrics|visualizer)?\]/gi,
      '',
    )
    .replace(
      /\((?:official\s*)?(?:music\s*)?(?:video|audio|mv|lyric|lyrics|live|remastered|version|visualizer)?\)/gi,
      '',
    )
    .replace(
      /\b(?:official\s+music\s+video|official\s+video|official\s+audio|music\s+video|lyric\s+video|audio)\b/gi,
      '',
    )
    .trim();
}

/**
 * Normalizes text for resilient phonetic and character similarity comparison.
 * Strips diacritics, punctuation, symbols, and extra whitespace.
 */
export function normalizeText(str?: string | null): string {
  if (!str) return '';
  return str
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Tokenizes text into distinct normalized words, filtering out empty entries.
 */
function getWords(str: string): string[] {
  return normalizeText(str)
    .split(' ')
    .filter((w) => w.length > 0);
}

/**
 * Checks if words of query are substantially contained in target or vice-versa.
 */
function wordOverlapScore(a: string, b: string): number {
  const wordsA = getWords(a);
  const wordsB = getWords(b);
  if (wordsA.length === 0 || wordsB.length === 0) return 0;

  const setB = new Set(wordsB);
  let matched = 0;
  for (const w of wordsA) {
    if (setB.has(w)) matched++;
  }

  const recallA = matched / wordsA.length;
  const recallB = matched / wordsB.length;
  return Math.max(recallA, recallB);
}

/**
 * Strict song and artist matching engine to prevent cross-language
 * and completely mismatched lyrics from displaying.
 */
export function isSongMatch(
  queryTitle: string,
  queryAltTitle: string | undefined,
  queryArtist: string,
  resultTitle: string,
  resultArtist: string,
): boolean {
  const qT = normalizeText(cleanTitle(queryTitle));
  const qAlt = normalizeText(cleanTitle(queryAltTitle));
  const qA = normalizeText(queryArtist);

  const rT = normalizeText(cleanTitle(resultTitle));
  const rA = normalizeText(resultArtist);

  if (!rT || (!qT && !qAlt)) return false;

  // Title similarity scoring
  const titleScores = [jaroWinkler(qT, rT)];
  if (qAlt) {
    titleScores.push(jaroWinkler(qAlt, rT));
  }

  // Word overlap scoring
  const overlapQ = wordOverlapScore(qT, rT);
  if (
    overlapQ >= 0.8 &&
    Math.min(qT.length, rT.length) / Math.max(qT.length, rT.length) >= 0.4
  ) {
    titleScores.push(0.85);
  }
  if (qAlt) {
    const overlapAlt = wordOverlapScore(qAlt, rT);
    if (
      overlapAlt >= 0.8 &&
      Math.min(qAlt.length, rT.length) / Math.max(qAlt.length, rT.length) >= 0.4
    ) {
      titleScores.push(0.85);
    }
  }

  const maxTitleScore = Math.max(...titleScores);

  // If title similarity is below 0.75, it is a mismatched track
  if (maxTitleScore < 0.75) {
    return false;
  }

  // Artist similarity scoring
  const genericArtists = new Set([
    '',
    'various',
    'various artists',
    'unknown',
    'unknown artist',
    'va',
    'lagu anak',
    'lagu anak indonesia',
  ]);

  if (qA && rA && !genericArtists.has(qA)) {
    const qArtists = qA
      .split(/[&,]/g)
      .map((s) => s.trim())
      .filter(Boolean);
    const rArtists = rA
      .split(/[&,]/g)
      .map((s) => s.trim())
      .filter(Boolean);

    const artistScores: number[] = [jaroWinkler(qA, rA)];

    const overlapArtist = wordOverlapScore(qA, rA);
    if (overlapArtist >= 0.5) {
      artistScores.push(0.8);
    }

    for (const a of qArtists) {
      for (const b of rArtists) {
        artistScores.push(jaroWinkler(a, b));
        const abOverlap = wordOverlapScore(a, b);
        if (abOverlap >= 0.5) {
          artistScores.push(0.8);
        }
      }
    }

    const maxArtistScore = Math.max(...artistScores);

    // If title is an exact/near-exact match (>= 0.92), allow slightly broader artist match
    if (maxTitleScore >= 0.92) {
      return maxArtistScore >= 0.55;
    }

    return maxArtistScore >= 0.65;
  }

  // If query artist is generic/unknown, require high title confidence
  return maxTitleScore >= 0.85;
}
