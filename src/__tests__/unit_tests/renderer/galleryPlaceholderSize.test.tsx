/* Copyright (C) 2026 Ivan Carmenates Garcia. SPDX-License-Identifier: GPL-3.0-or-later */

/**
 * Every gallery card is the same size, and the placeholders standing in for
 * them before the list arrives are that size too (Ivan, 2026-11-13: "when the
 * gallery opens all cards are small and then they grow ... All cards need to
 * be the same size always, and load as placeholders").
 *
 * Measured in the stand-in, the placeholders were 58 px shorter than the cards
 * replacing them (the picture and two thin bars), the scrollbar arriving with
 * the list took 8 px from the grid, and a foot that wrapped on narrow cards
 * made some rows taller than others. jsdom lays nothing out, so what is held
 * here is what makes the sizes equal by construction: a placeholder is built
 * from the same rows, in the same classes, as what replaces it; and the
 * stylesheet gives those rows heights that do not depend on their words.
 */

import '@testing-library/jest-dom';
import { act, render, screen } from '@testing-library/react';
import { createRef } from 'react';
import type { IGalleryScene, IPublishedScene } from 'common/plusGallery';
import type { TMineOutcome } from 'main/ipc/plusPublishing';
import type { TMySubmissionsOutcome } from 'main/ipc/plusReview';
import GalleryCard from 'renderer/plus/GalleryCard';
import GallerySkeleton from 'renderer/plus/GallerySkeleton';
import YourScenes from 'renderer/plus/YourScenes';
import { compileStylesheet, styleRules } from '../../utils/stylesheetRules';

jest.mock('../../../renderer/account/entitlementStore', () => ({
  useEntitlement: () => ({ state: 'active' }),
  getEntitlementSnapshot: () => ({ state: 'active' }),
  subscribeEntitlement: () => () => undefined,
}));

jest.mock('../../../renderer/account/accountStore', () => ({
  useAccount: () => ({ status: 'signed-in', identity: { id: 'me' } }),
  getAccountSnapshot: () => ({ status: 'signed-in', identity: { id: 'me' } }),
  subscribeAccount: () => () => undefined,
}));

jest.mock('../../../renderer/graph/sceneStill', () => ({
  renderSceneStill: async () => undefined,
  blobAsDataUrl: async () => 'data:image/webp;base64,ZHJhd24=',
}));

const SOMEONE = '9a8b7c6d-5e4f-4a3b-8c2d-1e0f9a8b7c6d';

const galleryScene: IGalleryScene = {
  lookId: `member:${SOMEONE}:neon-city`,
  authorId: SOMEONE,
  sceneId: 'neon-city',
  authorName: 'Mei Tanaka',
  authorHandle: 'mei',
  version: 3,
  category: 'cities',
  names: { en: 'Neon City' },
  swatch: ['#050a1a', '#00e5cf'],
  hasPhoto: false,
  likes: 12,
  likesWeek: 2,
  adds: 5,
  updatedAt: '2026-09-10T12:00:00Z',
  liked: false,
  added: false,
};

const published: IPublishedScene = {
  sceneId: 'neon-lake',
  names: { en: 'Neon Lake' },
  version: 1,
  swatch: ['#112233'],
  category: 'water',
  likes: 2,
  adds: 3,
  publishedAt: '2026-10-01T12:00:00Z',
  updatedAt: '2026-10-01T12:00:00Z',
  blocked: false,
};

/** The parts that lay other parts out: opened; every other part is a line. */
const CONTAINERS = new Set(['gallery-card__foot', 'gallery-row__text']);

/**
 * What a box is made of: each child's own part of the card or row (its
 * `gallery-card__` or `gallery-row__` class), opening the parts that lay
 * others out, and nothing about the words or the stand-in bars inside.
 */
const partsOf = (element: Element): unknown[] =>
  [...element.children].flatMap((child) => {
    const part = [...child.classList].find((name) =>
      /^gallery-(card|row)__/.test(name),
    );
    if (!part) {
      return [];
    }
    return [CONTAINERS.has(part) ? { [part]: partsOf(child) } : part];
  });

const bridge = {
  galleryPicture: jest.fn(async () => undefined),
  galleryClip: jest.fn(async () => undefined),
  listScenePacks: jest.fn(async () => ({ packs: [], locked: [] })),
  listMemberScenes: jest.fn(async () => ({ scenes: [], locked: [] })),
  onMemberScenesChanged: jest.fn(() => () => undefined),
  myPublishedScenes: jest.fn<Promise<TMineOutcome>, []>(),
  mySceneSubmissions: jest.fn<Promise<TMySubmissionsOutcome>, []>(),
};

beforeEach(() => {
  window.electron = {
    ipcRenderer: bridge,
  } as unknown as typeof window.electron;
});

it('builds a placeholder card from the rows of the card that replaces it', async () => {
  const placeholder = render(
    <GallerySkeleton
      ref={createRef<HTMLDivElement>()}
      closing={false}
      onAnimationEnd={jest.fn()}
    />,
  ).container.querySelector('.gallery-card--skeleton .gallery-card__body');
  const card = render(
    <GalleryCard
      scene={galleryScene}
      local={undefined}
      me="me"
      onOpen={jest.fn()}
      onMaker={jest.fn()}
    />,
  ).container.querySelector('article.gallery-card .gallery-card__body');
  await act(async () => undefined);

  if (!placeholder || !card) {
    throw new Error('both bodies render');
  }
  const cardParts = partsOf(card);
  // The control: the card has the four rows and the foot's two halves, so an
  // empty comparison cannot pass for a match.
  expect(cardParts).toEqual([
    'gallery-card__name',
    'gallery-card__byline',
    'gallery-card__version',
    { 'gallery-card__foot': ['gallery-card__adds', 'gallery-card__controls'] },
  ]);
  expect(partsOf(placeholder)).toEqual(cardParts);
});

it('builds a placeholder row of Your scenes from the parts of the row that replaces it', async () => {
  let answer: (outcome: TMineOutcome) => void = () => undefined;
  bridge.myPublishedScenes.mockReturnValue(
    new Promise((resolve) => {
      answer = resolve;
    }),
  );
  bridge.mySceneSubmissions.mockResolvedValue({ ok: true, submissions: [] });
  const { container } = render(<YourScenes me="maker" />);

  const placeholder = container.querySelector('.gallery-row--skeleton');
  if (!placeholder) {
    throw new Error('a placeholder row while loading');
  }
  const placeholderParts = partsOf(placeholder);

  await act(async () => answer({ ok: true, scenes: [published], floors: [] }));
  await screen.findByText('Neon Lake');
  const row = container.querySelector(
    '.gallery-row:not(.gallery-row--skeleton)',
  );
  if (!row) {
    throw new Error('the real row');
  }
  const rowParts = partsOf(row);
  expect(rowParts).toEqual(
    expect.arrayContaining([
      'gallery-row__picture',
      'gallery-row__numbers',
      'gallery-row__actions',
    ]),
  );
  expect(placeholderParts).toEqual(rowParts);
});

describe('what keeps every card the same size', () => {
  const rules = styleRules(compileStylesheet('Gallery.scss'));
  const declared = (selector: string, property: string) =>
    rules
      .filter(
        (rule) =>
          rule.selectors.includes(selector) &&
          rule.declarations.has(property) &&
          rule.within.length === 0,
      )
      .map((rule) => rule.declarations.get(property))
      .pop();

  it('keeps the foot on one line, never wrapping one card taller than another', () => {
    expect(declared('.gallery-card__foot', 'flex-wrap')).toBeUndefined();
    expect(declared('.gallery-card__foot', 'display')).toBe('flex');
  });

  it('lays cards out no narrower than the foot needs', () => {
    expect(declared('.gallery-grid', 'grid-template-columns')).toMatch(
      /minmax\(min\(100%, 224px\), 1fr\)/,
    );
  });

  it('gives the byline the Official tag’s height, tag or not', () => {
    expect(declared('.gallery-card__byline', 'min-height')).toMatch(/calc\(/);
  });

  it('keeps the scrollbar’s room whether or not the list scrolls', () => {
    expect(declared('.gallery-visualizers', 'scrollbar-gutter')).toBe('stable');
  });

  it('fades the cards in where they stand instead of raising them', () => {
    expect(declared('.gallery-card', 'animation')).toMatch(/^fade-in /);
  });

  it('gives a placeholder row no height of its own', () => {
    expect(declared('.gallery-row--skeleton', 'height')).toBeUndefined();
  });
});
