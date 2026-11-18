/* Copyright (C) 2026 Ivan Carmenates Garcia. SPDX-License-Identifier: GPL-3.0-or-later */

/**
 * The Gallery's bar at the page's top (Ivan, 2026-11-17: "not even sure we
 * need the Gallery title there like that; we can make the search stick on
 * top, and that message we show when users need credits or whatever, below
 * the search", then "don't do that see-through thing or masking, it is
 * making the scenes gallery scroll slow").
 *
 * Held here: the search, or the way back, stands in a plain bar above the
 * scroller rather than pinned inside it; the place's name is there for
 * screen readers only; what the gallery says back hangs from that bar; and
 * nothing in the gallery blurs what is behind it. How it is drawn is held
 * on the compiled stylesheet, which jsdom does not lay out.
 */

import '@testing-library/jest-dom';
import { act, render, screen, within } from '@testing-library/react';
import en from 'common/i18n/en';
import type { IAccountState } from 'main/account/session';
import {
  resetGalleryActions,
  setGalleryNotice,
} from 'renderer/plus/galleryActions';
import { resetGalleryStore } from 'renderer/plus/galleryStore';
import {
  openGalleryPage,
  resetPlusNavigation,
  usePlusNavigation,
} from 'renderer/plus/plusNavigation';
import VisualizersView from 'renderer/plus/VisualizersView';
import { I18nProvider } from 'renderer/utils/I18nContext';
import { compileStylesheet, styleRules } from '../../utils/stylesheetRules';

const mockAccount: IAccountState = {
  status: 'signed-in',
  identity: { id: 'a1b2c3d4-0000-4000-8000-000000000001', email: 'm@x.org' },
};

jest.mock('../../../renderer/account/accountStore', () => ({
  getAccountSnapshot: () => mockAccount,
  useAccount: () => mockAccount,
  subscribeAccount: () => () => undefined,
}));

jest.mock('../../../renderer/account/entitlementStore', () => ({
  useEntitlement: () => ({ state: 'none' }),
  getEntitlementSnapshot: () => ({ state: 'none' }),
  subscribeEntitlement: () => () => undefined,
}));

jest.mock('../../../renderer/graph/sceneStill', () => ({
  renderSceneStill: async () => undefined,
  blobAsDataUrl: async () => 'data:image/webp;base64,ZHJhd24=',
}));

// The starter credits are their own subject (`starterWelcome.test.tsx`).
jest.mock('../../../renderer/plus/StarterCard', () => () => null);

beforeEach(() => {
  resetPlusNavigation();
  resetGalleryStore();
  resetGalleryActions();
  window.electron = {
    ipcRenderer: {
      listGallery: jest.fn(async () => ({ ok: true, scenes: [], more: false })),
      galleryPicture: jest.fn(async () => undefined),
      listScenePacks: jest.fn(async () => ({ packs: [], locked: [] })),
      listMemberScenes: jest.fn(async () => ({ scenes: [], locked: [] })),
      onMemberScenesChanged: jest.fn(() => () => undefined),
      myPublishedScenes: jest.fn(async () => ({
        ok: true,
        scenes: [],
        floors: [],
      })),
      mySceneSubmissions: jest.fn(async () => ({ ok: true, submissions: [] })),
    },
  } as unknown as typeof window.electron;
});

/** The gallery as the Scenes tab mounts it, following the navigation. */
function Gallery() {
  usePlusNavigation();
  return (
    <I18nProvider>
      <VisualizersView onShowGraph={jest.fn()} />
    </I18nProvider>
  );
}

const parts = (container: HTMLElement) => {
  const bar = container.querySelector('.gallery-pinned');
  const scroller = container.querySelector('.gallery-visualizers');
  if (!(bar instanceof HTMLElement) || !(scroller instanceof HTMLElement)) {
    throw new Error('the bar and the scroller render');
  }
  return { bar, scroller };
};

describe('the bar over the gallery', () => {
  it('stands the search above the scroller, never inside it, with the place named for screen readers', async () => {
    const { container } = render(<Gallery />);
    await act(async () => undefined);
    const { bar, scroller } = parts(container);
    expect(bar.nextElementSibling).toBe(scroller);
    expect(scroller.contains(bar)).toBe(false);
    expect(
      within(bar).getByRole('searchbox', { name: en['plus.gallery.search'] }),
    ).toBeInTheDocument();
    // The categories stand in it with the search, the switch among them.
    expect(
      within(bar).getByRole('group', { name: en['plus.gallery.categories'] }),
    ).toBeInTheDocument();
    const name = within(bar).getByRole('heading', {
      name: en['plus.visualizers.title'],
    });
    expect(name).toHaveClass('gallery-place-name');
  });

  it('holds the way back on a page of its own, in place of the search', async () => {
    const { container } = render(<Gallery />);
    await act(async () => openGalleryPage({ kind: 'mine' }));
    const { bar } = parts(container);
    expect(
      within(bar).getByRole('button', { name: en['plus.scene.back'] }),
    ).toBeInTheDocument();
    expect(within(bar).queryByRole('searchbox')).toBeNull();
  });

  it('hangs what the gallery says back from the bar, over the list', async () => {
    const { container } = render(<Gallery />);
    await act(async () => undefined);
    const { bar, scroller } = parts(container);
    // The control: nothing said, nothing shown.
    expect(screen.queryByRole('alert')).toBeNull();

    act(() => setGalleryNotice({ ok: false, key: 'plus.like.offline' }));

    const said = within(bar).getByRole('alert');
    expect(said).toHaveTextContent(en['plus.like.offline']);
    expect(scroller.contains(said)).toBe(false);
  });
});

describe('how the gallery is drawn', () => {
  const rules = styleRules(compileStylesheet('Gallery.scss'));
  const declared = (selector: string) =>
    rules.find((rule) => rule.selectors.includes(selector))?.declarations;

  it('keeps the place’s name out of sight and in the reading order', () => {
    const name = declared('.gallery-place-name');
    expect(name?.get('position')).toBe('absolute');
    expect(name?.get('width')).toBe('1px');
    expect(name?.get('height')).toBe('1px');
    expect(name?.get('clip-path')).toBe('inset(50%)');
    // Never `display: none`, which would take it from screen readers too.
    expect(name?.has('display')).toBe(false);
  });

  it('stands the bar still with no face of its own, and blurs nothing behind any card', () => {
    const bar = declared('.gallery-pinned');
    expect(bar).toBeDefined();
    // Not pinned inside the scroller, and wearing nothing the cards would
    // have to be repainted under on every frame of a scroll.
    expect(bar?.get('position')).not.toBe('sticky');
    expect(bar?.has('background')).toBe(false);
    expect(bar?.has('backdrop-filter')).toBe(false);
    const cardRules = rules.filter(({ selectors }) =>
      selectors.some((selector) => selector.includes('gallery-card')),
    );
    // The control: the cards' rules are there to be read.
    expect(cardRules.length).toBeGreaterThan(10);
    cardRules.forEach(({ selectors, declarations }) =>
      expect([selectors.join(), declarations.get('backdrop-filter')]).toEqual([
        selectors.join(),
        undefined,
      ]),
    );
  });
});
