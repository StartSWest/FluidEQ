/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import {
  AutoEqFormat,
  IPresetV2,
  IState,
  IVoicingSettings,
  TSongSoundLoan,
} from '../common/constants';
import {
  dspPresetVoicing,
  dspVoicingPresetId,
} from '../common/dsp/presetVoicing';
import { clampDspSettings } from '../common/dsp/chain';
import { ISongSound } from '../common/songSound';

/**
 * A song's own sound, lent to it while it plays (`songSoundRecorder.ts`).
 *
 * The output's profile is the listener's sound, and every edit is saved into
 * it — so a song's sound put on like any other edit would have been saved
 * there too, and outlived its song: on the next song with no memory of its
 * own, after an output switch and back, after a restart. While a loan is
 * held the listener's own values for what a song covers stand in for the
 * song's wherever the state is written down (`ownState`); everything else —
 * a correction, the preamp, a layer switched off — is saved as it always is.
 * The live state stays the song's, and the config is rendered from it.
 *
 * Kept on the state rather than beside it because the state is what every
 * writer is already handed, and a loan the state file could be written
 * without is a song's sound waiting for a crash to keep it.
 */

/** The listener's own values, taken when a song's sound first goes on. */
const takeLoan = (state: IState): TSongSoundLoan => ({
  filters: state.filters,
  isFlat: state.isFlat,
  eqFormat: state.eqFormat,
  graphicEq: state.graphicEq,
  eqImport: state.eqImport,
  tone: state.tone,
  voicing: state.voicing,
});

/**
 * The state as the listener owns it: their values in place of a lent song's,
 * and no loan. Every key of the loan is set, `undefined` included, so a
 * song's Tone never survives over a listener who had none.
 */
export const ownState = (state: IState): IState => {
  const { songSoundLoan, ...rest } = state;
  return songSoundLoan ? { ...rest, ...songSoundLoan } : rest;
};

/** A profile as the listener owns it, for the save every edit makes. */
export const ownPreset = (preset: IPresetV2, state: IState): IPresetV2 =>
  state.songSoundLoan ? { ...preset, ...state.songSoundLoan } : preset;

/** The preset the machine is playing for the listener, lent song or not. */
export const ownVoicing = (state: IState): IVoicingSettings | undefined =>
  state.songSoundLoan ? state.songSoundLoan.voicing : state.voicing;

/**
 * The preset's curve a sound is put on with.
 *
 * A curve is the preset's tone (`presetCurve.ts`). `null` — None, or a preset
 * with no curve — takes a preset's curve away, but only a preset's: a voicing
 * that is not one is not the preset picker's to take. `undefined` leaves the
 * voicing as it is, for a preset the window could not name (a saved chain
 * deleted since, a rack with no name).
 */
const voicingFor = (
  current: IVoicingSettings | undefined,
  presetId: string,
  curve: unknown,
): IVoicingSettings | undefined => {
  if (curve === undefined) {
    return current;
  }
  if (curve !== null && typeof curve === 'object' && !Array.isArray(curve)) {
    return dspPresetVoicing(presetId, clampDspSettings({ eq: curve }).eq);
  }
  return dspVoicingPresetId(current) === undefined
    ? current
    : { profileId: '', intensity: 1 };
};

/**
 * Put back what a loan took, where one is held, and say whether one was.
 *
 * For a window that starts with no memory of lending anything — reloaded
 * while a remembered song played — so nothing will ever hand the song's sound
 * back. Left held, every edit from then on would play and never reach the
 * output's profile.
 */
export const returnSongSound = (state: IState): boolean => {
  const loan = state.songSoundLoan;
  if (!loan) {
    return false;
  }
  Object.assign(state, loan);
  state.songSoundLoan = undefined;
  return true;
};

/**
 * Put a song's sound on the live state.
 *
 * Lent, the listener's own values are kept aside the first time — a song
 * following a song keeps the loan the first one took, because what the
 * listener owns did not change in between. Handed back, a held loan puts
 * back exactly what it took (the bands' format, an import's name, a voicing
 * the picker never offered), and the loan ends.
 */
export const putSongSoundOn = (
  state: IState,
  sound: ISongSound,
  isLent: boolean,
  curve: unknown,
): void => {
  if (!isLent && returnSongSound(state)) {
    return;
  }
  if (isLent && !state.songSoundLoan) {
    state.songSoundLoan = takeLoan(state);
  }
  state.filters = sound.filters;
  state.isFlat = false;
  state.eqFormat = AutoEqFormat.PARAMETRIC;
  state.graphicEq = undefined;
  // The bands are no longer the imported curve once a song's are on them.
  state.eqImport = undefined;
  state.tone = sound.tone;
  state.voicing = voicingFor(state.voicing, sound.presetId, curve);
};

/** End a loan with what plays: it is the listener's own from here. */
export const keepSongSound = (state: IState): void => {
  state.songSoundLoan = undefined;
};
