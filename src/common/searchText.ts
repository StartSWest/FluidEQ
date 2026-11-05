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
