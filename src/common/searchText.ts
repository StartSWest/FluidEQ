/* FluidEQ — GPL-3.0-or-later */

/** Search-only spelling. Never use this as an album, preset, or device ID. */
export const foldSearchText = (text: string): string =>
  text
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    // Marks outside the accent block belong to scripts such as Devanagari.
    // Dropping every non-ASCII character made those searches match nothing.
    .replace(/[^\p{L}\p{N}\p{M}\s]/gu, '')
    .replace(/\s+/g, ' ')
    .trim();

/** K-pop, K pop and kpop have the same searchable spelling. */
export const compactSearchText = (text: string): string =>
  foldSearchText(text).replace(/\s/g, '');

export const searchTerms = (query: string): readonly string[] =>
  foldSearchText(query).split(' ').filter(Boolean);

/** A prepared search index can reuse the same terms across thousands of rows. */
export const matchesSearchTerms = (
  searchable: string,
  terms: readonly string[],
): boolean => terms.every((term) => searchable.includes(term));

/** Prepare the query once; words can occur in any order in a row's fields. */
export const searchMatcher = (query: string): ((text: string) => boolean) => {
  const terms = searchTerms(query);
  return (text) => matchesSearchTerms(compactSearchText(text), terms);
};

/**
 * Where each term stands in `text`, as `[start, end)` spans of `text` itself,
 * in order and merged: what a list lights to show why a row was found.
 *
 * Folded a character at a time, as `compactSearchText` folds a whole string,
 * so every letter it keeps knows the character it came from. A term found
 * across punctuation ("synthpop" in "Synth-pop") lights the punctuation
 * between its letters too, so the mark reads as one word. A term only the
 * whole-string fold finds gets no mark; the row is still found.
 */
export const searchMarks = (
  text: string,
  terms: readonly string[],
): Array<[number, number]> => {
  let compact = '';
  const starts: number[] = [];
  const ends: number[] = [];
  let at = 0;
  Array.from(text).forEach((character) => {
    const folded = compactSearchText(character);
    for (let unit = 0; unit < folded.length; unit += 1) {
      starts.push(at);
      ends.push(at + character.length);
    }
    compact += folded;
    at += character.length;
  });
  const spans = terms
    .map((term) => ({ term, found: term ? compact.indexOf(term) : -1 }))
    .filter(({ found }) => found >= 0)
    .map(({ term, found }): [number, number] => [
      starts[found],
      ends[found + term.length - 1],
    ])
    .sort((a, b) => a[0] - b[0]);
  return spans.reduce<Array<[number, number]>>((merged, span) => {
    const last = merged[merged.length - 1];
    if (last !== undefined && span[0] <= last[1]) {
      last[1] = Math.max(last[1], span[1]);
    } else {
      merged.push([span[0], span[1]]);
    }
    return merged;
  }, []);
};
