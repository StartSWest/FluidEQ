/* FluidEQ — GPL-3.0-or-later */

import { useEffect, useMemo, useState } from 'react';
import {
  IDspSettings,
  IEqSettings,
  clampDspSettings,
} from '../../common/dsp/chain';
import {
  DSP_PRESETS,
  IDspPreset,
  chainRoom,
  dspPresetCurve,
  dspPresetSettings,
} from '../../common/dsp/presets';
import { dspVoicingPresetId } from '../../common/dsp/presetVoicing';
import type { IVoicingSettings } from '../../common/constants';
import type { Translate } from '../../common/i18n';
import type { TranslationKey } from '../../common/i18n/en';
import {
  DSP_PRESETS_CHANGED,
  readFavouriteDspPresets,
} from './favouriteDspPresets';
import { genreHookKey } from './genreNotesModel';
import {
  IUserDspPreset,
  findUserDspPreset,
  readUserDspPresets,
} from './userDspPresets';

/**
 * The chains most people come for, in the order both pickers lead with them:
 * the quick pick on the equaliser's page and the rack's own picker, under the
 * same heading. One list, because two lists of "the usual ones" drift — the
 * quick pick had five, the rack's picker had them scattered over Basic and
 * Situation, and the two Room copies were in the one and not the other. Each
 * Room copy stands straight after the chain it copies.
 */
export const QUICK_DSP_PRESETS: readonly string[] = [
  'music',
  'music-room',
  'movie',
  'movie-room',
  'gaming',
  'gaming-room',
  'gaming-competitive',
  'speech',
  'late-night',
];

/**
 * The None chain: every stage off, the Normalizer included, and no curve
 * (`presetRecipes.ts`). It stands first in both pickers, above the starred
 * ones, and takes no star, being the absence of a choice (Ivan, 2026-09-22:
 * "none is on top of all even fav"). Not `none`, which is the pick that takes
 * a preset away — and which lands here, with the rack off.
 */
export const NONE_CHAIN_ID = 'empty';

/** What the rack's Reset puts on: the chain the picker calls Default. */
export const DEFAULT_CHAIN_ID = 'balanced';

/**
 * A factory chain's name. A Room copy is named as the chain it copies plus
 * what tells it apart — "Gaming · Room", "Gaming · Competitive" — so the
 * copies read as that chain's in every language without a second set of names
 * to translate.
 */
export const dspPresetName = (preset: IDspPreset, t: Translate): string =>
  preset.copyLabelKey === undefined
    ? t(preset.labelKey as TranslationKey)
    : `${t(preset.labelKey as TranslationKey)} · ${t(preset.copyLabelKey as TranslationKey)}`;

export interface IDspCatalogEntry {
  id: string;
  name: string;
  settings: IDspSettings;
  /** The tone it plays in the main EQ, if any: see `presetCurve.ts`. */
  curve?: IEqSettings;
  group: string;
}

const catalogOf = (
  t: Translate,
  saved: readonly IUserDspPreset[],
): IDspCatalogEntry[] => [
  ...saved.map((preset) => ({ ...preset, group: 'saved' })),
  ...DSP_PRESETS.map((preset) => ({
    ...preset,
    name: dspPresetName(preset, t),
  })),
];

export const dspPresetCatalog = (t: Translate): IDspCatalogEntry[] =>
  catalogOf(t, readUserDspPresets());

/**
 * What a chain does, in the names of its stages. Its tone counts as EQ
 * wherever it plays: a preset whose curve moved to the main EQ still shapes
 * the sound with one, and the list saying otherwise would be wrong about it.
 */
export const dspPresetHint = (
  { settings, curve }: Pick<IDspCatalogEntry, 'settings' | 'curve'>,
  t: Translate,
): string =>
  [
    settings.normalizer.mode !== 'off' ? t('dsp.normalizer.title') : '',
    settings.denoise.enabled ? t('dsp.denoise.title') : '',
    settings.exciter.enabled ? t('dsp.exciter.title') : '',
    settings.bassForge.enabled ? t('dsp.bassForge.title') : '',
    settings.eq.enabled || curve ? t('dsp.eq.title') : '',
    settings.bassPunch.enabled ? t('dsp.bassPunch.title') : '',
    settings.room.enabled ? t('dsp.room.title') : '',
    settings.dimension.enabled ? t('dsp.dimension.title') : '',
    settings.maximizer.enabled ? t('dsp.maximizer.title') : '',
    settings.master.enabled ? t('dsp.master.title') : '',
  ]
    .filter(Boolean)
    .join(' · ');

/**
 * The line under a chain in a preset list. A genre's says what the genre is,
 * from its notes; any other chain's, what it runs. Eighty-two genres share a
 * handful of stage lists, so their rows said the same few things over and
 * over, and the notes beside the list say the rest.
 */
export const dspPresetRowHint = (
  entry: Pick<IDspCatalogEntry, 'id' | 'settings' | 'curve'>,
  t: Translate,
): string => {
  const hook = genreHookKey(entry.id);
  return hook ? t(hook) : dspPresetHint(entry, t);
};

/** Both pickers resolve the same saved chain, preserving listener preferences. */
export const resolveDspPreset = (
  id: string,
  current: IDspSettings,
): IDspSettings | undefined => {
  if (id === 'none') {
    // Taking a preset away puts None on the rack, and the rack off. The DSP
    // page's picker then says None rather than naming the chain that was
    // taken away, and switching the rack back on plays nothing rather than
    // bringing that chain back unasked (Ivan, 2026-09-22: "when I select
    // none in main eq it set none in DSP too"). Off, not on: an empty rack
    // still holds the sound back by its limiters' look-ahead.
    const none = dspPresetSettings(NONE_CHAIN_ID, current);
    return none && { ...none, enabled: false, gameMode: false };
  }
  const saved = findUserDspPreset(id);
  return saved
    ? clampDspSettings({
        ...saved.settings,
        enabled: true,
        presetId: saved.id,
        gameMode: saved.settings.gameMode,
        crossfade: current.crossfade,
        surround: current.surround,
        eq: { ...saved.settings.eq, treble: current.eq.treble },
        room: chainRoom(current.room, saved.settings.room),
      })
    : dspPresetSettings(id, current);
};

/**
 * The preset on now, or undefined for none.
 *
 * The rack names it while it runs. While it is off — which under Equalizer
 * APO is always, APO having no rack — the Preset layer does: its curve is
 * that preset's sound on either engine. Asked by the equaliser's picker and
 * by a game's sound, which puts back what it finds here when the game ends;
 * reading the rack alone, it put back nothing under APO and took the curve
 * away with it.
 */
export const activeDspPresetId = (
  settings: IDspSettings,
  voicing: IVoicingSettings | undefined,
): string | undefined =>
  settings.enabled ? settings.presetId : dspVoicingPresetId(voicing);

/** The tone a pick plays in the main EQ, or undefined for none. */
export const resolveDspPresetCurve = (id: string): IEqSettings | undefined => {
  if (id === 'none') {
    return undefined;
  }
  const saved = findUserDspPreset(id);
  return saved ? saved.curve : dspPresetCurve(id);
};

/**
 * The preset a Preset layer came from, by the name its picker gives it, or
 * undefined for any other voicing.
 *
 * A saved chain deleted since goes on playing its curve from the layer until
 * the layer is removed, and is called Custom meanwhile, as the picker calls a
 * chain it cannot name.
 */
export const presetLayerName = (
  voicing: IVoicingSettings | undefined,
  t: Translate,
): string | undefined => {
  const id = dspVoicingPresetId(voicing);
  if (id === undefined) {
    return undefined;
  }
  const saved = findUserDspPreset(id);
  const factory = DSP_PRESETS.find((preset) => preset.id === id);
  if (saved) {
    return saved.name;
  }
  return factory ? dspPresetName(factory, t) : t('dsp.eqPreset.custom');
};

/** What the listener has saved and starred, as storage holds it now. */
const readSaved = () => ({
  chains: readUserDspPresets(),
  starred: readFavouriteDspPresets(),
});

/**
 * The catalogue and the starred chains, read from storage when what is saved
 * changes rather than on every render.
 *
 * Every render used to read every saved chain out of storage, parse and
 * clamp it, and build the catalogue again — and the pickers that hold this
 * render with the rack, the layers and the engine, the band drag's frames
 * among them. Both writers announce a change (`DSP_PRESETS_CHANGED`), and
 * another window's is a `storage` event, so a read that waits for one of
 * those misses nothing.
 */
export const useDspPresetCatalog = (t: Translate) => {
  const [saved, setSaved] = useState(readSaved);
  useEffect(() => {
    const changed = () => setSaved(readSaved());
    window.addEventListener(DSP_PRESETS_CHANGED, changed);
    window.addEventListener('storage', changed);
    return () => {
      window.removeEventListener(DSP_PRESETS_CHANGED, changed);
      window.removeEventListener('storage', changed);
    };
  }, []);
  return useMemo(() => {
    const catalog = catalogOf(t, saved.chains);
    // None stands above the starred ones already; a star it was given before
    // it did is not a second place for it.
    const favorites = saved.starred.flatMap((id) => {
      const preset = catalog.find((one) => one.id === id);
      return preset && id !== NONE_CHAIN_ID ? [preset] : [];
    });
    return { catalog, favorites };
  }, [t, saved]);
};
