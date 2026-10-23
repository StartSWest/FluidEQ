/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026> <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/
import type { IAudioDevice, IEqCuts, IState } from './constants';
import type { IDspSettings } from './dsp/chain';
import type { ITrebleDesigns } from './filterDesign';
import type { TCurveComparison } from './curveComparison';

/** Every audible preference belongs to the output's profile. */
export interface IOutputSound {
  dsp?: IDspSettings;
  eqCuts?: IEqCuts;
  trebleDesigns?: ITrebleDesigns;
  eqPhase?: TCurveComparison;
  curvePhase?: TCurveComparison;
}

/** A revision prevents a queued control edit from crossing an output switch. */
export interface IOutputEditor {
  device: IAudioDevice;
  generation: number;
}

export interface IEqualizerSnapshot extends IState {
  /** Saved rack beneath a temporary sound on the edited output. */
  ownedDsp?: IDspSettings;
  outputEditor?: IOutputEditor;
  playbackOutput?: IAudioDevice;
  playbackState?: IState;
}

export interface IOutputDspEdit {
  deviceId: string;
  generation: number;
  settings: IDspSettings;
  /** The listener's own settings, excluding a temporary song sound. */
  savedSettings?: IDspSettings;
  /** Imported once from the former app-wide rack into older saved profiles. */
  legacySettings?: IDspSettings;
}
