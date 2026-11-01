/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import type { TAudioEngine } from '../audioEngine';
import type { IVoicingSettings } from '../constants';
import { IDspSettings, IEqSettings, clampDspSettings } from './chain';
import { chainRoom, dspPresetCurve, dspPresetSettings } from './presets';
import { dspPresetVoicing, dspVoicingPresetId } from './presetVoicing';
import type { IUserDspPreset } from './userPresets';

/**
 * What putting a preset on does to an output, as values in and values out:
 * the window's pickers and the app's core decide it the same way, because
 * both put presets on — the window when somebody picks one, the core when a
 * game comes forward or the engine is switched with nobody at the window.
 */

/**
 * The None chain: every stage off, the Normalizer included, and no curve
 * (`presetRecipes.ts`). It stands first in both pickers, above the starred
 * ones, and takes no star, being the absence of a choice (Ivan, 2026-09-22:
 * "none is on top of all even fav"). Not `none`, which is the pick that takes
 * a preset away — and which lands here, with the rack off.
 */
export const NONE_CHAIN_ID = 'empty';

/**
 * The longest preset id anything takes: its Preset layer is named `dsp:` and
 * the id, and the layer's name is refused past 120 characters (`SET_VOICING`).
 */
export const PRESET_ID_MAX = 116;

/** A preset id as anything from outside the core must be: some, and short. */
export const isPresetId = (value: unknown): value is string =>
  typeof value === 'string' &&
  value.length > 0 &&
  value.length <= PRESET_ID_MAX;

/** Both pickers resolve the same saved chain, preserving listener preferences. */
export const resolveDspPreset = (
  id: string,
  current: IDspSettings,
  saved: readonly IUserDspPreset[],
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
  const chain = saved.find((preset) => preset.id === id);
  return chain
    ? clampDspSettings({
        ...chain.settings,
        enabled: true,
        presetId: chain.id,
        gameMode: chain.settings.gameMode,
        crossfade: current.crossfade,
        surround: current.surround,
        eq: { ...chain.settings.eq, treble: current.eq.treble },
        // Its oversampling as it was saved: the listener chose it.
        room: chainRoom(current.room, chain.settings.room),
      })
    : dspPresetSettings(id, current);
};

/** The tone a pick plays in the main EQ, or undefined for none. */
export const resolveDspPresetCurve = (
  id: string,
  saved: readonly IUserDspPreset[],
): IEqSettings | undefined => {
  if (id === 'none') {
    return undefined;
  }
  const chain = saved.find((preset) => preset.id === id);
  return chain ? chain.curve : dspPresetCurve(id);
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

/** An output's sound after a preset is put on it. */
export interface IPresetPick {
  rack: IDspSettings;
  /** The Preset layer after the pick: the one passed in where it stays. */
  voicing: IVoicingSettings | undefined;
  /** The preset whose rack waits for the FluidEQ Engine, or none. */
  heldForApo: string | undefined;
}

/**
 * Put a preset on: its tone into the main EQ, its rack into the rack.
 *
 * The tone is the Preset layer, played by either engine after everything
 * else and drawn on the EQ page (`presetCurve.ts`), so a preset sounds the
 * same through both. A preset with no tone of its own, and None, take the
 * layer away rather than leaving the last preset's curve under a new rack;
 * so does any other voicing, the one tonal layer this replaces.
 *
 * `quick` is a pick made for the whole machine — the equaliser page's picker
 * and a game's sound. Under Equalizer APO, which has no rack, that leaves the
 * rack off and says which preset it held off, so a switch to the FluidEQ
 * Engine puts it on (`rackAtEngineSwitch`). The DSP page's own picker sets the
 * rack either way: under APO that page is the Library player's rack. Any pick
 * but that one lets go of what was held.
 *
 * Undefined for an id nothing resolves: a saved chain deleted since.
 */
export const pickDspPreset = ({
  id,
  rack,
  voicing,
  saved,
  engine,
  quick,
}: {
  id: string;
  /** The rack playing now, whose listener preferences the pick keeps. */
  rack: IDspSettings;
  voicing: IVoicingSettings | undefined;
  saved: readonly IUserDspPreset[];
  engine: TAudioEngine | null;
  quick: boolean;
}): IPresetPick | undefined => {
  const next = resolveDspPreset(id, rack, saved);
  if (!next) {
    return undefined;
  }
  const curve = resolveDspPresetCurve(id, saved);
  let layer = voicing;
  if (curve) {
    layer = dspPresetVoicing(id, curve);
  } else if (voicing?.profileId || voicing?.apoOverride) {
    layer = { profileId: '', intensity: 1 };
  }
  const held = quick && engine === 'apo' && id !== 'none';
  return {
    rack: held ? { ...next, enabled: false, gameMode: false } : next,
    voicing: layer,
    heldForApo: held ? next.presetId : undefined,
  };
};

/** The playing output's rack after a switch of engine. */
export interface IRackAtSwitch {
  rack: IDspSettings;
  heldForApo: string | undefined;
}

/**
 * A preset is one choice on both engines: its curve plays on either, its
 * rack only where a rack can run for the whole machine.
 *
 * The curve is the Preset layer of the main EQ and crosses an engine switch
 * by itself. The rack does not: Equalizer APO has none, so there a preset
 * picked for the whole machine leaves it off (`pickDspPreset`). Without this,
 * a switch to the FluidEQ Engine brought the curve back without the rest of
 * the preset, and a switch to Equalizer APO left a rack on that APO cannot
 * play — which then ran on the Library player alone.
 *
 * Only for the preset the Preset layer names: a rack switched off by hand
 * stays off, and one switched on by hand under Equalizer APO — for the
 * Library player — stays on. The hold is kept by whoever calls this, so it
 * outlives a restart between the two switches.
 */
export const rackAtEngineSwitch = ({
  engine,
  rack,
  voicing,
  held,
  saved,
}: {
  /** The engine switched to. */
  engine: TAudioEngine;
  rack: IDspSettings;
  voicing: IVoicingSettings | undefined;
  held: string | undefined;
  saved: readonly IUserDspPreset[];
}): IRackAtSwitch => {
  if (engine === 'apo') {
    const picked = rack.presetId;
    return rack.enabled &&
      picked !== '' &&
      dspVoicingPresetId(voicing) === picked
      ? {
          rack: { ...rack, enabled: false, gameMode: false },
          heldForApo: picked,
        }
      : { rack, heldForApo: held };
  }
  // The whole rack again, Game mode and all, rather than the switch alone:
  // the hold cleared what APO cannot use.
  const back =
    held !== undefined && held === rack.presetId && !rack.enabled
      ? resolveDspPreset(held, rack, saved)
      : undefined;
  return { rack: back ?? rack, heldForApo: undefined };
};
