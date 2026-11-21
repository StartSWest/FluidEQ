/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import type { ReactNode } from 'react';
import {
  NONE_CHAIN_ID,
  QUICK_DSP_PRESETS,
  activeDspPresetId,
  dspPresetRowHint,
  useDspPresetCatalog,
  type IDspCatalogEntry,
} from '../dsp/dspPresetCatalog';
import {
  applyDspSettings,
  persistDspSettings,
  useDspSettings,
} from '../dsp/store';
import { useDspPresetSelection } from '../dsp/useDspPresetSelection';
import { toggleFavouriteDspPreset } from '../dsp/favouriteDspPresets';
import VoicingIcon from '../icons/VoicingIcon';
import { useFluidEqLayers } from '../utils/FluidEqContext';
import { useTranslation } from '../utils/I18nContext';
import { useKnownAudioEngineStatus } from '../utils/useAudioEngineStatus';
import type { IRichPickEntry, IRichPickFavourites } from '../widgets/RichPick';

/** A preset of the listener's own: the Preset tab's Yours. */
export const isOwnPreset = (preset: IDspCatalogEntry | undefined): boolean =>
  preset?.group === 'saved';

/**
 * A preset's glyph as every preset list draws it: its own for a factory
 * preset, and for one of the listener's the curve with its handle, in the
 * Preset layer's violet their presets wear (`_ownPresets.scss`).
 */
export const presetGlyph = (
  preset: IDspCatalogEntry,
  className: string,
): ReactNode =>
  isOwnPreset(preset) ? (
    <VoicingIcon profileId="ownCurve" className={`${className} is-own`} />
  ) : (
    <VoicingIcon profileId={preset.id} className={className} />
  );

/**
 * Which preset plays, read as the EQ page's Preset tab reads it
 * (`activeDspPresetId`): the rack's own while it runs, the Preset layer's
 * otherwise. A pick, a song's or album's sound and Auto EQ all land in one or
 * the other, so every one of them renames whatever shows this — the presets
 * quick pick, the titlebar's plate (`WavePresetMusic`) — in the same render.
 */
export const usePlayingPreset = () => {
  const { t } = useTranslation();
  const settings = useDspSettings();
  const { favorites, catalog } = useDspPresetCatalog(t);
  const { voicing } = useFluidEqLayers();
  // What the window already holds: asking main on mount ran the engine
  // helper again every time the equaliser's page or the player's deck opened.
  const status = useKnownAudioEngineStatus();
  // One None for two states: nothing chosen at all, and the None chain the
  // DSP page may have put on a running rack. Picked here, it is the first.
  const chosen = activeDspPresetId(settings, voicing);
  const activeId =
    chosen === undefined || chosen === NONE_CHAIN_ID ? 'none' : chosen;
  return {
    settings,
    favorites,
    catalog,
    activeId,
    /** The playing preset, or undefined for none or a curve nobody named. */
    active: catalog.find((preset) => preset.id === activeId),
    /** Equalizer APO is the engine: a preset plays its curve and no rack. */
    isApo: status?.engine === 'apo',
  };
};

/**
 * What the presets quick pick lists, which row is playing, and what a press
 * does, for the player's deck (`VoicingQuickPick`).
 */
const useVoicingPick = () => {
  const { t } = useTranslation();
  const { settings, favorites, catalog, activeId, active, isApo } =
    usePlayingPreset();
  const { isEnabled, isBlockingError } = useFluidEqLayers();
  const { apply, selecting } = useDspPresetSelection(
    settings,
    applyDspSettings,
    persistDspSettings,
    true,
  );
  const favouriteIds = new Set(favorites.map((preset) => preset.id));
  const rows: Array<IDspCatalogEntry & { group: string }> = [
    ...favorites.map((preset) => ({ ...preset, group: 'favorites' })),
    // The listener's own, after the stars and before the factory's: a
    // preset made here is one they came back to pick (own presets,
    // 2026-11-20), and a pick that left it out had no row to light while
    // it played.
    ...catalog.filter(
      (preset) => isOwnPreset(preset) && !favouriteIds.has(preset.id),
    ),
    ...QUICK_DSP_PRESETS.flatMap((id) => {
      const preset = catalog.find((one) => one.id === id);
      // Equalizer APO takes a chain's EQ curve and nothing else, so there a
      // Room copy is the chain it copies under a name that promises a room.
      const isOffered =
        preset !== undefined &&
        !favouriteIds.has(id) &&
        !(isApo && preset.settings.room.enabled);
      return isOffered ? [{ ...preset, group: 'classic' }] : [];
    }),
    ...catalog.filter(
      (preset) => preset.group === 'genre' && !favouriteIds.has(preset.id),
    ),
  ];
  const entries: IRichPickEntry[] = [
    {
      id: 'none',
      name: t('voicing.none'),
      group: '',
      hint: t('voicing.none.hint'),
      icon: <VoicingIcon className="rich-pick__glyph" />,
    },
    ...rows.map((row) => ({
      id: row.id,
      name: row.name,
      group: row.group,
      hint: isApo ? t('dsp.quick.apo') : dspPresetRowHint(row, t),
      icon: presetGlyph(
        catalog.find((preset) => preset.id === row.id) ?? row,
        'rich-pick__glyph',
      ),
    })),
  ];
  const groupLabel = (group: string): string => {
    if (group === '') {
      return '';
    }
    if (group === 'favorites') {
      return t('dsp.favorites.title');
    }
    if (group === 'saved') {
      return t('dsp.eqPreset.saved');
    }
    return t(group === 'genre' ? 'voicing.groupGenre' : 'dsp.quick.classics');
  };
  // Starred here as on the DSP page's picker, into the same list — both
  // pickers file it first and follow each other's stars — and in the same
  // menu style. Every chain the app knows is passed as known, so a star this
  // picker does not show (a saved chain starred there) stays.
  const favourites: IRichPickFavourites = {
    ids: favorites.map((preset) => preset.id),
    onToggle: (id) =>
      toggleFavouriteDspPreset(
        id,
        catalog.map((preset) => preset.id),
      ),
    addLabel: t('library.playlist.addToFavorites'),
    removeLabel: t('library.playlist.removeFromFavorites'),
    exclude: ['none'],
  };
  return {
    activeId,
    /** The playing preset, or undefined for none or a curve nobody named. */
    active,
    entries,
    groupLabel,
    favourites,
    apply,
    isDisabled: isBlockingError || !isEnabled || selecting,
  };
};

export default useVoicingPick;
