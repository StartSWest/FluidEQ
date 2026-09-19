/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import {
  cleanGalleryQuery,
  FLUIDEQ_CREATOR_ID,
  MAX_GALLERY_QUERY,
  parseGalleryRow,
  parseVersionRow,
  parsePublishedRow,
  parseVersionFloorRow,
  heldVersionOf,
  type IPublishedScene,
} from '../../../common/plusGallery';
import { MAX_VERSION_NOTE } from '../../../common/sceneVersionNote';

const AUTHOR = '9a8b7c6d-5e4f-4a3b-8c2d-1e0f9a8b7c6d';

const row = (over: Record<string, unknown> = {}) => ({
  author_id: AUTHOR,
  author_name: 'Mei Tanaka',
  author_handle: 'mei',
  scene_id: 'neon-city',
  version: 2,
  category: 'cities',
  names: { en: 'Neon City', es: 'Ciudad de neón' },
  swatch: ['#050A1A', '#00e5cf'],
  has_photo: false,
  likes: '12',
  likes_week: 3,
  adds: '40',
  updated_at: '2026-09-10T12:00:00.000Z',
  liked: true,
  added: false,
  ...over,
});

describe('a gallery row', () => {
  it('identifies official scenes by the reserved creator and official flag together', () => {
    expect(
      parseGalleryRow(row({ official: true, author_id: FLUIDEQ_CREATOR_ID })),
    ).toMatchObject({
      official: true,
      lookId: 'premium:neon-city',
      authorName: 'FluidEQ',
      authorHandle: 'fluideq',
    });
    expect(parseGalleryRow(row({ official: true }))).toBeUndefined();
    expect(
      parseGalleryRow(row({ author_id: FLUIDEQ_CREATOR_ID })),
    ).toBeUndefined();
  });
  // The control: a row as the server sends it reads whole, counts included —
  // PostgREST hands bigints back as strings.
  it('reads a row the server sends, with its counts as numbers', () => {
    expect(parseGalleryRow(row())).toEqual({
      lookId: `member:${AUTHOR}:neon-city`,
      authorId: AUTHOR,
      sceneId: 'neon-city',
      authorName: 'Mei Tanaka',
      authorHandle: 'mei',
      version: 2,
      category: 'cities',
      names: { en: 'Neon City', es: 'Ciudad de neón' },
      swatch: ['#050a1a', '#00e5cf'],
      hasPhoto: false,
      likes: 12,
      likesWeek: 3,
      adds: 40,
      updatedAt: '2026-09-10T12:00:00.000Z',
      liked: true,
      added: false,
    });
  });

  it.each([
    ['a category not on the list', { category: 'weapons' }],
    ['a swatch that is not colours', { swatch: ['red', 'blue'] }],
    ['a swatch of one colour', { swatch: ['#000000'] }],
    ['no English name', { names: { es: 'Ciudad' } }],
    ['a scene id that is not an id', { scene_id: '../../etc' }],
    ['an author that is not an account', { author_id: 'admin' }],
    ['a negative count', { likes: -1 }],
    ['a date that is not a date', { updated_at: 'yesterday' }],
    ['no version', { version: 0 }],
  ])('drops a row with %s', (_label, over) => {
    expect(parseGalleryRow(row(over))).toBeUndefined();
  });

  it('cleans every name and drops the ones that do not fit', () => {
    const parsed = parseGalleryRow(
      row({
        names: {
          en: '  Neon\u202E City\u0000 ',
          fr: 'x'.repeat(41),
          english: 'Not a locale',
        },
        author_name: 'Mei\u200B Tanaka',
        author_handle: 'Not A Handle',
      }),
    );
    expect(parsed?.names).toEqual({ en: 'Neon City' });
    expect(parsed?.authorName).toBe('Mei Tanaka');
    expect(parsed?.authorHandle).toBeNull();
  });
});

describe('a published row', () => {
  it('reads the member’s own scene, blocked or not', () => {
    const parsed = parsePublishedRow({
      scene_id: 'neon-city',
      version: 3,
      category: 'water',
      names: { en: 'Neon City' },
      swatch: ['#050a1a', '#00e5cf', '#ff3cac'],
      likes: '7',
      adds: 2,
      published_at: '2026-09-01T00:00:00Z',
      updated_at: '2026-09-10T00:00:00Z',
      blocked: true,
    });
    expect(parsed).toMatchObject({
      sceneId: 'neon-city',
      likes: 7,
      blocked: true,
    });
    expect(parsePublishedRow({ scene_id: 'neon-city' })).toBeUndefined();
  });
});

describe('a search', () => {
  it('is trimmed, bounded, and nothing when there is nothing to search for', () => {
    expect(cleanGalleryQuery('  neon  ')).toBe('neon');
    expect(cleanGalleryQuery('n'.repeat(200))).toHaveLength(MAX_GALLERY_QUERY);
    expect(cleanGalleryQuery('   ')).toBeUndefined();
    expect(cleanGalleryQuery(42)).toBeUndefined();
  });
});

describe('the versions a row carries', () => {
  it('keeps the maker’s note for this version and the scene’s first version', () => {
    expect(
      parseGalleryRow(
        row({
          version: 4,
          version_note: '  Peaks stay whole ',
          first_version: 1,
        }),
      ),
    ).toMatchObject({
      version: 4,
      versionNote: 'Peaks stay whole',
      firstVersion: 1,
    });
  });

  it('drops a first version later than the current one, and a note it cannot keep', () => {
    const scene = parseGalleryRow(
      row({
        version: 2,
        version_note: 'x'.repeat(MAX_VERSION_NOTE + 1),
        first_version: 5,
      }),
    );
    expect(scene).toBeDefined();
    expect(scene).not.toHaveProperty('versionNote');
    expect(scene).not.toHaveProperty('firstVersion');
  });

  it('reads a server from before notes as a row without them', () => {
    const scene = parseGalleryRow(row());
    expect(scene).not.toHaveProperty('versionNote');
    expect(scene).not.toHaveProperty('firstVersion');
  });
});

describe('an earlier version', () => {
  it('is read with its note, or without one', () => {
    expect(
      parseVersionRow({
        version: 3,
        note: 'Lake at night',
        published_at: '2026-09-12T02:00:00Z',
      }),
    ).toEqual({
      version: 3,
      note: 'Lake at night',
      publishedAt: '2026-09-12T02:00:00Z',
    });
    expect(
      parseVersionRow({
        version: 2,
        note: null,
        published_at: '2026-09-11T02:00:00Z',
      }),
    ).toEqual({ version: 2, publishedAt: '2026-09-11T02:00:00Z' });
  });

  it('is nothing when any part of it is wrong', () => {
    expect(parseVersionRow(null)).toBeUndefined();
    expect(
      parseVersionRow({ version: 0, published_at: '2026-09-11T02:00:00Z' }),
    ).toBeUndefined();
    expect(
      parseVersionRow({ version: 2, published_at: 'yesterday' }),
    ).toBeUndefined();
    expect(
      parseVersionRow({
        version: 2,
        note: 42,
        published_at: '2026-09-11T02:00:00Z',
      }),
    ).toBeUndefined();
  });
});

describe('the version a scene is published under now', () => {
  const published = (
    sceneId: string,
    version: number,
    official?: boolean,
  ): IPublishedScene => ({
    sceneId,
    version,
    category: 'space',
    names: { en: sceneId },
    swatch: ['#112233'],
    likes: 0,
    adds: 0,
    publishedAt: '2026-09-01T00:00:00Z',
    updatedAt: '2026-09-02T00:00:00Z',
    blocked: false,
    ...(official ? { official: true } : {}),
  });

  it('is nothing for a scene that has never been published', () => {
    expect(heldVersionOf([published('other', 9)], 'mine')).toBeUndefined();
    expect(heldVersionOf([], 'mine')).toBeUndefined();
  });

  it('reads a member publication', () => {
    expect(heldVersionOf([published('mine', 7)], 'mine')).toBe(7);
  });

  it('reads one of FluidEQ’s own', () => {
    // The bug this exists for: filtered out, an official publisher was told
    // nothing was published and republished under the number already there.
    expect(heldVersionOf([published('mine', 51, true)], 'mine')).toBe(51);
  });

  it('takes the higher where a scene is published as both', () => {
    const both = [published('mine', 51, true), published('mine', 60)];
    expect(heldVersionOf(both, 'mine')).toBe(60);
    expect(heldVersionOf([...both].reverse(), 'mine')).toBe(60);
  });

  // Server migration 0039: unpublishing took the row away, and members still
  // held its number.
  it('remembers what a scene was ever out at, unpublished since', () => {
    const floors = [
      { sceneId: 'mine', version: 9 },
      { sceneId: 'other', version: 40 },
    ];
    expect(heldVersionOf([], 'mine', floors)).toBe(9);
    // Above the live one when the floor is higher, never below it.
    expect(heldVersionOf([published('mine', 7)], 'mine', floors)).toBe(9);
    expect(
      heldVersionOf([published('mine', 12)], 'mine', [
        { sceneId: 'mine', version: 9 },
      ]),
    ).toBe(12);
    expect(heldVersionOf([], 'fresh', floors)).toBeUndefined();
  });

  it('reads a floor row as the server sends it, and nothing that is not one', () => {
    expect(parseVersionFloorRow({ scene_id: 'lake', version: '7' })).toEqual({
      sceneId: 'lake',
      version: 7,
    });
    [
      { scene_id: '../etc', version: 7 },
      { scene_id: 'lake', version: 0 },
      { scene_id: 'lake', version: 'seven' },
      null,
      ['lake', 7],
    ].forEach((row) => expect(parseVersionFloorRow(row)).toBeUndefined());
  });
});
