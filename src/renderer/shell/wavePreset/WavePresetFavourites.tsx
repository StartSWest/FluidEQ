/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { type ReactNode, useLayoutEffect, useRef, useState } from 'react';
import { searchMatcher } from '../../../common/searchText';
import { dspPresetStages } from '../../dsp/dspPresetCatalog';
import { applyDspSettings, persistDspSettings } from '../../dsp/store';
import { useDspPresetSelection } from '../../dsp/useDspPresetSelection';
import VoicingIcon from '../../icons/VoicingIcon';
import { useFluidEqLayers } from '../../utils/FluidEqContext';
import { useTranslation } from '../../utils/I18nContext';
import { presetGlyph, usePlayingPreset } from '../../components/useVoicingPick';
import WavePresetRow from './WavePresetRow';

/** Past this many starred presets the list gets a field to narrow it. */
const FILTER_FROM = 8;

/**
 * Marks the list as having more above or below what shows, for its fades
 * (`WavePreset.scss`). Read on a scroll and when what it holds changes,
 * never per frame.
 */
const markFades = (list: HTMLElement) => {
  const above = list.scrollTop > 1;
  const below = list.scrollTop + list.clientHeight < list.scrollHeight - 1;
  list.toggleAttribute('data-more-above', above);
  list.toggleAttribute('data-more-below', below);
};

interface IWavePresetFavouritesProps {
  isOpen: boolean;
  close: () => void;
}

/**
 * The music's part of the plate's panel: None to clear the preset in one
 * press, then the listener's starred presets ("only the favs, nothing
 * more"), in the Preset tab's order.
 *
 * A long list scrolls inside the panel between None and the foot, which stay
 * where they are, and past eight it gets a field to narrow it ("there is no
 * way to shorten that list, it could be long"). What plays when it is no
 * favourite stands under None as the chosen row, so the list never hides it.
 *
 * Never in a game's panel: a game's sound is tuned in the Gaming Lab alone.
 */
const WavePresetFavourites = ({
  isOpen,
  close,
}: IWavePresetFavouritesProps) => {
  const { t } = useTranslation();
  const { settings, favorites, activeId, active } = usePlayingPreset();
  const { isEnabled, isBlockingError } = useFluidEqLayers();
  const { apply, selecting } = useDspPresetSelection(
    settings,
    applyDspSettings,
    persistDspSettings,
    true,
  );
  const [query, setQuery] = useState('');
  const listRef = useRef<HTMLDivElement>(null);
  const isDisabled = isBlockingError || !isEnabled || selecting;
  const hasFilter = favorites.length > FILTER_FROM;
  const matches = query.trim()
    ? favorites.filter((preset) => searchMatcher(query)(preset.name))
    : favorites;

  // A panel opened again starts without the last search.
  useLayoutEffect(() => {
    if (!isOpen) {
      setQuery('');
    }
  }, [isOpen]);
  useLayoutEffect(() => {
    if (listRef.current) {
      markFades(listRef.current);
    }
  }, [matches.length, isOpen]);

  const play = (id: string) => {
    close();
    // The one playing is already playing: the press only closes the list.
    if (id !== activeId) {
      apply(id).catch(() => undefined);
    }
  };
  // What each preset does, as the mockup says it: its curve, then the rack's
  // stages (the EQ only where the rack's own runs).
  const hintOf = (preset: (typeof favorites)[number]) =>
    [
      ...(preset.curve ? [t('eq.own.curve')] : []),
      ...dspPresetStages({ settings: preset.settings, curve: undefined }, t),
    ].join(' · ');
  const playingElsewhere =
    active && !favorites.some((preset) => preset.id === active.id)
      ? active
      : undefined;

  let favouriteRows: ReactNode;
  if (favorites.length === 0) {
    favouriteRows = (
      <p className="wave-preset-menu__note">{t('wavePreset.starHint')}</p>
    );
  } else if (matches.length === 0) {
    favouriteRows = <p className="rich-pick__empty">{t('common.noMatches')}</p>;
  } else {
    favouriteRows = matches.map((preset) => (
      <WavePresetRow
        key={preset.id}
        glyph={presetGlyph(preset, 'wave-preset-menu__glyph')}
        name={preset.name}
        hint={hintOf(preset)}
        checked={preset.id === activeId}
        disabled={isDisabled}
        onPress={() => play(preset.id)}
      />
    ));
  }

  return (
    <>
      <div className="wave-preset-menu__lead">
        <WavePresetRow
          glyph={
            <VoicingIcon profileId="none" className="wave-preset-menu__glyph" />
          }
          name={t('voicing.none')}
          hint={t('wavePreset.noneHint')}
          checked={activeId === 'none'}
          disabled={isDisabled}
          onPress={() => play('none')}
        />
        {playingElsewhere && (
          <WavePresetRow
            glyph={presetGlyph(playingElsewhere, 'wave-preset-menu__glyph')}
            name={playingElsewhere.name}
            hint={t('wavePreset.playingNow')}
            checked
            onPress={close}
          />
        )}
      </div>
      <span className="wave-preset-menu__group">
        {hasFilter
          ? `${t('dsp.favorites.title')} · ${favorites.length}`
          : t('dsp.favorites.title')}
      </span>
      {hasFilter && (
        <div className="wave-preset-menu__search">
          <svg viewBox="0 0 16 16" aria-hidden>
            <circle cx="7" cy="7" r="4.5" />
            <path d="M10.5 10.5L14 14" />
          </svg>
          <input
            type="text"
            value={query}
            placeholder={t('wavePreset.find')}
            aria-label={t('wavePreset.find')}
            onChange={(event) => setQuery(event.target.value)}
            // Enter plays the only one left, as every search here does.
            onKeyDown={(event) => {
              if (event.key === 'Enter' && matches.length === 1) {
                play(matches[0].id);
              }
            }}
          />
        </div>
      )}
      <div
        ref={listRef}
        className="wave-preset-menu__list"
        data-anchored-menu-scroll
        onScroll={(event) => markFades(event.currentTarget)}
      >
        {favouriteRows}
      </div>
    </>
  );
};

export default WavePresetFavourites;
