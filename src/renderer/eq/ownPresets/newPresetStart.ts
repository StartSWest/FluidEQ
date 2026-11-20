/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import type { IFiltersMap, IVoicingSettings } from '../../../common/constants';
import type { IDspSettings, IEqSettings } from '../../../common/dsp/chain';
import {
  dspVoicingCurve,
  dspVoicingPresetId,
} from '../../../common/dsp/presetVoicing';
import type { Translate } from '../../../common/i18n';
import {
  NONE_CHAIN_ID,
  activeDspPresetId,
  presetLayerNameOf,
  resolveDspPreset,
  resolveDspPresetCurve,
} from '../../dsp/dspPresetCatalog';
import { curveFromFilters, flatCurve } from './presetEditBands';

export type TCurveStart = 'playing' | 'yours' | 'flat';
export type TRackStart = 'playing' | 'now' | 'empty';

/**
 * What New preset can start from, read once as the dialog opens: the
 * preset playing now — its name, its curve as the Preset layer plays it, its
 * rack as a pick would put it on — Your EQ's bands, a flat curve, the DSP
 * page as it stands, an empty rack.
 */
export interface INewPresetStarts {
  /** The preset playing, by the name the pickers give it; none for none. */
  playingName: string | undefined;
  curves: Partial<Record<TCurveStart, IEqSettings>>;
  racks: Partial<Record<TRackStart, IDspSettings>>;
}

export const newPresetStarts = (
  settings: IDspSettings,
  voicing: IVoicingSettings | undefined,
  filters: IFiltersMap,
  t: Translate,
): INewPresetStarts => {
  const chosen = activeDspPresetId(settings, voicing);
  const playingId =
    chosen === undefined || chosen === '' || chosen === NONE_CHAIN_ID
      ? undefined
      : chosen;
  const layerId = dspVoicingPresetId(voicing);
  // Its own curve where the layer plays it whole, so the bands come back as
  // they were drawn; as heard otherwise (turned down on its chip, a game's).
  const layerCurve =
    layerId === undefined
      ? undefined
      : ((voicing?.intensity === 1
          ? resolveDspPresetCurve(layerId)
          : undefined) ?? dspVoicingCurve(voicing));
  const playingCurve =
    layerCurve ??
    (playingId === undefined ? undefined : resolveDspPresetCurve(playingId));
  const playingRack =
    playingId === undefined ? undefined : resolveDspPreset(playingId, settings);
  const nameId = playingId ?? layerId;
  const yours = curveFromFilters(filters);
  const empty = resolveDspPreset(NONE_CHAIN_ID, settings);
  return {
    playingName:
      nameId === undefined ? undefined : presetLayerNameOf(nameId, t),
    curves: {
      ...(playingCurve ? { playing: playingCurve } : {}),
      ...(yours.bands.length > 0 ? { yours } : {}),
      flat: flatCurve(),
    },
    racks: {
      ...(playingRack ? { playing: playingRack } : {}),
      now: settings,
      ...(empty ? { empty } : {}),
    },
  };
};
