/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { normalizeBandDesign } from '../common/bandDesigns';
import type { IPresetV2, IState } from '../common/constants';
import { getCurveEqMode, getEqMode } from '../common/eqMode';
import { toTone } from '../common/tone';
import type { IMainSession } from './mainSession';

/**
 * A profile's whole sound made the live one, for the output being edited.
 *
 * Shared by the profile picker and a game's own sound (`ipc/gameSound.ts`),
 * which both put a profile file on as it is: one list of what a profile
 * carries, so a layer added to profiles cannot be loaded by one path and left
 * behind by the other. A new editor generation goes with it, so the window's
 * rack adopts the profile's rack instead of publishing its own over it.
 */
const putPresetInState = (
  state: IState,
  session: Pick<
    IMainSession,
    | 'activeAudioDeviceId'
    | 'outputDspOverrides'
    | 'outputStateOverrides'
    | 'outputEditGeneration'
  >,
  preset: IPresetV2,
): void => {
  state.dsp = preset.dsp;
  session.outputDspOverrides?.delete(session.activeAudioDeviceId);
  session.outputStateOverrides?.delete(session.activeAudioDeviceId);
  state.eqCuts = preset.eqCuts;
  state.trebleDesigns = preset.trebleDesigns;
  state.eqPhase = preset.eqPhase;
  state.curvePhase = preset.curvePhase;
  state.isAutoPreAmpOn = preset.isAutoPreAmpOn ?? true;
  session.outputEditGeneration = (session.outputEditGeneration ?? 0) + 1;
  state.preAmp = preset.preAmp;
  state.filters = preset.filters;
  state.eqFormat = preset.eqFormat;
  state.graphicEq = preset.graphicEq;
  state.convolution = preset.convolution;
  state.isFlat = preset.isFlat;
  state.eqMode = getEqMode(preset);
  state.curveEqMode = getCurveEqMode(preset);
  state.mainBandQ = preset.mainBandQ;
  state.eqBandQ = preset.eqBandQ;
  state.curveBandQ = preset.curveBandQ;
  state.curveSmoothing = preset.curveSmoothing;
  state.eqBandDesign = normalizeBandDesign(preset.eqBandDesign);
  state.isEqDoubleOn = state.eqMode === 'double';
  state.tone = toTone(preset.tone);
  state.voicing = preset.voicing;
  state.driver = preset.driver;
  state.smartEq = preset.smartEq;
  state.headphone = preset.headphone;
  state.headset = preset.headset;
  state.headsetTarget = preset.headsetTarget;
  state.headsetSource = preset.headsetSource;
  state.eqImport = preset.eqImport;
  // Which layers this profile has switched off comes with it, like the layers
  // themselves. Keeping the previous profile's list would silence a layer this
  // one never switched off.
  state.bypassed = preset.bypassed;
  // A profile loaded is the listener's own sound; a song's lent one ends
  // here (the window hands it back first, `songSoundSession.ts`).
  state.songSoundLoan = undefined;
};

export default putPresetInState;
