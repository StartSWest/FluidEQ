/*
<AQUA: System-wide parametric audio equalizer interface>
Copyright (C) <2023>  <AQUA Dev Team>
Copyright (C) <2026>  <Ivan Carmenates Garcia>

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU General Public License as published by
the Free Software Foundation, either version 3 of the License, or
(at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
GNU General Public License for more details.

You should have received a copy of the GNU General Public License
along with this program.  If not, see <https://www.gnu.org/licenses/>.
*/

import {
  MAX_SEARCH_HISTORY,
  forgetSearch,
  rememberSearch,
  suggestSearches,
} from 'common/searchHistory';

describe('remembering a search', () => {
  it('puts the newest first', () => {
    expect(rememberSearch(['first'], 'second')).toEqual(['second', 'first']);
  });

  it('moves a repeat to the front rather than duplicating it', () => {
    // Searching the same thing twice is evidence it matters, not a reason to
    // have it in the list twice.
    expect(rememberSearch(['a', 'b', 'c'], 'c')).toEqual(['c', 'a', 'b']);
  });

  it('treats a repeat as the same however it was capitalised', () => {
    const history = rememberSearch(['Hotel California'], 'hotel california');
    expect(history).toHaveLength(1);
    // The newest spelling wins: it is what was typed most recently.
    expect(history[0]).toBe('hotel california');
  });

  it('tidies whitespace so two spellings of one search are one entry', () => {
    expect(rememberSearch([], '  dark   side  ')).toEqual(['dark side']);
  });

  it('ignores an empty search', () => {
    expect(rememberSearch(['a'], '   ')).toEqual(['a']);
  });

  it('drops the oldest once it is full', () => {
    // A search from a month ago that has not been repeated since is the right
    // one to lose.
    let history: string[] = [];
    for (let i = 0; i < MAX_SEARCH_HISTORY + 5; i += 1) {
      history = rememberSearch(history, `search ${i}`);
    }
    expect(history).toHaveLength(MAX_SEARCH_HISTORY);
    expect(history[0]).toBe(`search ${MAX_SEARCH_HISTORY + 4}`);
    expect(history).not.toContain('search 0');
  });
});

describe('forgetting a search', () => {
  it('removes just that one, whatever its case', () => {
    expect(forgetSearch(['Alpha', 'Beta'], 'alpha')).toEqual(['Beta']);
  });

  it('leaves the list alone when there is nothing to remove', () => {
    expect(forgetSearch(['Alpha'], 'gamma')).toEqual(['Alpha']);
  });
});

describe('suggesting searches', () => {
  const history = [
    'dark side of the moon',
    'in the dark',
    'daft punk discovery',
    'bohemian rhapsody',
  ];

  it('offers the most recent when nothing has been typed', () => {
    // The case that saves the most typing: somebody who has just opened the
    // tab usually wants what they were playing yesterday.
    expect(suggestSearches(history, '', 2)).toEqual([
      'dark side of the moon',
      'in the dark',
    ]);
  });

  it('puts what starts with the query above what merely contains it', () => {
    // Typing "dark" almost always means "dark side of the moon" rather than
    // "in the dark", so the answer should be the first row.
    expect(suggestSearches(history, 'dark')).toEqual([
      'dark side of the moon',
      'in the dark',
    ]);
  });

  it('ignores case', () => {
    expect(suggestSearches(history, 'BOHEMIAN')).toEqual(['bohemian rhapsody']);
  });

  it('does not offer back exactly what has been typed', () => {
    // A row that puts the same text in the box is a row that does nothing.
    expect(suggestSearches(history, 'in the dark')).not.toContain(
      'in the dark',
    );
  });

  it('offers nothing when nothing matches', () => {
    expect(suggestSearches(history, 'zzzz')).toEqual([]);
  });

  it('keeps the list short enough not to cover the page', () => {
    const many = Array.from({ length: 30 }, (_v, i) => `track ${i}`);
    expect(suggestSearches(many, 'track', 6)).toHaveLength(6);
  });
});
