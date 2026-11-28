/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * The saved EQs' two keys, as Ivan chose them on 2026-11-27 (option A of the
 * Save EQ options: "go with recomended"): the name of the one that is on
 * loads, and the disk beside it saves. The disk's menu used to list the
 * saved EQs, and pressing one LOADED it, under an icon that says save ("the
 * user should be update that one not load that one").
 *
 * The real `savedEqActions` run here; what plays, the index and main's
 * answers are stood in for. Loading a saved EQ is the one press that feeds
 * what plays (`feedSongSound` with `putOn`), so a disk that never feeds it
 * has loaded nothing — and the name's own rows, which must feed it, are the
 * control that proves the check can see a load at all.
 */

import '@testing-library/jest-dom';
import {
  type RenderResult,
  act,
  fireEvent,
  render,
  screen,
  within,
} from '@testing-library/react';
import { FilterTypeEnum } from 'common/constants';
import type { ISongSound } from 'common/songSound';
import type { ISavedEqSummary } from 'common/songSoundMemory';
import SavedEqKeys from 'renderer/eq/autoEq/SavedEqKeys';
import {
  putOnSavedEq,
  resetSavedEqActions,
} from 'renderer/audio/savedEqActions';

const mockFeed = jest.fn();
const mockUpdateEq = jest.fn((id: string, sound: ISongSound) =>
  Promise.resolve({ id, sound }).then(() => undefined),
);
const mockSaveEq = jest.fn((name: string, sound: ISongSound) =>
  Promise.resolve({ id: `saved-${sound.presetId}`, name }),
);
let mockLive: ISongSound | undefined;
let mockEqs: ISavedEqSummary[] = [];

jest.mock('renderer/audio/songSoundSession', () => ({
  feedSongSound: (event: unknown) => mockFeed(event),
  readLiveSongSound: () => mockLive,
  useLiveSongSound: () => mockLive,
  readSongSoundNow: () => ({
    isPlaying: true,
    canSave: true,
    isChanged: false,
  }),
  useSongSoundNow: () => ({ isPlaying: true, canSave: true, isChanged: false }),
  songSoundPicked: () => undefined,
}));
jest.mock('renderer/audio/songSoundIndex', () => ({
  useSongSoundIndex: () => ({
    songs: new Map(),
    albums: new Map(),
    eqs: mockEqs,
    eqById: new Map(mockEqs.map((eq) => [eq.id, eq])),
  }),
}));
jest.mock('renderer/utils/songSoundApi', () => ({
  saveEq: (name: string, sound: ISongSound) => mockSaveEq(name, sound),
  updateEq: (id: string, sound: ISongSound) => mockUpdateEq(id, sound),
  saveSongSound: () => Promise.resolve(),
  renameEq: () => Promise.resolve(),
  deleteEq: () => Promise.resolve(),
}));

const withGain = (gain: number): ISongSound => ({
  presetId: 'none',
  filters: {
    a: {
      id: 'a',
      frequency: 1000,
      gain,
      quality: 1,
      type: FilterTypeEnum.PK,
    },
  },
});

const mine: ISavedEqSummary = {
  id: 'mine',
  name: 'My EQ 2',
  sound: withGain(4),
  songCount: 12,
  albumCount: 0,
  updatedAt: 2,
};
const lateNight: ISavedEqSummary = {
  id: 'late',
  name: 'Late night',
  sound: withGain(-3),
  songCount: 0,
  albumCount: 0,
  updatedAt: 1,
};

/** What plays: "My EQ 2" put on and then moved off it, so it is Changed. */
const changedOnMine = () => {
  mockLive = withGain(4);
  putOnSavedEq(mine);
  mockLive = withGain(6);
  mockFeed.mockClear();
};

/** The disk and the name, whatever their faces say, and the menu open. */
const keyOf = (className: string): HTMLButtonElement => {
  const key = document.querySelector<HTMLButtonElement>(className);
  if (!key) {
    throw new Error(`No ${className} on screen`);
  }
  return key;
};
const disk = () => keyOf('.eq-save-trigger');
const nameKey = () => keyOf('.eq-load-trigger');
const openMenu = () => screen.getByRole('menu');
const loads = () =>
  mockFeed.mock.calls.filter(
    ([event]) => (event as { kind?: string }).kind === 'putOn',
  );

/** Press it, and let what it sent to main come back. */
const press = async (element: Element) => {
  await act(async () => {
    fireEvent.click(element);
  });
};

/** Each in turn, every press finished before the next. */
const inTurn = <T,>(items: readonly T[], run: (item: T) => Promise<void>) =>
  items.reduce<Promise<void>>(
    (previous, item) => previous.then(() => run(item)),
    Promise.resolve(),
  );

const isEnabled = (element: HTMLElement) =>
  !(element instanceof HTMLButtonElement && element.disabled);

/**
 * Every entry the disk's menu opens with, each pressed in a window of its
 * own, and then every press that entry brought into the menu (the form's
 * Save, the saved row's Undo): one level of everything under the disk.
 */
const pressEverythingUnderTheDisk = async (setUp: () => void) => {
  // Every window starts from the same state: nothing worn, nothing to undo.
  resetSavedEqActions();
  setUp();
  const first: RenderResult = render(<SavedEqKeys />);
  fireEvent.click(disk());
  const items = within(openMenu()).queryAllByRole('menuitem');
  // With nothing on, the disk opens straight on the form: its buttons are
  // the entries.
  const role = items.length > 0 ? 'menuitem' : 'button';
  const entries = within(openMenu())
    .queryAllByRole(role)
    .map((entry) => entry.textContent ?? '');
  first.unmount();
  const pressed: string[] = [];
  await inTurn(entries, async (entry) => {
    resetSavedEqActions();
    setUp();
    const view = render(<SavedEqKeys />);
    fireEvent.click(disk());
    const item = within(openMenu())
      .queryAllByRole(role)
      .find((one) => one.textContent === entry);
    if (item && isEnabled(item)) {
      await press(item);
      pressed.push(entry);
      const menu = screen.queryByRole('menu');
      const after = menu
        ? [
            ...within(menu).queryAllByRole('menuitem'),
            ...within(menu).queryAllByRole('button'),
          ].filter(isEnabled)
        : [];
      await inTurn(after, press);
    }
    view.unmount();
  });
  return pressed;
};

beforeEach(() => {
  resetSavedEqActions();
  mockFeed.mockClear();
  mockUpdateEq.mockClear();
  mockSaveEq.mockClear();
  mockEqs = [mine, lateNight];
  mockLive = withGain(0);
});

describe('the disk', () => {
  it('never loads a saved EQ, whatever is pressed under it', async () => {
    // The one on changed; then nothing on; then the one on playing exactly.
    const changed = await pressEverythingUnderTheDisk(changedOnMine);
    const nothingOn = await pressEverythingUnderTheDisk(() => {
      mockLive = withGain(1);
    });
    const playing = await pressEverythingUnderTheDisk(() => {
      mockLive = withGain(4);
      putOnSavedEq(mine);
      mockFeed.mockClear();
    });
    // Something really was pressed in every case, saves among them.
    expect(changed).toEqual([
      expect.stringContaining('Save changes to “My EQ 2”'),
      'Save as new EQ…',
    ]);
    expect(nothingOn.length).toBeGreaterThan(0);
    expect(playing).toEqual(['Save as new EQ…']);
    expect(mockUpdateEq).toHaveBeenCalled();
    expect(mockSaveEq).toHaveBeenCalled();
    expect(loads()).toEqual([]);
  });

  it('saves the changes over the EQ that is on and offers Undo in their place', async () => {
    changedOnMine();
    render(<SavedEqKeys />);
    fireEvent.click(disk());
    await press(
      within(openMenu()).getByRole('menuitem', {
        name: /Save changes to “My EQ 2”/,
      }),
    );
    expect(mockUpdateEq).toHaveBeenLastCalledWith('mine', withGain(6));
    // The menu stays open on the saved row, with Undo.
    expect(within(openMenu()).getByText('“My EQ 2” is saved')).toBeVisible();
    await press(
      within(openMenu()).getByRole('menuitem', {
        name: 'Undo saving “My EQ 2”',
      }),
    );
    expect(mockUpdateEq).toHaveBeenLastCalledWith('mine', withGain(4));
    expect(loads()).toEqual([]);
  });

  it('opens straight on the name of a new EQ while none is on', () => {
    render(<SavedEqKeys />);
    fireEvent.click(disk());
    expect(within(openMenu()).getByText('Save this EQ')).toBeVisible();
    expect(within(openMenu()).queryAllByRole('menuitem')).toEqual([]);
  });

  it('wears the amber dot while the EQ that is on has changed', () => {
    changedOnMine();
    render(<SavedEqKeys />);
    expect(disk()).toHaveAccessibleName('Save changes to “My EQ 2”');
    expect(disk().querySelector('.eq-save-trigger__changed')).not.toBeNull();
  });
});

describe('the name', () => {
  it('says which saved EQ is on, and loads the one pressed in its menu', async () => {
    changedOnMine();
    render(<SavedEqKeys />);
    expect(nameKey()).toHaveTextContent('My EQ 2');
    fireEvent.click(nameKey());
    await press(
      within(openMenu()).getByRole('menuitem', { name: 'Load Late night' }),
    );
    expect(loads()).toEqual([[{ kind: 'putOn', sound: lateNight.sound }]]);
    expect(mockUpdateEq).not.toHaveBeenCalled();
    expect(mockSaveEq).not.toHaveBeenCalled();
  });

  it('takes the EQ that is on back to how it was saved', async () => {
    changedOnMine();
    render(<SavedEqKeys />);
    fireEvent.click(nameKey());
    await press(
      within(openMenu()).getByRole('menuitem', {
        name: 'Reload My EQ 2 as it was saved',
      }),
    );
    expect(loads()).toEqual([[{ kind: 'putOn', sound: mine.sound }]]);
  });

  it('asks before Manage writes what plays over another saved EQ', async () => {
    changedOnMine();
    render(<SavedEqKeys />);
    fireEvent.click(nameKey());
    fireEvent.click(
      within(openMenu()).getByRole('menuitem', { name: 'Manage saved EQs…' }),
    );
    fireEvent.click(
      screen.getByRole('button', { name: 'More for Late night' }),
    );
    fireEvent.click(
      within(
        screen.getByRole('menu', { name: 'More for Late night' }),
      ).getByRole('menuitem', { name: 'Update with what’s playing' }),
    );
    // Asked in the row, and nothing written yet.
    expect(
      screen.getByText('Replace “Late night” with what’s playing?'),
    ).toBeVisible();
    expect(mockUpdateEq).not.toHaveBeenCalled();
    await press(screen.getByRole('button', { name: 'Replace' }));
    expect(mockUpdateEq).toHaveBeenCalledWith('late', withGain(6));
    expect(loads()).toEqual([]);
  });
});
