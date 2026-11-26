/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * The Preset tab's menu, its notes, and the way in from Auto EQ (Ivan,
 * 2026-11-26).
 *
 * - A factory preset's card has a ⋯, and a right-click or the keyboard's
 *   menu key opens the same menu: Edit a copy first, never an edit of the
 *   preset itself; one of the listener's own keeps Edit, Rename, Duplicate.
 * - The notes beside the grid are one view for every preset: a genre's
 *   shows its stages with the figures each stage's picker prints AND the
 *   genre's own line for the stage, what it left off and the records to
 *   hear it in; a classic one shows its stages alone.
 * - Auto EQ's song card names the preset playing as a press, which opens
 *   the Preset tab on that preset rather than the one it was left on.
 */

import '@testing-library/jest-dom';
import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { translate, type TranslationKey } from 'common/i18n';
import type { ISongSoundNow } from 'renderer/audio/songSoundSession';
import { dspPresetCatalog } from 'renderer/dsp/dspPresetCatalog';
import { applyDspSettings, readDspSettings } from 'renderer/dsp/store';
import EqPresetTab from 'renderer/eq/EqPresetTab';
import AutoEqNowPlaying from 'renderer/eq/autoEq/AutoEqNowPlaying';
import { setEqPresetQuery, useEqPresetToShow } from 'renderer/eq/eqLayerTab';
import openEqPresetTab from 'renderer/eq/openEqPresetTab';
import OwnPresetTile from 'renderer/eq/ownPresets/OwnPresetTile';
import { FactoryPresetNotes } from 'renderer/eq/presetCard/PresetNotes';
import PresetTile from 'renderer/eq/presetCard/PresetTile';
import type { IPresetCurveDesign } from 'renderer/eq/presetCard/presetCardDrawing';

const t = (key: TranslationKey, vars?: Record<string, string | number>) =>
  translate('en', key, vars);

jest.mock('renderer/utils/I18nContext', () => ({
  ...jest.requireActual('renderer/utils/I18nContext'),
  useTranslation: () => ({
    locale: 'en',
    t: (key: TranslationKey, vars?: Record<string, string | number>) =>
      jest.requireActual('common/i18n').translate('en', key, vars),
  }),
}));
jest.mock('renderer/eq/presetCard/PresetCardCurve', () => () => null);
// The tab's own shell, as `eqPresetTab.test.tsx` gives it: the equaliser
// on, nothing playing, Equalizer APO not the engine, no game sounding.
const mockApply = jest.fn(() => Promise.resolve());
jest.mock('renderer/dsp/useDspPresetSelection', () => ({
  useDspPresetSelection: () => ({ apply: mockApply, selecting: false }),
}));
jest.mock('renderer/utils/FluidEqContext', () => ({
  ...jest.requireActual('renderer/utils/FluidEqContext'),
  ...jest.requireActual('__tests__/utils/fluidEqHookMocks').eqHooksFrom(() => ({
    isEnabled: true,
    isBlockingError: false,
    voicing: undefined,
  })),
}));
jest.mock('renderer/utils/useAudioEngineStatus', () => ({
  ...jest.requireActual('renderer/utils/useAudioEngineStatus'),
  useKnownAudioEngineStatus: () => undefined,
}));
jest.mock('renderer/games/useGameSound', () => ({
  ...jest.requireActual('renderer/games/useGameSound'),
  useSoundingGame: () => undefined,
}));
jest.mock('renderer/utils/useTrebleDesigns', () => ({
  ...jest.requireActual('renderer/utils/useTrebleDesigns'),
  useTrebleDesigns: () => undefined,
}));
jest.mock('renderer/utils/useOutputRate', () => () => undefined);

const entry = (id: string) => {
  const found = dspPresetCatalog(t).find((preset) => preset.id === id);
  if (!found) {
    throw new Error(`No preset ${id}`);
  }
  return found;
};

const pop = entry('pop');
// A classic preset, one of the tab's Basic group: a chain with no genre notes.
const classic = entry('movie');

const menuItems = () =>
  within(screen.getByRole('menu'))
    .getAllByRole('menuitem')
    .map((item) => (item.textContent ?? '').trim());

// The tab brings a preset it is asked to show into view; jsdom lays nothing
// out and has no scrolling to do it with.
beforeAll(() => {
  Element.prototype.scrollIntoView = jest.fn();
});

beforeEach(() => {
  mockApply.mockClear();
  act(() => setEqPresetQuery(''));
});

describe('a factory preset card', () => {
  const renderPop = (onEditCopy = jest.fn()) => {
    render(
      <PresetTile
        preset={pop}
        hint="hint"
        isPlaying={false}
        isDisabled={false}
        isFavourite={false}
        starLabel={t('library.playlist.addToFavorites')}
        design={{} as IPresetCurveDesign}
        onToggleStar={jest.fn()}
        onApply={jest.fn()}
        onPoint={jest.fn()}
        onEditCopy={onEditCopy}
      />,
    );
    return onEditCopy;
  };

  it('opens its menu on a right-click, with Edit a copy first', () => {
    const onEditCopy = renderPop();
    expect(screen.queryByRole('menu')).toBeNull();
    fireEvent.contextMenu(screen.getByRole('button', { name: /^Pop/ }));
    expect(menuItems()).toEqual([
      t('eq.own.editCopy'),
      t('library.playlist.addToFavorites'),
      t('genre.notes.full'),
    ]);
    fireEvent.click(
      screen.getByRole('menuitem', { name: t('eq.own.editCopy') }),
    );
    expect(onEditCopy).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('menu')).toBeNull();
  });

  it('POSITIVE CONTROL: its ⋯ opens the same menu', () => {
    renderPop();
    fireEvent.click(
      screen.getByRole('button', { name: t('eq.own.more', { name: 'Pop' }) }),
    );
    expect(menuItems()[0]).toBe(t('eq.own.editCopy'));
    expect(menuItems()).toHaveLength(3);
  });

  it('puts the focus on the first item, for a menu opened from the keys', () => {
    renderPop();
    fireEvent.contextMenu(screen.getByRole('button', { name: /^Pop/ }));
    expect(
      screen.getByRole('menuitem', { name: t('eq.own.editCopy') }),
    ).toHaveFocus();
    fireEvent.keyDown(document.activeElement ?? document.body, {
      key: 'ArrowDown',
    });
    expect(
      screen.getByRole('menuitem', {
        name: t('library.playlist.addToFavorites'),
      }),
    ).toHaveFocus();
  });
});

describe('one of the listener’s own presets', () => {
  it('opens its own menu on a right-click: Edit, never Edit a copy', () => {
    render(
      <OwnPresetTile
        preset={{ ...pop, id: 'user-chain:mine', name: 'My Pop' }}
        curveDesign={{} as IPresetCurveDesign}
        hint="hint"
        isPlaying={false}
        isDisabled={false}
        isRenaming={false}
        isFavourite={false}
        starLabel={t('library.playlist.addToFavorites')}
        onToggleStar={jest.fn()}
        onApply={jest.fn()}
        onPoint={jest.fn()}
        onEdit={jest.fn()}
        onRenameStart={jest.fn()}
        onRenameEnd={jest.fn()}
        onDuplicate={jest.fn()}
        onAskDelete={jest.fn()}
        onShare={jest.fn()}
        onCopyLink={jest.fn()}
        onExport={jest.fn()}
      />,
    );
    fireEvent.contextMenu(screen.getByRole('button', { name: /^My Pop/ }));
    const items = menuItems();
    expect(items.slice(0, 3)).toEqual([
      t('eq.own.edit'),
      t('myCurves.rename'),
      t('myCurves.duplicate'),
    ]);
    expect(items).not.toContain(t('eq.own.editCopy'));
  });
});

describe('the notes of a factory preset', () => {
  it('show a genre’s stages with their figures and the genre’s own notes', () => {
    render(
      <FactoryPresetNotes
        preset={pop}
        isDisabled={false}
        onEditCopy={jest.fn()}
      />,
    );
    expect(screen.getByText('Pop')).toBeInTheDocument();
    expect(
      screen.getByText(t('genre.pop.hook' as TranslationKey)),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: t('eq.own.editCopy') }),
    ).toBeEnabled();
    const rack = screen.getByText(t('eq.preset.rack')).closest('section');
    if (!rack) {
      throw new Error('No rack section');
    }
    const deEsser = within(rack)
      .getByText(t('dsp.deEsser.title'))
      .closest('li');
    if (!deEsser) {
      throw new Error('No De-esser row');
    }
    // The figures the De-esser's picker prints, and Pop's own line for it.
    expect(deEsser).toHaveTextContent(t('dsp.deEsser.upTo', { db: '−1.5 dB' }));
    expect(deEsser).toHaveTextContent(
      t('genre.pop.stage.deEsser' as TranslationKey),
    );
    const maximizer = within(rack)
      .getByText(t('dsp.maximizer.title'))
      .closest('li');
    expect(maximizer).toHaveTextContent('-1.0 dBTP');
    expect(
      within(rack).getByText(t('genre.notes.leftOff')),
    ).toBeInTheDocument();
    expect(
      within(rack).getByText(t('genre.pop.off' as TranslationKey)),
    ).toBeInTheDocument();
    expect(screen.getByText(t('genre.notes.listen'))).toBeInTheDocument();
  });

  it('POSITIVE CONTROL: a classic one shows its stages, and no genre’s notes', () => {
    render(
      <FactoryPresetNotes
        preset={classic}
        isDisabled={false}
        onEditCopy={jest.fn()}
      />,
    );
    expect(screen.getByText(t('eq.preset.factoryAbout'))).toBeInTheDocument();
    expect(screen.getByText(t('eq.preset.rack'))).toBeInTheDocument();
    expect(screen.queryByText(t('genre.notes.leftOff'))).toBeNull();
    expect(screen.queryByText(t('genre.notes.listen'))).toBeNull();
    expect(screen.queryByText(t('genre.notes.full'))).toBeNull();
  });
});

describe('Auto EQ’s song card', () => {
  const now = (presetId: string): ISongSoundNow => ({
    identity: {
      key: 'k',
      title: 'Neon Lights',
      artist: 'Demi',
      source: 'library',
    },
    isPlaying: true,
    owner: 'album',
    presetId,
    albumTitle: 'Unbroken',
    canSave: false,
    isChanged: false,
  });

  const movieTile = () => document.querySelector('[data-preset-id="movie"]');
  const notesName = () =>
    document.querySelector(
      '.eq-preset-tab__detail-body .eq-preset-tab__about strong',
    )?.textContent;

  it('opens the Preset tab on the preset it names', () => {
    render(
      <AutoEqNowPlaying now={now('movie')} onShowPreset={openEqPresetTab} />,
    );
    fireEvent.click(
      screen.getByRole('button', { name: new RegExp(classic.name) }),
    );
    // The tab, mounted after the press as the EQ page is, opens on Movie:
    // the first group that holds it (it is a favourite out of the box), its
    // tile in that grid, and its notes beside it, though nothing plays and
    // the tab would otherwise open on the genres.
    render(<EqPresetTab />);
    expect(movieTile()).toBeInTheDocument();
    expect(notesName()).toBe(classic.name);
  });

  it('POSITIVE CONTROL: the tab opened with no ask stays on its own group', () => {
    render(<EqPresetTab />);
    expect(movieTile()).toBeNull();
    expect(notesName()).not.toBe(classic.name);
  });

  it('follows a preset played after it, not the one it was asked for', () => {
    act(() => openEqPresetTab('movie'));
    render(<EqPresetTab />);
    expect(notesName()).toBe(classic.name);
    const other = document.querySelector<HTMLElement>(
      '[data-preset-id]:not([data-preset-id="movie"])',
    );
    const press = other?.querySelector<HTMLButtonElement>(
      '.eq-preset-tab__tile',
    );
    if (!other || !press) {
      throw new Error('No other tile beside Movie');
    }
    fireEvent.click(press);
    expect(mockApply).toHaveBeenCalledWith(other.dataset.presetId);
    expect(notesName()).not.toBe(classic.name);
  });

  it('lets the shown preset go once another starts playing elsewhere', () => {
    const before = readDspSettings();
    try {
      act(() => openEqPresetTab('movie'));
      render(<EqPresetTab />);
      expect(notesName()).toBe(classic.name);
      // Speech put on from somewhere else: the titlebar's plate, a song.
      act(() =>
        applyDspSettings({ ...before, enabled: true, presetId: 'speech' }),
      );
      expect(notesName()).toBe(entry('speech').name);
    } finally {
      act(() => applyDspSettings(before));
    }
  });

  it('spends the ask once the tab has taken it', () => {
    act(() => openEqPresetTab('pop'));
    const { unmount } = render(<EqPresetTab />);
    unmount();
    const Probe = () => <span>{useEqPresetToShow() ?? 'nothing'}</span>;
    render(<Probe />);
    expect(screen.getByText('nothing')).toBeInTheDocument();
  });

  it('is no press for None, nor for a saved EQ that plays', () => {
    const onShowPreset = jest.fn();
    const { unmount } = render(
      <AutoEqNowPlaying now={now('none')} onShowPreset={onShowPreset} />,
    );
    expect(screen.queryByRole('button')).toBeNull();
    unmount();
    render(
      <AutoEqNowPlaying
        now={now('pop')}
        eqName="My EQ"
        onShowPreset={onShowPreset}
      />,
    );
    expect(screen.queryByRole('button')).toBeNull();
  });
});
