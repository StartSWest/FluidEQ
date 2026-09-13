/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * A scene's second category, as the server sends it (fluideq-premium 0018),
 * and as the lists that have room name both.
 */

import {
  parseGalleryRow,
  parsePublishedRow,
} from '../../../common/plusGallery';
import { categoriesLabel } from '../../../renderer/plus/GalleryParts';

const AUTHOR = '9a8b7c6d-5e4f-4a3b-8c2d-1e0f9a8b7c6d';

const galleryRow = (over: Record<string, unknown> = {}) => ({
  author_id: AUTHOR,
  author_name: 'Mei Tanaka',
  author_handle: 'mei',
  scene_id: 'neon-lake',
  version: 2,
  category: 'cities',
  names: { en: 'Neon Lake' },
  swatch: ['#050a1a', '#00e5cf'],
  has_photo: false,
  likes: 1,
  likes_week: 0,
  adds: 3,
  updated_at: '2026-09-10T12:00:00.000Z',
  liked: false,
  added: false,
  ...over,
});

const publishedRow = (over: Record<string, unknown> = {}) => ({
  scene_id: 'neon-lake',
  version: 2,
  category: 'cities',
  names: { en: 'Neon Lake' },
  swatch: ['#050a1a', '#00e5cf'],
  likes: 1,
  adds: 3,
  published_at: '2026-09-01T12:00:00.000Z',
  updated_at: '2026-09-10T12:00:00.000Z',
  blocked: false,
  ...over,
});

describe('a scene’s second category', () => {
  it('is read from a gallery row and from the maker’s own list', () => {
    expect(parseGalleryRow(galleryRow({ category2: 'water' }))).toMatchObject({
      category: 'cities',
      category2: 'water',
    });
    expect(
      parsePublishedRow(publishedRow({ category2: 'water' })),
    ).toMatchObject({ category: 'cities', category2: 'water' });
  });

  it.each([
    ['a server from before it, which sends none', undefined],
    ['a scene without one', null],
    ['one that repeats the first', 'cities'],
    ['one that is not a category', 'weapons'],
  ])('is left out for %s, and the row keeps its first', (_label, category2) => {
    const scene = parseGalleryRow(galleryRow({ category2 }));
    expect(scene?.category).toBe('cities');
    expect(scene).not.toHaveProperty('category2');
    expect(parsePublishedRow(publishedRow({ category2 }))).not.toHaveProperty(
      'category2',
    );
  });
});

describe('where both are named', () => {
  const t = (key: string) => key.replace('plus.category.', '');

  it('names the first, then the second', () => {
    expect(categoriesLabel(t, { category: 'cities', category2: 'water' })).toBe(
      'cities · water',
    );
  });

  it('names the one alone when there is no second', () => {
    expect(categoriesLabel(t, { category: 'nature' })).toBe('nature');
  });
});
