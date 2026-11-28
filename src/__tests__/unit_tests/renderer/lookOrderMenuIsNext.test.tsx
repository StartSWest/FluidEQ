/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * Ivan, 2026-11-27: "we need to show scenes plus and standard in same order
 * of the next next next ... if I use the bar on the scene to go next scene
 * the menu that opens needs to be in same order", the Plus scenes
 * alphabetical "in everything or all scenes", New and updated by date, "and
 * in the next we do show alphabetically also".
 *
 * The arrows walked the looks in the order their lists were built while the
 * picker showed the scenes newest first. Here the picker's Everything grid
 * is read off the screen and the arrows are pressed through every look: the
 * names come out the same, in the same order, wrapping at the end - in
 * English, in Spanish (where the names, and the alphabet, differ) and under
 * an order chosen in the Sort menu. Each case also pins the order itself, so
 * two lists that both forgot to sort cannot pass as agreeing.
 */

import '@testing-library/jest-dom';
import {
  act,
  fireEvent,
  render,
  renderHook,
  screen,
} from '@testing-library/react';
import { DEFAULT_GRAPH_LOOK_ID } from 'common/graphStyles';
import { loadLocale } from 'common/i18n';
import type { IGalleryScene } from 'common/plusGallery';
import type { IMemberScenesListing } from 'main/ipc/memberScenes';
import type { IScenePacksListing } from 'main/ipc/scenePacks';
import LookPicker from 'renderer/graph/LookPicker';
import { useLookGallery } from 'renderer/graph/lookGallery';
import { setSceneRenderingAvailableForTesting } from 'renderer/graph/sceneHealth';
import {
  cycleGraphLook,
  getGraphLookId,
  getLookWalk,
  setGraphLook,
  useSelectedLookId,
} from 'renderer/utils/graphStyle';
import { I18nProvider } from 'renderer/utils/I18nContext';
import { resetLookSortsForTesting } from 'renderer/utils/lookOrder';
import {
  adoptMemberSceneListingForTesting,
  resetMemberSceneStore,
} from 'renderer/utils/memberScenes';
import {
  adoptScenePackListingForTesting,
  resetScenePackStore,
} from 'renderer/utils/scenePacks';

const DAY = 86_400_000;

/**
 * What the gallery says of each scene: how many members added it and when
 * it was first published. Both doors into the one store are given the same
 * table - the picker draws through `useGalleryFinder`, the arrows read
 * `findGalleryScene` - because that is all either reads from it.
 */
const listed = (
  lookId: string,
  adds: number,
  daysAgo: number,
  version = 1,
): IGalleryScene =>
  ({
    lookId,
    authorId: 'author',
    sceneId: lookId,
    authorName: null,
    authorHandle: null,
    version,
    category: 'nature',
    names: { en: lookId },
    swatch: ['#000000'],
    hasPhoto: false,
    likes: 0,
    likesWeek: 0,
    adds,
    updatedAt: new Date(Date.now() - daysAgo * DAY).toISOString(),
    firstPublishedAt: new Date(Date.now() - daysAgo * DAY).toISOString(),
    liked: false,
    added: true,
  }) as IGalleryScene;

const ME = '0b8f7c2e-4d3a-4b6f-9a1e-2c5d8e7f6a10';
const ROSA = '5c1d2e3f-4a5b-4c6d-8e7f-9a0b1c2d3e4f';
const CAT = `member:${ME}:cat`;
const KOI = `member:${ROSA}:koi`;

const mockGallery: Record<string, IGalleryScene> = {
  'premium:zephyr': listed('premium:zephyr', 5, 400),
  'premium:aurora': listed('premium:aurora', 50, 3),
  'premium:meadow': listed('premium:meadow', 20, 300),
  'premium:lantern': listed('premium:lantern', 40, 200),
  [KOI]: listed(KOI, 30, 1, 2),
};
const mockFind = (lookId: string): IGalleryScene | undefined =>
  mockGallery[lookId];

jest.mock('renderer/plus/galleryStore', () => ({
  ...jest.requireActual<object>('renderer/plus/galleryStore'),
  findGalleryScene: (lookId: string) => mockFind(lookId),
  useGalleryFinder: () => mockFind,
}));

const pack = (id: string, en: string, es: string) =>
  ({
    id,
    version: 1,
    names: { en, es },
    swatch: ['#00e5cf', '#ff3cac'],
  }) as IScenePacksListing['packs'][number];

// Listed in an order that is neither alphabet: the account's listing order
// is what the arrows used to walk.
const SCENES: IScenePacksListing = {
  packs: [
    pack('zephyr', 'Zephyr', 'Brisa'),
    pack('aurora', 'Aurora', 'Ocaso'),
    // An accent in front: a plain comparison of characters puts it after
    // every unaccented letter, Spanish puts it with the A.
    pack('meadow', 'Meadow', 'Árbol'),
  ],
  locked: [
    {
      ...pack('lantern', 'Lantern', 'Farol'),
      fallbackStyle: 'dots' as const,
    },
  ],
};

const member = (
  lookId: string,
  authorId: string,
  packId: string,
  own: boolean,
  en: string,
  es: string,
) =>
  ({
    lookId,
    authorId,
    packId,
    version: 2,
    names: { en, es },
    swatch: ['#222222', '#ffaa00'],
    own,
    authorName: own ? undefined : 'Rosa',
  }) as IMemberScenesListing['scenes'][number];

const MEMBERS: IMemberScenesListing = {
  scenes: [
    member(KOI, ROSA, 'koi', false, 'Koi Pond', 'Estanque'),
    member(CAT, ME, 'cat', true, 'Cat', 'Gato'),
  ],
  locked: [],
};

/** The picker as the graph's credit holds it, following the selection. */
const Picker = () => {
  const value = useSelectedLookId();
  return <LookPicker value={value} disabled={false} onChoose={setGraphLook} />;
};

const trigger = () => {
  const button = document.querySelector<HTMLElement>('.look-picker__trigger');
  if (!button) {
    throw new Error('no picker trigger');
  }
  return button;
};

/** The name on the picker's pill: the look on the graph. */
const playing = () =>
  trigger().querySelector('.graph-look-name')?.textContent ?? '';

const railPlace = (index: number) => {
  const place = document.querySelectorAll<HTMLElement>('.look-picker__place')[
    index
  ];
  if (!place) {
    throw new Error(`no place ${index} in the rail`);
  }
  return place;
};

interface ITile {
  name: string;
  locked: boolean;
  element: HTMLElement;
}

/** The open window's tiles, in the order they stand on the screen. */
const tiles = (): ITile[] =>
  Array.from(
    document.querySelectorAll<HTMLElement>(
      '.look-picker__scroll .look-picker__pick',
    ),
  ).map((element) => ({
    name: element.querySelector('.look-picker__name')?.textContent ?? '',
    locked: element.classList.contains('is-locked'),
    element,
  }));

const sortButton = () => {
  const button =
    document.querySelector<HTMLButtonElement>('.look-picker__sort');
  if (!button) {
    throw new Error('no Sort menu');
  }
  return button;
};

/** Everything, the first place in the rail, as the window shows it. */
const openEverything = () => {
  fireEvent.click(trigger());
  fireEvent.click(railPlace(0));
};

const shut = () => fireEvent.click(trigger());

/**
 * Chooses the first look the menu can put on, then presses Next through
 * every look and once more, reading the pill each time.
 */
const pressNextThrough = (count: number) => {
  openEverything();
  const first = tiles().find((tile) => !tile.locked);
  if (!first) {
    throw new Error('nothing to choose');
  }
  fireEvent.click(first.element);
  const seen = [playing()];
  for (let press = 0; press < count; press += 1) {
    act(() => cycleGraphLook(1));
    seen.push(playing());
  }
  return seen;
};

/** The menu's Everything, read on, and Next pressed through every look. */
const expectNextToReadTheMenu = () => {
  openEverything();
  const menu = tiles();
  shut();
  const playable = menu.filter((tile) => !tile.locked).map((tile) => tile.name);
  const seen = pressNextThrough(playable.length);
  // The last press is past the end: it wraps to where it began.
  expect(seen).toEqual([...playable, playable[0]]);
  // And Previous from there goes back round, the same order reversed.
  const back = [playing()];
  playable.forEach(() => {
    act(() => cycleGraphLook(-1));
    back.push(playing());
  });
  expect(back).toEqual([playable[0], ...[...playable].reverse()]);
  return menu;
};

const scenesOf = (menu: readonly ITile[]) =>
  menu
    .filter((tile) => tile.element.closest('.look-picker__item'))
    .map((tile) => (tile.locked ? `${tile.name} (locked)` : tile.name));

beforeEach(() => {
  window.localStorage.clear();
  resetLookSortsForTesting();
  resetScenePackStore();
  resetMemberSceneStore();
  setSceneRenderingAvailableForTesting(true);
  act(() => {
    adoptScenePackListingForTesting(SCENES);
    adoptMemberSceneListingForTesting(MEMBERS);
    setGraphLook(DEFAULT_GRAPH_LOOK_ID);
  });
});

afterEach(() => {
  setSceneRenderingAvailableForTesting(undefined);
});

describe('Next walks the looks in the order the picker shows them', () => {
  it('scenes by name, then the standard looks in their fixed order', () => {
    render(<Picker />);
    // The picker opens on Name: the order is the alphabet until asked.
    openEverything();
    expect(sortButton()).toHaveTextContent('Sort: Name');
    shut();
    const menu = expectNextToReadTheMenu();

    // The order itself: every scene alphabetical, the locked one among them
    // where its name puts it, and then the Analyzer leading the standards.
    expect(scenesOf(menu)).toEqual([
      'Aurora',
      'Cat',
      'Koi Pond',
      'Lantern (locked)',
      'Meadow',
      'Zephyr',
    ]);
    expect(menu[scenesOf(menu).length]?.name).toBe('Analyzer');
  });

  it('in the window’s language, by its alphabet', async () => {
    window.localStorage.setItem('fluideq.locale', 'es');
    await loadLocale('es');
    render(
      <I18nProvider>
        <Picker />
      </I18nProvider>,
    );
    const menu = expectNextToReadTheMenu();

    // The Spanish names in the Spanish alphabet: Árbol with the A, not after
    // the Z where a plain comparison of characters puts it.
    expect(scenesOf(menu)).toEqual([
      'Árbol',
      'Brisa',
      'Estanque',
      'Farol (locked)',
      'Gato',
      'Ocaso',
    ]);
  });

  it('in the order chosen in the Sort menu', () => {
    render(<Picker />);
    openEverything();
    fireEvent.click(sortButton());
    fireEvent.click(screen.getByRole('menuitemradio', { name: 'Most used' }));
    expect(sortButton()).toHaveTextContent('Sort: Most used');
    shut();

    const menu = expectNextToReadTheMenu();
    // The control: the scenes really are by adds now, the one nobody has
    // listed last.
    expect(scenesOf(menu)).toEqual([
      'Aurora',
      'Lantern (locked)',
      'Koi Pond',
      'Meadow',
      'Zephyr',
      'Cat',
    ]);
  });

  it('pictures at the bar’s edges exactly the looks the arrows put on', () => {
    render(<Picker />);
    openEverything();
    fireEvent.click(sortButton());
    fireEvent.click(screen.getByRole('menuitemradio', { name: 'Most used' }));
    shut();

    const walk = getLookWalk().map((look) => look.id);
    walk.forEach((id) => {
      act(() => setGraphLook(id));
      const { result, unmount } = renderHook(() => useLookGallery(id));
      const { previous, next } = result.current;
      unmount();
      act(() => cycleGraphLook(1));
      expect(next?.id).toBe(getGraphLookId());
      act(() => cycleGraphLook(-1));
      act(() => cycleGraphLook(-1));
      expect(previous?.id).toBe(getGraphLookId());
    });
  });
});

describe('the orders the arrows do not follow', () => {
  it('New and updated keeps its own, by date, and its own Sort', () => {
    render(<Picker />);
    openEverything();
    fireEvent.click(sortButton());
    fireEvent.click(screen.getByRole('menuitemradio', { name: 'Most used' }));

    fireEvent.click(railPlace(1));
    expect(sortButton()).toHaveTextContent('Sort: Newest');
    // Koi Pond came out a day ago, Aurora three: newest first, where the
    // alphabet and the adds would both put Aurora first.
    expect(scenesOf(tiles())).toEqual(['Koi Pond', 'Aurora']);

    // Changing it here leaves the catalogue's order, and the arrows, alone.
    fireEvent.click(sortButton());
    fireEvent.click(screen.getByRole('menuitemradio', { name: 'Name' }));
    expect(scenesOf(tiles())).toEqual(['Aurora', 'Koi Pond']);
    fireEvent.click(railPlace(0));
    expect(sortButton()).toHaveTextContent('Sort: Most used');
    fireEvent.click(railPlace(1));
    expect(sortButton()).toHaveTextContent('Sort: Name');
    shut();
    const menu = expectNextToReadTheMenu();
    expect(scenesOf(menu)[0]).toBe('Aurora');
    expect(scenesOf(menu)[2]).toBe('Koi Pond');
  });

  it('leaves the standard looks in their place, with nothing to sort there', () => {
    render(<Picker />);
    openEverything();
    // The control: where there are scenes, the Sort menu is there to use.
    expect(sortButton()).toBeEnabled();
    const standards = tiles()
      .filter((tile) => !tile.element.closest('.look-picker__item'))
      .map((tile) => tile.name);

    const analysis = Array.from(
      document.querySelectorAll<HTMLElement>('.look-picker__place'),
    ).find((place) => place.getAttribute('title') === 'Analysis');
    if (!analysis) {
      throw new Error('no Analysis in the rail');
    }
    fireEvent.click(analysis);
    expect(sortButton()).toBeDisabled();
    const shown = tiles().map((tile) => tile.name);
    expect(shown[0]).toBe('Analyzer');
    expect(shown[1]).toBe('Before & after');
    // Exactly the run of the walk the Analysis looks stand in.
    expect(standards.slice(0, shown.length)).toEqual(shown);
  });
});
