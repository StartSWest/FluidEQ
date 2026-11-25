/* FluidEQ — GPL-3.0-or-later */
import {
  compactSearchText,
  foldSearchText,
  searchMarks,
  searchMatcher,
  searchTerms,
} from '../../../common/searchText';
import { normalizeForGrouping } from '../../../common/library/grouping';

it.each(['kpop', 'K POP', 'K-Pop', 'k‑pop', 'ＫＰＯＰ'])(
  'finds K-pop with %s',
  (query) => {
    const matches = searchMatcher(query);
    expect(matches('K-pop')).toBe(true);
    expect(matches('K pop')).toBe(true);
    expect(matches('Classical')).toBe(false);
  },
);

it.each([
  ['lofi', 'Lo-fi'],
  ['classic rock', 'Classic-Rock'],
  ['classicrock', 'Classic Rock'],
  ['cafe deja', 'Déjà Café'],
  ['hd600 sennheiser', 'Sennheiser HD-600'],
  ['razer v4pro', 'Razer Kraken V4 Pro'],
  ['クラシック', '音楽 クラシック'],
  ['рок', 'Музыка Рок'],
  ['संगीत', 'मेरा संगीत'],
  ['中文', '中文音樂'],
])('matches %s in %s', (query, text) => {
  expect(searchMatcher(query)(text)).toBe(true);
});

it('keeps non-Latin searches meaningful and preserves model numbers', () => {
  expect(searchMatcher('中文')('Rock')).toBe(false);
  expect(searchMatcher('संगीत')('सगत')).toBe(false);
  expect(searchMatcher('hd600')('Sennheiser HD 650')).toBe(false);
  expect(searchMatcher('v5pro')('Razer Kraken V4 Pro')).toBe(false);
  expect(foldSearchText('संगीत')).toBe('संगीत');
});

it('ignores separators in matching while album/artist identities retain spaces', () => {
  expect(compactSearchText('K — pop')).toBe('kpop');
  expect(searchMatcher('baladasvol1')('Baladas Vol 1')).toBe(true);
  expect(searchMatcher('baladasvol1')('Bala Dasvol1')).toBe(true);
  expect(normalizeForGrouping('Baladas Vol 1')).not.toBe(
    normalizeForGrouping('Bala Dasvol1'),
  );
});

/** The text a list would light for `query` in `text`. */
const lit = (text: string, query: string) =>
  searchMarks(text, searchTerms(query)).map(([start, end]) =>
    text.slice(start, end),
  );

it.each([
  ['Drum & bass', 'bass', ['bass']],
  ['Drum & bass', 'BASS drum', ['Drum', 'bass']],
  // Found across punctuation, the punctuation between is lit with it.
  ['Synth-pop', 'synthpop', ['Synth-pop']],
  ['Déjà Café', 'cafe', ['Café']],
  ['Музыка Рок', 'рок', ['Рок']],
])('lights in %s what %s found', (text, query, expected) => {
  expect(lit(text, query)).toEqual(expected);
});

it('merges overlapping words and lights nothing it did not find', () => {
  expect(lit('Pop Punk', 'jazz')).toEqual([]);
  expect(lit('Pop Punk', 'po pop')).toEqual(['Pop']);
  // A word that runs on over a space lights the space with it.
  expect(lit('Pop Punk', 'popp')).toEqual(['Pop P']);
  expect(lit('Pop Punk', '')).toEqual([]);
  // The control: the same text lights where the word is there.
  expect(lit('Pop Punk', 'punk')).toEqual(['Punk']);
});

it.each(['', '   ', ' — / '])(
  'keeps every row when %s contains no searchable letters',
  (query) => {
    expect(searchMatcher(query)('K-pop')).toBe(true);
    expect(searchMatcher(query)('中文音樂')).toBe(true);
  },
);
