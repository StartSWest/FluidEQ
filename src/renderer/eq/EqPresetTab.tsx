/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026> <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { useState } from 'react';
import type { TranslationKey } from '../../common/i18n/en';
import {
  NONE_CHAIN_ID,
  QUICK_DSP_PRESETS,
  activeDspPresetId,
  dspPresetRowHint,
  dspPresetStages,
  useDspPresetCatalog,
  type IDspCatalogEntry,
} from '../dsp/dspPresetCatalog';
import {
  applyDspSettings,
  persistDspSettings,
  useDspSettings,
} from '../dsp/store';
import { useDspPresetSelection } from '../dsp/useDspPresetSelection';
import GenreNotesPreview from '../dsp/GenreNotesPreview';
import { genreNotesFor } from '../dsp/genreNotesModel';
import GameSoundPresetButton from '../games/GameSoundPresetButton';
import { useSoundingGame } from '../games/useGameSound';
import VoicingIcon from '../icons/VoicingIcon';
import { useFluidEqLayers } from '../utils/FluidEqContext';
import { useTranslation } from '../utils/I18nContext';
import { useKnownAudioEngineStatus } from '../utils/useAudioEngineStatus';
import { setEqPresetQuery, useEqPresetQuery } from './eqLayerTab';

type TPresetGroup = 'favorites' | 'saved' | 'classic' | 'genre';

const GROUP_LABEL: Record<TPresetGroup, TranslationKey> = {
  favorites: 'dsp.favorites.title',
  saved: 'dsp.eqPreset.saved',
  classic: 'dsp.quick.classics',
  genre: 'voicing.groupGenre',
};

const GROUPS: readonly TPresetGroup[] = [
  'favorites',
  'saved',
  'classic',
  'genre',
];

/** The press does nothing to close: the notes beside the grid are no menu. */
const keepOpen = () => undefined;

/**
 * The Preset tab: every preset the toolbar's pick offers, laid out to be
 * browsed rather than scrolled in a menu (Ivan, 2026-11-16, "One pane, inset
 * cards", EQ · Preset tab): the groups down the side, the presets of one as
 * a grid, and what the one under the pointer (or the one playing) does,
 * beside it. The same list as `VoicingQuickPick` and the same press: a
 * preset picked here is the one the pick shows, and the other way round.
 */
const EqPresetTab = () => {
  const { t } = useTranslation();
  const settings = useDspSettings();
  const { favorites, catalog } = useDspPresetCatalog(t);
  const { isEnabled, isBlockingError, voicing } = useFluidEqLayers();
  const status = useKnownAudioEngineStatus();
  const isApo = status?.engine === 'apo';
  const query = useEqPresetQuery().trim().toLocaleLowerCase();
  const { apply } = useDspPresetSelection(
    settings,
    applyDspSettings,
    persistDspSettings,
    true,
  );
  const chosen = activeDspPresetId(settings, voicing);
  const activeId =
    chosen === undefined || chosen === NONE_CHAIN_ID ? 'none' : chosen;
  const sounding = useSoundingGame();

  const members: Record<TPresetGroup, IDspCatalogEntry[]> = {
    favorites,
    saved: catalog.filter((preset) => preset.group === 'saved'),
    // Equalizer APO takes a chain's EQ curve and nothing else, so there a
    // Room copy is the chain it copies under a name that promises a room.
    classic: QUICK_DSP_PRESETS.flatMap((id) => {
      const preset = catalog.find((one) => one.id === id);
      return preset && !(isApo && preset.settings.room.enabled) ? [preset] : [];
    }),
    genre: catalog.filter((preset) => preset.group === 'genre'),
  };
  const groups = GROUPS.filter((group) => members[group].length > 0);
  const playingGroup = groups.find((group) =>
    members[group].some((preset) => preset.id === activeId),
  );
  const [picked, setPicked] = useState<TPresetGroup | undefined>(undefined);
  const group: TPresetGroup = picked ?? playingGroup ?? 'genre';
  const [pointedAt, setPointedAt] = useState<string | undefined>(undefined);

  // A search looks in every group at once, each preset once.
  const searched = Array.from(
    new Map(
      groups
        .flatMap((one) => members[one])
        .map((preset) => [preset.id, preset] as const),
    ).values(),
  ).filter((preset) => preset.name.toLocaleLowerCase().includes(query));
  const shown = query ? searched : members[group];
  // Not while a preset is being put on: disabling every tile for that half
  // second dimmed the whole grid and brought it back, which read as every
  // preset blinking at each press (Ivan, 2026-11-17). A second press needs
  // no guard either: `apply` counts its presses and only the last one lands.
  const isDisabled = isBlockingError || !isEnabled;

  const focused = catalog.find(
    (preset) => preset.id === (pointedAt ?? activeId),
  );
  const stages = focused ? dspPresetStages(focused, t) : [];
  // Nothing in the catalogue: no preset at all, or a curve that is none of
  // them, which the tab's chip calls Custom (`EqLayerTabs`) and so does this.
  let aboutName = t('voicing.none');
  let aboutHint: string | undefined = t('voicing.none.hint');
  if (focused) {
    aboutName = focused.name;
    aboutHint = dspPresetRowHint(focused, t);
  } else if (activeId !== 'none') {
    aboutName = t('dsp.eqPreset.custom');
    aboutHint = undefined;
  }

  // A game's own sound loaded: the game is the preset, changed only in the
  // Gaming Lab, which the button's place opens.
  if (sounding) {
    return (
      <div className="eq-preset-tab eq-preset-tab--game">
        <GameSoundPresetButton game={sounding} />
      </div>
    );
  }

  return (
    <div className="eq-preset-tab">
      <nav className="eq-preset-tab__groups" aria-label={t('eq.preset.groups')}>
        {groups.map((one) => (
          <button
            key={one}
            type="button"
            className="eq-preset-tab__group"
            aria-pressed={!query && one === group}
            onClick={() => setPicked(one)}
          >
            <span>{t(GROUP_LABEL[one])}</span>
            <span className="eq-preset-tab__count">{members[one].length}</span>
          </button>
        ))}
      </nav>

      <div className="eq-preset-tab__list">
        <div className="eq-preset-tab__head">
          <strong>
            {query ? t('eq.preset.results') : t(GROUP_LABEL[group])}
          </strong>
          <span>{t('eq.preset.count', { count: shown.length })}</span>
        </div>
        {shown.length === 0 ? (
          <p className="eq-preset-tab__empty">{t('eq.preset.empty')}</p>
        ) : (
          <div
            className="eq-preset-tab__grid"
            onPointerLeave={() => setPointedAt(undefined)}
          >
            {/* Off is a preset of its own, first in the classics, where the
                pick lists it first. */}
            {!query && group === 'classic' && (
              <button
                type="button"
                className="eq-preset-tab__tile"
                aria-pressed={activeId === 'none'}
                disabled={isDisabled}
                onClick={() => {
                  apply('none').catch(() => undefined);
                }}
              >
                <VoicingIcon className="eq-preset-tab__glyph" />
                <span className="eq-preset-tab__words">
                  <strong>{t('voicing.none')}</strong>
                  <span>{t('voicing.none.hint')}</span>
                </span>
              </button>
            )}
            {shown.map((preset) => (
              <button
                key={preset.id}
                type="button"
                className="eq-preset-tab__tile"
                aria-pressed={preset.id === activeId}
                disabled={isDisabled}
                onPointerEnter={() => setPointedAt(preset.id)}
                onFocus={() => setPointedAt(preset.id)}
                onClick={() => {
                  apply(preset.id).catch(() => undefined);
                }}
              >
                <VoicingIcon
                  profileId={preset.id}
                  className="eq-preset-tab__glyph"
                />
                <span className="eq-preset-tab__words">
                  <strong>{preset.name}</strong>
                  <span>
                    {isApo ? t('dsp.quick.apo') : dspPresetRowHint(preset, t)}
                  </span>
                </span>
              </button>
            ))}
          </div>
        )}
      </div>

      <aside className="eq-preset-tab__detail" aria-live="polite">
        {/* Keyed by the preset it describes, so each one comes in on its
          own short fade rather than the words swapping in place (Ivan,
          2026-11-17: "a smooth transition between one and the other, nicely
          but fast"). */}
        {/* A preset only pointed at waits half a second before its notes
          show (`is-pointed`): running the pointer down the grid flashed a
          new panel at every tile, which a reader sensitive to flashing
          should not be shown (Ivan, 2026-11-18). The panel keeps its place
          all the while. */}
        <div
          className={`eq-preset-tab__detail-body${
            pointedAt === undefined ? '' : ' is-pointed'
          }`}
          key={focused?.id ?? ''}
        >
          {focused && genreNotesFor(focused.id) ? (
            <GenreNotesPreview chainId={focused.id} closeMenu={keepOpen} />
          ) : (
            <div className="eq-preset-tab__about">
              <strong>{aboutName}</strong>
              {aboutHint && <span>{aboutHint}</span>}
            </div>
          )}
          {stages.length > 0 && (
            <div className="eq-preset-tab__stages">
              <span className="eq-preset-tab__eyebrow">
                {t('eq.preset.rack')}
              </span>
              <ul>
                {stages.map((stage) => (
                  <li key={stage}>{stage}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </aside>
    </div>
  );
};

/**
 * The Preset tab's search, in its tools on the tab row: it narrows the grid
 * to the presets whose names hold what is typed, across every group.
 */
export const EqPresetSearch = () => {
  const { t } = useTranslation();
  const query = useEqPresetQuery();
  return (
    <div className="eq-preset-search">
      <svg
        className="eq-toolbar__icon"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        aria-hidden="true"
      >
        <path d="M11 5a6 6 0 1 0 0 12 6 6 0 0 0 0-12zM20 20l-4.6-4.6" />
      </svg>
      <input
        type="search"
        value={query}
        placeholder={t('eq.preset.search')}
        aria-label={t('eq.preset.search')}
        onChange={(event) => setEqPresetQuery(event.target.value)}
      />
    </div>
  );
};

export default EqPresetTab;
