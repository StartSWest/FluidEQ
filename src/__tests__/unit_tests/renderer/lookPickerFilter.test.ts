/* Copyright (C) 2026 Ivan Carmenates Garcia. SPDX-License-Identifier: GPL-3.0-or-later */

/**
 * What the look picker shows, as three questions kept apart (Ivan,
 * 2026-11-19): the place (what a look is), From (who made it) and the sort.
 */

import {
  freshnessOf,
  keepFrom,
  offersFrom,
  pickerFroms,
  selectLooks,
  sortScenes,
  type TPickerFrom,
  type TPickerPlace,
} from 'renderer/graph/lookPickerFilter';
import {
  buildStyleRows,
  type IPlusRow,
  type IStyleRow,
} from 'renderer/graph/lookPickerRows';
import { getSelectableLooks } from 'renderer/utils/graphStyle';
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
    expect(pickerFroms([scene({ id: 'a' })])).toEqual(['all', 'fluideq']);
    expect(pickerFroms([scene({ id: 'a' }), mine, theirs])).toEqual([
      'all',
      'fluideq',
      'members',
      'yours',
    ]);
    // No scene at all: there is no maker to choose between.
    expect(pickerFroms([])).toEqual(['all']);
  });

  it('offers Yours to the account that publishes FluidEQ’s scenes, with none of its own', () => {
    expect(pickerFroms([scene({ id: 'a' })], true)).toEqual([
      'all',
      'fluideq',
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

/**
 * Ivan, 2026-11-25: "FluidEQ 71" over thirty-two of FluidEQ's scenes - the
 * styles were counted in - and "Yours 2" on the account that publishes
 * every one of FluidEQ's scenes.
 */
describe('what each From tab counts', () => {
  const [standard] = buildStyleRows(
    getSelectableLooks([], 'signal', [], []),
    (key) => key,
  );
  const style = (
    id: string,
    family: IStyleRow['family'],
    yours = false,
  ): IStyleRow => ({ ...standard, id, name: id, family, yours, search: id });
  const STYLES = [
    style('analyzer', 'analysis'),
    style('spectrum', 'analysis'),
    style('my-bars', 'bars', true),
  ];
  const SCENES = [
    scene({ id: 'aurora' }),
    scene({ id: 'reef', categories: ['water'] }),
    scene({ id: 'ember', locked: true }),
    scene({ id: 'prism', maker: 'members', author: 'Prime' }),
    scene({ id: 'mine', maker: 'mine' }),
  ];
  const count = (
    place: TPickerPlace | undefined,
    from: TPickerFrom,
    ownsOfficial = false,
  ) => {
    const picked = selectLooks(
      STYLES,
      SCENES,
      new Map(),
      place,
      from,
      '',
      ownsOfficial,
    );
    return { styles: picked.styles.length, scenes: picked.scenes.length };
  };

  it('counts a maker’s scenes alone, never the styles', () => {
    expect(count('everything', 'fluideq')).toEqual({ styles: 0, scenes: 3 });
    expect(count('everything', 'members')).toEqual({ styles: 0, scenes: 1 });
    // A saved style is the member's, and still not one of their scenes.
    expect(count('everything', 'yours')).toEqual({ styles: 0, scenes: 1 });
    // All holds nothing back: every scene, and the place's styles beside them.
    expect(count('everything', 'all')).toEqual({ styles: 3, scenes: 5 });
  });

  it('counts FluidEQ’s scenes as Yours too for the account that publishes them', () => {
    const fluideq = count('everything', 'fluideq', true);
    const yours = count('everything', 'yours', true);
    expect(fluideq).toEqual({ styles: 0, scenes: 3 });
    // FluidEQ's three and its own one: FluidEQ inside Yours.
    expect(yours).toEqual({ styles: 0, scenes: 4 });
    expect(
      selectLooks(
        [],
        SCENES,
        new Map(),
        'everything',
        'yours',
        '',
        true,
      ).scenes.map((row) => row.id),
    ).toEqual(['aurora', 'reef', 'ember', 'mine']);
    // Every other account: one maker each, as before.
    expect(count('everything', 'yours', false)).toEqual({
      styles: 0,
      scenes: 1,
    });
    expect(keepFrom(SCENES[0], 'yours', true)).toBe(true);
    expect(keepFrom(SCENES[0], 'yours', false)).toBe(false);
    expect(keepFrom(SCENES[3], 'yours', true)).toBe(false);
  });

  it('leaves a family of styles whole, whatever tab is left on', () => {
    expect(count('analysis', 'members')).toEqual({ styles: 2, scenes: 0 });
    expect(count('bars', 'fluideq')).toEqual({ styles: 1, scenes: 0 });
    // From is not offered there; it is over every place that holds scenes.
    const froms = pickerFroms(SCENES);
    expect(offersFrom('analysis', froms)).toBe(false);
    expect(offersFrom('everything', froms)).toBe(true);
    expect(offersFrom('water', froms)).toBe(true);
    expect(offersFrom(undefined, froms)).toBe(true);
    expect(offersFrom('everything', ['all'])).toBe(false);
  });

  it('narrows a search to a maker’s scenes, styles left out', () => {
    expect(count(undefined, 'members')).toEqual({ styles: 0, scenes: 1 });
    expect(count(undefined, 'all')).toEqual({ styles: 3, scenes: 5 });
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
