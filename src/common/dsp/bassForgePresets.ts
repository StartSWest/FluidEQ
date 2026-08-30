/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { IBassForgeSettings } from './chain';

export const BASS_FORGE_PRESET_GROUPS = [
  'basic',
  'genre',
  'character',
  'scene',
] as const;

export type TBassForgePresetGroup = (typeof BASS_FORGE_PRESET_GROUPS)[number];

/**
 * A profile owns Forge's sound, not whether the stage runs.
 *
 * Bypass is absent for the same reason it is absent from the Exciter,
 * Maximizer and Dimension catalogues: a chain preset decides whether this
 * stage participates, and how it generates low end is a separate decision
 * from whether it generates any at all.
 */
export type IBassForgePresetSettings = Pick<
  IBassForgeSettings,
  'splitHz' | 'driveDb' | 'subAmount' | 'presenceAmount' | 'texture' | 'mix'
>;

export interface IBassForgePreset {
  id: string;
  labelKey: string;
  group: TBassForgePresetGroup;
  settings: IBassForgePresetSettings;
}

/**
 * The six numbers, in the order `IBassForgeSettings` declares them.
 *
 * Every profile here is a point on the same two trade-offs, which is what
 * lets this be a table rather than prose.
 *
 * `subAmount` against `presenceAmount` is the first: a real octave below, for
 * hardware that can radiate it, against the harmonics of that octave, for
 * hardware that cannot. Neither is "more of the other" — a subwoofer already
 * has a clean fundamental and needs little presence trick, and a laptop
 * speaker radiates nothing at the octave however far `subAmount` is pushed, so
 * every profile below leans toward whichever side its target hardware can
 * actually use.
 *
 * `texture` against `driveDb` is the second, and it is easy to mistake for one
 * dial: texture picks the RECIPE the presence harmonics are built from — 1 is
 * pure second order, the octave up and the clearest phantom-fundamental cue;
 * 0 is pure third order, a twelfth up and an edgier, brighter read. Drive does
 * not touch that recipe. It pushes whatever the recipe produced through an
 * asymmetric saturator that adds its own second-harmonic-forward warmth on
 * top, which is the only honest reading of "hot" a level-invariant generator
 * can offer — a gain in front of it has nothing to bite on. A profile can
 * therefore be driven hard while still choosing an odd-leaning texture, and
 * that combination — not a bigger version of a clean one — is what "hot"
 * means in this catalogue.
 *
 * `mix` is how much of what both generators made is allowed back into the
 * signal; `splitHz` is how much of the source's own low end feeds them.
 */
const profile = (
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

export const BASS_FORGE_PRESET_BY_ID = {
  subtle: {
    id: 'subtle',
    labelKey: 'dsp.bassForgePreset.subtle',
    group: 'basic',
    settings: profile(90, 0, 0.2, 0.25, 0.8, 0.2),
  },
  default: {
    id: 'default',
    labelKey: 'dsp.eqPreset.default',
    group: 'basic',
    settings: profile(90, 1.5, 0.45, 0.45, 0.8, 0.4),
  },
  deep: {
    id: 'deep',
    labelKey: 'dsp.bassForgePreset.deep',
    group: 'basic',
    // A wider splitHz hands the divider more of the bassline to work with, not
    // just its lowest notes, so the real octave below reaches further into
    // the part that was actually playing.
    settings: profile(100, 2, 0.75, 0.4, 0.85, 0.55),
  },

  solid: {
    id: 'solid',
    labelKey: 'dsp.bassForgePreset.solid',
    group: 'character',
    // Sub-led with little drive: a real octave below carries the weight, so
    // there is nothing here for the saturator to add warmth to.
    settings: profile(90, 0.5, 0.8, 0.3, 0.85, 0.45),
  },
  hot: {
    id: 'hot',
    labelKey: 'dsp.bassForgePreset.hot',
    group: 'character',
    // The opposite balance from `solid`, not a louder copy of it: presence
    // leads instead of sub, texture drops toward the odd end for edge, and
    // drive is what the saturator exists for. Every field moved.
    settings: profile(90, 9, 0.25, 0.75, 0.3, 0.5),
  },
  round: {
    id: 'round',
    labelKey: 'dsp.bassForgePreset.round',
    group: 'character',
    // Texture at 1: pure second order, nothing odd in the recipe at all.
    settings: profile(90, 1, 0.5, 0.55, 1, 0.5),
  },
  dry: {
    id: 'dry',
    labelKey: 'dsp.bassForgePreset.dry',
    group: 'character',
    settings: profile(90, 0, 0.3, 0.3, 0.8, 0.15),
  },
  wet: {
    id: 'wet',
    labelKey: 'dsp.bassForgePreset.wet',
    group: 'character',
    settings: profile(90, 1, 0.6, 0.6, 0.75, 0.75),
  },
  phantom: {
    id: 'phantom',
    labelKey: 'dsp.bassForgePreset.phantom',
    group: 'character',
    // No real octave at all: the illusion carries the whole note, at the
    // texture that reads most clearly as one.
    settings: profile(90, 0.5, 0, 0.8, 1, 0.5),
  },

  hiphop: {
    id: 'hiphop',
    labelKey: 'dsp.eqPreset.hiphop',
    group: 'genre',
    settings: profile(100, 3, 0.8, 0.5, 0.75, 0.6),
  },
  electronic: {
    id: 'electronic',
    labelKey: 'dsp.eqPreset.electronic',
    group: 'genre',
    // Synthesised low end has no acoustic transient to protect, the same
    // reasoning the Exciter and Maximizer catalogues use for this genre.
    settings: profile(100, 4, 0.7, 0.65, 0.6, 0.65),
  },
  rock: {
    id: 'rock',
    labelKey: 'dsp.eqPreset.rock',
    group: 'genre',
    settings: profile(90, 2.5, 0.5, 0.45, 0.7, 0.4),
  },
  dub: {
    id: 'dub',
    labelKey: 'dsp.bassForgePreset.dub',
    group: 'genre',
    // The narrowest splitHz and the highest subAmount in the catalogue: dub's
    // low end is a handful of very low notes, not a wide bassline, and the
    // genre wants the deepest of them made real rather than merely implied.
    settings: profile(80, 1, 0.9, 0.35, 0.95, 0.6),
  },
  pop: {
    id: 'pop',
    labelKey: 'dsp.eqPreset.pop',
    group: 'genre',
    settings: profile(90, 1, 0.4, 0.4, 0.8, 0.3),
  },

  laptop: {
    id: 'laptop',
    labelKey: 'dsp.eqPreset.laptop',
    group: 'scene',
    // subAmount 0: this speaker radiates nothing at the octave below at any
    // level, so headroom spent there buys nothing. Every bit of low end this
    // profile can make has to come from presence, so it is the one profile
    // that pushes it hardest.
    settings: profile(100, 1, 0, 0.85, 1, 0.7),
  },
  headphones: {
    id: 'headphones',
    labelKey: 'dsp.dimensionPreset.headphones',
    group: 'scene',
    // A driver this close to the ear already reproduces the real octave
    // cleanly, so presence is a minor top-up rather than the whole effect.
    settings: profile(80, 0.5, 0.55, 0.2, 0.85, 0.35),
  },
  car: {
    id: 'car',
    labelKey: 'dsp.eqPreset.car',
    group: 'scene',
    settings: profile(100, 2.5, 0.65, 0.55, 0.75, 0.55),
  },
  club: {
    id: 'club',
    labelKey: 'dsp.bassForgePreset.club',
    group: 'scene',
    // A PA subwoofer plays the real octave without help, so this leans on
    // subAmount rather than the illusion a smaller system would need.
    settings: profile(90, 3, 0.9, 0.3, 0.9, 0.6),
  },
} satisfies Record<string, IBassForgePreset>;

export type TBassForgePresetId = keyof typeof BASS_FORGE_PRESET_BY_ID;

export const BASS_FORGE_PRESETS: readonly IBassForgePreset[] = Object.values(
  BASS_FORGE_PRESET_BY_ID,
);

export const isBassForgePresetId = (id: string): id is TBassForgePresetId =>
  Object.prototype.hasOwnProperty.call(BASS_FORGE_PRESET_BY_ID, id);

/** Build a fresh live processor state; bypass is the caller's to decide. */
export const bassForgePresetSettings = (
  id: TBassForgePresetId,
  enabled: boolean,
): IBassForgeSettings => ({
  enabled,
  presetId: id,
  ...BASS_FORGE_PRESET_BY_ID[id].settings,
});
