/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import parseLibraryRequest from '../../../main/library/libraryRequestGuard';

const query = { shelf: 'tracks', scope: {}, direction: 'asc' };

describe('a question from the window', () => {
  it('passes every kind of question the store answers', () => {
    const questions = [
      { type: 'page', query, offset: 0, limit: 100 },
      { type: 'position', query, id: 'abc' },
      { type: 'letters', query },
      { type: 'ids', query, offset: 10, limit: 200 },
      { type: 'tracks', ids: ['a', 'b'] },
      { type: 'continuation', seedId: 'a', exclude: ['b'], count: 10 },
      { type: 'surprise', playing: 'a', awayFrom: ['a', 'c'], exclude: ['b'] },
      // Nothing playing yet: the first surprise of a session.
      { type: 'surprise', awayFrom: [], exclude: [] },
      { type: 'coverDeck', count: 20, exclude: ['a1b2c3'] },
      { type: 'duration', ids: ['a'] },
      { type: 'headings', query: { ...query, folderHeadings: true } },
      { type: 'rest', query, afterId: 'a', exclude: [] },
    ];
    questions.forEach((question) => {
      expect(parseLibraryRequest(question)).toEqual(question);
    });
  });

  it('refuses what is not one, rather than answering it wrongly', () => {
    const refused = [
      undefined,
      'page',
      { type: 'drop table' },
      { type: 'page', query, offset: 0, limit: 100000 },
      { type: 'page', query, offset: -1, limit: 10 },
      {
        type: 'page',
        query: { ...query, shelf: 'everything' },
        offset: 0,
        limit: 10,
      },
      {
        type: 'page',
        query: { ...query, sort: 'price' },
        offset: 0,
        limit: 10,
      },
      {
        type: 'page',
        query: { ...query, direction: 'up' },
        offset: 0,
        limit: 10,
      },
      {
        type: 'page',
        query: { ...query, scope: { kind: 'image' } },
        offset: 0,
        limit: 10,
      },
      {
        type: 'page',
        query: { ...query, search: 'x'.repeat(501) },
        offset: 0,
        limit: 10,
      },
      { type: 'tracks', ids: [1, 2] },
      { type: 'continuation', seedId: 'a', exclude: [], count: 1000 },
      { type: 'surprise', playing: 7, awayFrom: [], exclude: [] },
      { type: 'surprise', awayFrom: 'a', exclude: [] },
      { type: 'surprise', awayFrom: [], exclude: [null] },
      { type: 'surprise', awayFrom: [] },
      // A gallery is not a deck.
      { type: 'coverDeck', count: 65, exclude: [] },
      { type: 'coverDeck', count: 20, exclude: 'a1b2c3' },
    ];
    refused.forEach((question) => {
      expect(parseLibraryRequest(question)).toBeUndefined();
    });
  });
});
