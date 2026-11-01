/* FluidEQ — GPL-3.0-or-later */

import { useEffect, useMemo, useState } from 'react';
import { IDspSettings, IEqSettings } from '../../common/dsp/chain';
import { DSP_PRESETS } from '../../common/dsp/presets';
import { dspPresetName } from '../../common/dsp/presetName';
import {
  NONE_CHAIN_ID,
  activeDspPresetId,
  resolveDspPreset as resolveSharedPreset,
  resolveDspPresetCurve as resolveSharedCurve,
} from '../../common/dsp/presetPick';
import { dspVoicingPresetId } from '../../common/dsp/presetVoicing';
import type { IVoicingSettings } from '../../common/constants';
import type { Translate } from '../../common/i18n';
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
 * A picker's whole list in the order it is read: the usual chains first, as
 * `QUICK_DSP_PRESETS` gives them, then everything else in the order it came.
 * The starred ones are this list with the unstarred taken out, never an order
 * of their own (Ivan, 2026-10-12: "same order we use on the other lists") —
 * so Gaming · Room sits after Gaming in Favourites as it does under them, and
 * a new star lands where its preset stands rather than at the foot.
 */
export const inListOrder = <T extends { id: string }>(
  list: readonly T[],
): T[] => [
  ...QUICK_DSP_PRESETS.flatMap((id) => list.filter((one) => one.id === id)),
  ...list.filter((one) => !QUICK_DSP_PRESETS.includes(one.id)),
];

export { NONE_CHAIN_ID, activeDspPresetId };

/** What the rack's Reset puts on: the chain the picker calls Default. */
export const DEFAULT_CHAIN_ID = 'balanced';

export { dspPresetName };

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
    settings.deEsser.enabled ? t('dsp.deEsser.title') : '',
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
): IDspSettings | undefined =>
  resolveSharedPreset(id, current, readUserDspPresets());

/** The tone a pick plays in the main EQ, or undefined for none. */
export const resolveDspPresetCurve = (id: string): IEqSettings | undefined =>
  resolveSharedCurve(id, readUserDspPresets());

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
    const favorites = inListOrder(catalog).filter(
      (preset) =>
        preset.id !== NONE_CHAIN_ID && saved.starred.includes(preset.id),
    );
    return { catalog, favorites };
  }, [t, saved]);
};
