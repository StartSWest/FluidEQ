/* Copyright (C) 2026 Ivan Carmenates Garcia. SPDX-License-Identifier: GPL-3.0-or-later */

/**
 * What the look picker shows, as three questions kept apart (Ivan,
 * 2026-11-19): the place (what a look is), From (who made it) and the sort.
 */

import {
  freshnessOf,
  keepFrom,
  pickerFroms,
  selectLooks,
  sortScenes,
} from 'renderer/graph/lookPickerFilter';
import type { IPlusRow } from 'renderer/graph/lookPickerRows';
import { markSceneVersionSeen } from 'renderer/utils/seenSceneVersions';

const DAY = 86_400_000;
const NOW = Date.parse('2026-11-19T12:00:00Z');

const scene = (over: Partial<IPlusRow> & Pick<IPlusRow, 'id'>): IPlusRow => ({
  name: over.id,
  swatch: ['#000000'],
  maker: 'fluideq',
  categories: ['nature'],
  locked: false,
  search: over.id,
  ...over,
});

describe('what counts as new', () => {
  it('is a scene published in the last two weeks and never played here', () => {
    const recent = scene({
      id: 'recent',
      publishedAt: new Date(NOW - 3 * DAY).toISOString(),
    });
    expect(freshnessOf(recent, NOW)).toBe('new');
    // The controls: older than two weeks, or already played, is not new.
    expect(
      freshnessOf(
        { ...recent, publishedAt: new Date(NOW - 20 * DAY).toISOString() },
        NOW,
      ),
    ).toBeUndefined();
    markSceneVersionSeen('played', 1);
    expect(
      freshnessOf({ ...recent, id: 'played', version: 1 }, NOW),
    ).toBeUndefined();
  });

  it('is updated when a newer version than the one played here is in', () => {
    markSceneVersionSeen('moved', 2);
    expect(freshnessOf(scene({ id: 'moved', version: 3 }), NOW)).toBe(
      'updated',
    );
    expect(
      freshnessOf(scene({ id: 'moved', version: 2 }), NOW),
    ).toBeUndefined();
  });

  it('marks nothing on a locked scene, or when no opening time is given', () => {
    const recent = scene({
      id: 'locked',
      locked: true,
      publishedAt: new Date(NOW - DAY).toISOString(),
    });
    expect(freshnessOf(recent, NOW)).toBeUndefined();
    expect(
      freshnessOf({ ...recent, locked: false }, undefined),
    ).toBeUndefined();
  });
});

describe('who made it', () => {
  const mine = scene({ id: 'mine', maker: 'mine' });
  const theirs = scene({ id: 'theirs', maker: 'members', author: 'Marta' });

  it('offers Members and Yours only once there is something of theirs', () => {
    expect(pickerFroms([], [scene({ id: 'a' })])).toEqual(['all', 'fluideq']);
    expect(pickerFroms([], [scene({ id: 'a' }), mine, theirs])).toEqual([
      'all',
      'fluideq',
      'members',
      'yours',
    ]);
  });

  it('narrows any place to one maker without throwing the place away', () => {
    const water = scene({
      id: 'water',
      maker: 'members',
      categories: ['water'],
    });
    const rows = [scene({ id: 'a' }), mine, theirs, water];
    const picked = selectLooks([], rows, new Map(), 'nature', 'members', '');
    expect(picked.scenes.map((row) => row.id)).toEqual(['theirs']);
    expect(keepFrom(mine, 'yours')).toBe(true);
    expect(keepFrom(mine, 'fluideq')).toBe(false);
  });

  it('searches every place at once', () => {
    const rows = [
      scene({ id: 'alpine' }),
      scene({ id: 'reef', categories: ['water'] }),
    ];
    const picked = selectLooks([], rows, new Map(), undefined, 'all', 'reef');
    expect(picked.scenes.map((row) => row.id)).toEqual(['reef']);
  });
});

describe('the sorts', () => {
  const rows = [
    scene({ id: 'unknown' }),
    scene({ id: 'old', publishedAt: '2026-01-01T00:00:00Z', adds: 900 }),
    scene({ id: 'fresh', publishedAt: '2026-11-10T00:00:00Z', adds: 10 }),
  ];

  it('puts what the gallery has not described last, in the order it was built', () => {
    expect(sortScenes(rows, 'newest', 'en').map((row) => row.id)).toEqual([
      'fresh',
      'old',
      'unknown',
    ]);
    expect(sortScenes(rows, 'used', 'en').map((row) => row.id)).toEqual([
      'old',
      'fresh',
      'unknown',
    ]);
  });

  it('sorts by name in the reader’s language', () => {
    expect(sortScenes(rows, 'name', 'en').map((row) => row.id)).toEqual([
      'fresh',
      'old',
      'unknown',
    ]);
  });
});
