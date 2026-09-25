/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * A genre's rack: what every stage of that genre's chain is set to, under
 * the genre's own name.
 *
 * Every genre chain used to borrow its stages from a handful of shared
 * profiles — Salsa, Funk, Afrobeat and Bhangra all played the Exciter's
 * "Latin", fourteen styles the Maximizer's "Pop" — so the cards of a chain
 * named Salsa read Latin, Pop, Pop, and a Funk record was treated as a
 * Latin one (Ivan, 2026-09-23: "some root presets are reusing filter presets
 * that are not the same genre"). A row here is one genre's whole rack, and
 * each stage it sets is offered in that stage's own list under the genre's
 * name, so every card of the Salsa chain reads Salsa.
 *
 * The rows were written from what the genre's own records are (researched
 * 2026-09-23 across mastering engineers' guides, loudness surveys and the
 * dynamic range database): its tempo, what carries its bottom, how it is
 * panned, how bright and how loud its masters arrive. Two findings run
 * through nearly all of them and shape every family file:
 *
 * - **The records are finished.** A modern master arrives limited, often
 *   over full scale already, and the advice for playing one back is the same
 *   everywhere: no exciter on a top that is already bright or distorted, no
 *   widening of what the mix placed, no invented sub under a bass that has
 *   one, and no further limiting to speak of. So most genres here run no
 *   Exciter, Bass Punch only tightens (a shorter tail, never a louder hit —
 *   a hit made louder is a peak the Maximizer then has to take back), and
 *   Dimension mostly folds the bottom to mono and leaves the picture alone.
 * - **The low end goes to mono**, in every genre built on a kick or a bass
 *   line: it is where cancellation costs the most and where no mix keeps
 *   anything worth placing. The rooms — jazz, classical, the acoustic
 *   styles — keep theirs, because a hall's bass arrives from everywhere.
 *
 * The numbers are the stage's own dials, in the order its card shows them;
 * `genres/*.ts` holds the rows, one family to a file.
 */

import type { IBassForgePresetSettings } from './bassForgePresets';
import type { IBassPunchPresetSettings } from './bassPunchPresets';
import type { IDimensionPresetSettings } from './dimensionPresets';
import type { IExciterPresetSettings } from './exciterProfile';
import type { IMaximizerPresetSettings } from './maximizerPresets';

/** The stages a genre sets. Its EQ is its curve, played as a layer. */
export const GENRE_STAGES = [
  'exciter',
  'bassForge',
  'bassPunch',
  'dimension',
  'maximizer',
] as const;

export type TGenreStage = (typeof GENRE_STAGES)[number];

export interface IGenreStageSettings {
  exciter: IExciterPresetSettings;
  bassForge: IBassForgePresetSettings;
  bassPunch: IBassPunchPresetSettings;
  dimension: IDimensionPresetSettings;
  maximizer: IMaximizerPresetSettings;
}

export interface IGenreRack extends Partial<
  Omit<IGenreStageSettings, 'maximizer'>
> {
  /**
   * The genre, as the EQ names its curve: the id of the chain, of the curve
   * it plays and of every profile this row gives a stage.
   */
  id: string;
  /** The chain's id, where an older one than the genre's is already stored. */
  chainId?: string;
  /**
   * Every genre chain ends in its own ceiling: its curve plays after the
   * rack, and a chain with nothing at its end can be pushed past full scale
   * by that curve with nothing left to catch it.
   */
  maximizer: IMaximizerPresetSettings;
  /**
   * Stages whose profile this genre offers in that stage's own list and
   * leaves off in its chain: a sound worth having under the genre's name
   * that its own records are better without, as Rock's Exciter is — the
   * guitars make harmonics of their own, and more of them land in the fizz.
   */
  offered?: readonly TGenreStage[];
}

/** Whether a genre's chain switches this stage on. */
export const inGenreChain = (rack: IGenreRack, stage: TGenreStage): boolean =>
  rack[stage] !== undefined && !(rack.offered ?? []).includes(stage);

/**
 * Dimension's six dials: the width below `lowHz`, between the two corners
 * and above `highHz`, then Spread — how much of the side is decorrelated,
 * and how much side is made out of the centre above `lowHz`, which is what
 * widens a voice panned dead centre (0.05 makes a side 28 dB under it,
 * 0.5 about 8 dB, as wide as an ordinary stereo mix).
 */
export const width = (
  lowWidth: number,
  midWidth: number,
  highWidth: number,
  lowHz: number,
  highHz: number,
  decorrelation: number,
): IDimensionPresetSettings => ({
  lowWidth,
  midWidth,
  highWidth,
  lowHz,
  highHz,
  decorrelation,
});

/**
 * Bass Punch's six dials; a profile always plays the whole of it.
 *
 * `bloomDecayMs` is the one a genre's tempo decides: a generated tail still
 * sounding when the next kick lands is the smear this stage exists to
 * prevent, so a row with any bloom keeps it well inside the gap between two
 * hits.
 */
export const punch = (
  splitHz: number,
  attack: number,
  sustain: number,
  bloomAmount: number,
  bloomDecayMs: number,
  duck: number,
): IBassPunchPresetSettings => ({
  splitHz,
  attack,
  sustain,
  bloomAmount,
  bloomDecayMs,
  duck,
  mix: 1,
});

/** Bass Forge's six dials, in the order its card shows them. */
export const forge = (
  splitHz: number,
  driveDb: number,
  subAmount: number,
  presenceAmount: number,
  texture: number,
  mix: number,
): IBassForgePresetSettings => ({
  splitHz,
  driveDb,
  subAmount,
  presenceAmount,
  texture,
  mix,
});

/** The Maximizer's four dials: drive into the ceiling, and its timing. */
export const ceiling = (
  driveDb: number,
  ceilingDb: number,
  lookAheadMs: number,
  releaseMs: number,
): IMaximizerPresetSettings => ({
  driveDb,
  ceilingDb,
  lookAheadMs,
  releaseMs,
});

/**
 * A release of one sixteenth note at a genre's tempo, for a record whose
 * hits come close together.
 *
 * The gain is back before the next sixteenth arrives, so a hit is caught and
 * let go inside its own note rather than holding the one after it down —
 * holding is what is heard as the limiter breathing with the beat. Measured
 * on loud masters, a faster release bought more level at the same movement
 * of the music above the bass than a slower one, all the way down to the
 * 60 ms floor, under which a release starts to ride the bass's own cycles.
 */
export const sixteenthMs = (bpm: number): number =>
  Math.round(Math.min(160, Math.max(60, 15_000 / bpm)));

/**
 * A release of one beat, for music that breathes: the limiter touches only
 * the rare peak, and letting go over a whole beat keeps it from modulating
 * the notes that follow. Bounded to what the stage offers a genre.
 */
export const beatMs = (bpm: number): number =>
  Math.round(Math.min(700, Math.max(250, 60_000 / bpm)));
