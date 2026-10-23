/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * The De-esser's settings as the app keeps them: what each dial is, what it
 * may reach, and how a stored value is read back.
 *
 * Its own module rather than another block in `chain.ts`, which is already
 * past the size this project allows. The ranges are the engine's own
 * (`build_layout` in `deesser.cpp` clamps to the same), so a value the page
 * shows is a value the engine plays. Reading a stored one back is
 * `deEsserClamp.ts`, which needs the rack's clamp helpers; this module
 * imports nothing, so the rack's defaults can take it in.
 */
/** How the cut is made, in the wire's order (`FeqDeEsserMode`). Append-only. */
export const DE_ESSER_MODES = ['spectral', 'treble', 'whole'] as const;
export type TDeEsserMode = (typeof DE_ESSER_MODES)[number];

export interface IDeEsserSettings {
  enabled: boolean;
  /** Hear only what is taken away. Not a sound: never part of a profile. */
  isolate: boolean;
  /** Stable profile id, or empty after a hand edit. */
  presetId: string;
  /** 0 to 1: how far an S has to stand out of the song to be cut. */
  sensitivity: number;
  /** The listening range, Hz. */
  lowHz: number;
  highHz: number;
  /** The deepest cut, dB, as a positive number. */
  rangeDb: number;
  /** How far a cut spreads to its neighbours, octaves. */
  widthOct: number;
  mode: TDeEsserMode;
  attackMs: number;
  releaseMs: number;
  /** Listen and cut in the centre of the stereo picture only. */
  centreOnly: boolean;
  /** 0 to 1: how much a sound that is not a voice is spared. */
  keepCymbals: number;
}

/** The engine's ranges, `build_layout` in `deesser.cpp`. */
export const DE_ESSER_RANGES = {
  sensitivity: { min: 0, max: 1 },
  lowHz: { min: 2000, max: 12000 },
  highHz: { min: 2520, max: 16000 },
  rangeDb: { min: 0, max: 18 },
  widthOct: { min: 0.25, max: 2 },
  attackMs: { min: 0.1, max: 10 },
  releaseMs: { min: 10, max: 500 },
  keepCymbals: { min: 0, max: 1 },
} as const;

/**
 * The listening range is at least a third of an octave wide: two bands, the
 * fewest the engine lays out. `DE_ESSER_RANGES.highHz.min` is the lowest
 * `lowHz` times this.
 */
export const DE_ESSER_MIN_SPAN = 1.26;

/**
 * Off, and the Vocal music profile underneath, so switching it on does the
 * everyday thing. `deEsserPresets.ts` holds the same numbers as that profile
 * and `deEsserPresets.test.ts` keeps the two equal.
 */
export const DE_ESSER_DEFAULTS: IDeEsserSettings = {
  enabled: false,
  isolate: false,
  presetId: 'vocalMusic',
  sensitivity: 0.55,
  lowHz: 4500,
  highHz: 11000,
  rangeDb: 6,
  widthOct: 0.67,
  mode: 'spectral',
  attackMs: 1,
  releaseMs: 60,
  centreOnly: true,
  keepCymbals: 0.7,
};
