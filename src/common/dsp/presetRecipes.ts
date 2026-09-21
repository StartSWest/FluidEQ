/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * The rack presets as they are written: which profile of each stage a chain
 * switches on. `presets.ts` builds the racks from these; the table is apart
 * from it because it is data that grows a chain at a time, and the rules
 * for applying a chain are not.
 */

import { TNormalizerMode } from './chain';
import { TBassForgePresetId } from './bassForgePresets';
import { TBassPunchPresetId } from './bassPunchPresets';
import { TCompressorPresetId } from './compressorPresets';
import { TDenoisePresetId } from './denoisePresets';
import { TDimensionPresetId } from './dimensionPresets';
import { TExciterPresetId } from './exciterPresets';
import { TMasterPresetId } from './masterPresets';
import { TMaximizerPresetId } from './maximizerPresets';
import { TRoomPresetId } from './roomPresets';

export const DSP_PRESET_GROUPS = ['basic', 'genre', 'scene', 'repair'] as const;
export type TDspPresetGroup = (typeof DSP_PRESET_GROUPS)[number];

export interface IDspPresetRecipe {
  id: string;
  labelKey: string;
  group: TDspPresetGroup;
  denoise?: TDenoisePresetId;
  eq?: string;
  /** A former Voicing curve, now processed inside this DSP preset only. */
  voicing?: string;
  exciter?: TExciterPresetId;
  bassForge?: TBassForgePresetId;
  bassPunch?: TBassPunchPresetId;
  compressor?: TCompressorPresetId;
  dimension?: TDimensionPresetId;
  maximizer?: TMaximizerPresetId;
  /** Keep a limiter profile's timing while calibrating full-rack drive. */
  maximizerDriveDb?: number;
  master?: TMasterPresetId;
  /** Compare the processed chain at its incoming level, without LUFS makeup. */
  masterGainMatch?: boolean;
  /** Final calibration for a complete chain that uses Master. */
  masterOutputTrimDb?: number;
  /** The Normalizer's mode, where a chain needs other than the default. */
  normalizer?: TNormalizerMode;
  /** Game mode: see `IDspSettings.gameMode`. Only the Gaming chains. */
  gameMode?: boolean;
  /**
   * The Room a chain switches on, by the room it stands in. Headphones only:
   * the Room folds every channel around a head, which is wrong on speakers —
   * so it is never added to a chain that exists without it, only offered as
   * that chain's copy beside it, named as the chain plus `copyLabelKey`.
   */
  room?: TRoomPresetId;
  /**
   * What a Room copy is called after the chain's own name, where the Room's
   * title does not say it: a chain with a second copy names that one by the
   * room it stands in ("Gaming · Competitive" beside "Gaming · Room").
   */
  copyLabelKey?: string;
}

/**
 * Complete chains. No recipe stacks Maximizer with Master, Denoise
 * appears only for a named source problem — cleanup on already-clean music
 * is damage rather than polish — and the Room is only ever in a copy of a
 * chain that also exists without it, because it is for headphones alone.
 */
export const DSP_PRESET_RECIPES: readonly IDspPresetRecipe[] = [
  {
    id: 'balanced',
    labelKey: 'dsp.eqPreset.default',
    group: 'basic',
    // Default must be a clean baseline. Enabling Exciter here added fuzz to
    // every source before the user had chosen any character at all; the
    // standalone Exciter preset remains available when that colour is wanted.
    eq: 'balanced',
    compressor: 'gentle',
    dimension: 'default',
    master: 'streaming',
  },
  {
    id: 'reference',
    labelKey: 'dsp.masterPreset.reference',
    group: 'basic',
    master: 'reference',
    masterGainMatch: true,
  },
  {
    id: 'music',
    labelKey: 'dsp.preset.music',
    group: 'basic',
    voicing: 'music',
    compressor: 'gentle',
    // The everyday chain, so both additions are the quiet kind: the picture
    // its curve implies, and a ceiling that only catches what the curve's
    // boosts push over. Nothing here invents harmonics — a chain called
    // Music has to be safe on a record of any kind.
    dimension: 'default',
    maximizer: 'safety',
  },
  {
    // Music on headphones, in the Room's Music Space: the record on a wider
    // stage in front, the voice held in the middle, a little air after it.
    // Without Dimension, as in every Room copy — it widens the pair AFTER the
    // Room has placed the speakers, and smears the places the Room just made.
    // And WITH the ceiling: a full-scale stereo record leaves this room up to
    // 3 dB over full scale (measured, `room_profiles_test.cpp`), and the
    // Maximizer stands after the Room, so `safety` — which adds no level of
    // its own — is what brings that back under.
    id: 'music-room',
    labelKey: 'dsp.preset.music',
    group: 'basic',
    voicing: 'music',
    compressor: 'gentle',
    maximizer: 'safety',
    room: 'musicSpaceV2',
  },
  {
    id: 'speech',
    labelKey: 'dsp.preset.speech',
    group: 'scene',
    voicing: 'speech',
    compressor: 'voice',
    // Speech is listened to in the places music is not — a train, a kitchen,
    // a car — where what costs a sentence is the level, not the tone. The
    // compressor evens out the voices; this puts whatever is playing at the
    // level everything else plays at, which a limiter cannot do.
    master: 'podcast',
  },
  {
    id: 'warm',
    labelKey: 'dsp.eqPreset.warm',
    group: 'basic',
    // Warmth is the broad low-mid tilt. Exciter and Bass Forge both added
    // harmonics on top of the EQ's own colour, which turned a tonal preset
    // into audible grit. Keep the chain clean and let its curve own the name.
    eq: 'warm',
    compressor: 'gentle',
    dimension: 'intimate',
    maximizer: 'transparent',
    maximizerDriveDb: 0,
  },
  {
    id: 'clarity',
    labelKey: 'dsp.eqPreset.air',
    group: 'basic',
    eq: 'air',
    // Timing, and no harmonics: this chain's curve already lifts the top, and
    // exciting it as well is how clarity turns into sibilance. What the
    // Exciter's Timing profile does instead is put the bottom of the record
    // back in step with the top — the half of a hardware "maximizer" that was
    // never about brightness — which costs no level and no air.
    exciter: 'timing',
    dimension: 'speakers',
    maximizer: 'default',
    maximizerDriveDb: 0.5,
  },
  {
    id: 'punch',
    labelKey: 'dsp.maximizerPreset.punch',
    group: 'basic',
    // One source of punch, not five stacked versions of it. The old chain
    // boosted both ends, synthesized a sub octave, exaggerated the bass
    // transient, let another slow compressor accent it, then drove a second
    // fast punch limiter. Each stage was reasonable alone and their sum was
    // exactly the overdone sound reported in listening. Bass Punch now owns
    // the character; the other stages support it without adding another hit.
    //
    // The EQ was flat until 2026-09-19, which left the chain with nothing to
    // make the hit READ: measured, it was +2.6 dB of deep bass and no more
    // punch than DSP Off. The curve it has now is the room around the kick —
    // the low mid it cuts through and the beater on top — and not another
    // lift under it.
    eq: 'punch',
    bassPunch: 'punch',
    compressor: 'gentle',
    maximizer: 'transparent',
    // Punch already raises the bass hit; avoid pushing it harder into limiting.
    maximizerDriveDb: 0,
  },
  {
    id: 'expansive',
    labelKey: 'dsp.dimensionPreset.expansive',
    group: 'basic',
    // Width plus space, without exciting and re-limiting the widened side
    // channel. Those extra stages made the diffuse top sound distorted even
    // while the final sample peaks remained numerically safe.
    eq: 'ambient',
    dimension: 'expansive',
  },
  {
    id: 'late-night',
    labelKey: 'dsp.eqPreset.lateNight',
    group: 'basic',
    eq: 'lateNight',
    /**
     * The bass comes back as harmonics, because the real octave is what the
     * wall lets through.
     *
     * A partition stops less the lower the note — roughly six decibels less
     * per octave down — so the sub-bass is precisely what the neighbours
     * hear, and this chain's curve cuts it. Re-timing the hit, which is what
     * Bass Punch did here, does nothing about a record with no bottom left;
     * Forge's harmonics of the missing fundamental are heard as that bottom
     * by the listener and stopped by the wall.
     */
    bassForge: 'lateNight',
    compressor: 'lateNight',
    maximizer: 'lateNight',
  },
  {
    id: 'pop',
    labelKey: 'dsp.eqPreset.pop',
    group: 'genre',
    eq: 'pop',
    // The two stages a pop master is made of that a curve cannot imitate: the
    // sparkle on top, and a kick that arrives. Both stay light, and they do
    // not meet — the Exciter's profile is top-band only, so Punch owns the
    // bottom by itself.
    exciter: 'pop',
    bassPunch: 'pop',
    compressor: 'glue',
    dimension: 'pop',
    maximizer: 'pop',
  },
  {
    id: 'rock',
    labelKey: 'dsp.eqPreset.rock',
    group: 'genre',
    eq: 'rock',
    // No Exciter, deliberately: the guitars are already generating harmonics
    // and more of them land in the fizz band. What a rock record wants is the
    // kick out from under them.
    bassPunch: 'rock',
    compressor: 'rock',
    dimension: 'rock',
    maximizer: 'rock',
  },
  {
    id: 'hiphop',
    labelKey: 'dsp.eqPreset.hiphop',
    group: 'genre',
    eq: 'hiphop',
    bassForge: 'hiphop',
    compressor: 'punch',
    // The 808 and the voice are the record, and both belong in the middle.
    dimension: 'hiphop',
    maximizer: 'hiphop',
  },
  {
    id: 'electronic',
    labelKey: 'dsp.eqPreset.electronic',
    group: 'genre',
    eq: 'electronic',
    exciter: 'electronic',
    compressor: 'electronic',
    // Wide up top and mono at the bottom, which is how the genre is mixed
    // and what the club system it is made for does to the bottom anyway.
    dimension: 'electronic',
    maximizer: 'electronic',
  },
  {
    id: 'jazz',
    labelKey: 'dsp.eqPreset.jazz',
    group: 'genre',
    eq: 'jazz',
    dimension: 'jazz',
    maximizer: 'jazz',
  },
  {
    id: 'classical',
    labelKey: 'dsp.eqPreset.classical',
    group: 'genre',
    eq: 'classical',
    // The low band stays at unity here where the other genres narrow it: a
    // hall's bass arrives from every direction, and narrowing it moves the
    // room rather than an instrument.
    dimension: 'classical',
    maximizer: 'classical',
  },
  {
    id: 'acoustic',
    labelKey: 'dsp.eqPreset.acoustic',
    group: 'genre',
    eq: 'acoustic',
    // Wood and string: body from the Organic generator and a little air, the
    // one place in this catalogue where an Exciter is asked for low-mids.
    exciter: 'acoustic',
    compressor: 'gentle',
    dimension: 'intimate',
    maximizer: 'acoustic',
  },
  {
    id: 'metal',
    labelKey: 'dsp.eqPreset.metal',
    group: 'genre',
    eq: 'metal',
    // The one profile with no bloom at all: at these tempos a generated tail
    // arrives on top of the next kick.
    bassPunch: 'metal',
    compressor: 'rock',
    dimension: 'rock',
    maximizer: 'metal',
  },
  {
    id: 'reggae',
    labelKey: 'dsp.eqPreset.reggae',
    group: 'genre',
    eq: 'reggae',
    bassForge: 'dub',
    compressor: 'glue',
    // A sound system's picture: the bass line mono, the top only modestly
    // wide, because the room supplies more spread than a record can.
    dimension: 'club',
    maximizer: 'reggae',
  },
  {
    id: 'drum-bass',
    labelKey: 'dsp.eqPreset.drumBass',
    group: 'genre',
    eq: 'drumBass',
    // D&B has its own short-bloom transient profile. The former Electronic
    // Bass Forge substitution ignored it and softened the breaks the preset
    // is named for.
    bassPunch: 'dnb',
    compressor: 'electronic',
    // Mono at the bottom: a break's sub carries no image worth keeping, and
    // any stereo information down there collapses on a club rig.
    dimension: 'electronic',
    maximizer: 'default',
    // Retain a little level compensation for this EQ/compressor combination;
    // zero drive made the complete preset 2.5 dB quieter in the music audit.
    maximizerDriveDb: 1.3,
  },
  {
    id: 'headphones',
    labelKey: 'dsp.dimensionPreset.headphones',
    group: 'scene',
    eq: 'openBack',
    bassForge: 'headphones',
    dimension: 'headphones',
    maximizer: 'default',
    maximizerDriveDb: 1,
  },
  {
    id: 'speakers',
    labelKey: 'dsp.dimensionPreset.speakers',
    group: 'scene',
    eq: 'speakers',
    dimension: 'speakers',
    maximizer: 'default',
    maximizerDriveDb: 1.4,
  },
  {
    id: 'laptop',
    labelKey: 'dsp.eqPreset.laptop',
    group: 'scene',
    eq: 'laptop',
    /**
     * The one chain where a bass generator is not a colour but the only way
     * to hear the bass at all.
     *
     * The curve above it high-passes hard, because that speaker radiates
     * nothing below its own resonance however much is sent to it — every
     * octave down costs four times the excursion for the same loudness, so
     * an EQ boost buys rattle. Forge's laptop profile makes no octave below
     * at all; it builds the harmonics of the note instead, and the ear
     * supplies the fundamental that the driver cannot.
     */
    bassForge: 'laptop',
    compressor: 'gentle',
    dimension: 'laptop',
    maximizer: 'default',
    maximizerDriveDb: 0.4,
  },
  {
    id: 'car',
    labelKey: 'dsp.eqPreset.car',
    group: 'scene',
    eq: 'car',
    bassForge: 'car',
    compressor: 'glue',
    dimension: 'monoSafe',
    maximizer: 'transparent',
    maximizerDriveDb: 1,
  },
  {
    // GAME MODE. Choosing this is the whole of it: the chain gives up every
    // delay it carries for comfort — the stages it leaves off cost nothing
    // while it is chosen, the room and the EQ's curves lose their
    // partitions — so what is heard lands as close as it can to what is
    // seen. Any other chain, an import or Reset gives the delay back.
    //
    // And it is tuned for hearing a game rather than for its impact, which
    // is what it was before: Bass Punch and Dimension made the explosions
    // bigger and the image wider, and a wider image is a vaguer direction.
    // Now the blasts are held down and the steps brought up (`gaming` in
    // the compressor's catalogue), with no limiter and its look-ahead in
    // the way — the output safety still catches every peak. For the same
    // reason the Normalizer's peak guard at the input is off: it was a
    // second limiter in front of that one, and 2 ms of the 6 the chain
    // still held.
    id: 'gaming',
    labelKey: 'dsp.eqPreset.gaming',
    group: 'scene',
    normalizer: 'off',
    eq: 'gaming',
    compressor: 'gaming',
    gameMode: true,
  },
  {
    // Gaming on headphones: the same chain in the Room's Game World, so a
    // 5.1 or 7.1 game is folded around the head and a direction is a place
    // rather than a channel. In game mode the Room runs on time, so the pair
    // costs no more delay than Gaming alone. Game World and not the classic
    // gaming room it stood in first (Ivan's call, 2026-09-19): its speakers
    // stand between the head's measured directions instead of on the nearest
    // one, which is the whole of what a direction is worth in a game.
    id: 'gaming-room',
    labelKey: 'dsp.eqPreset.gaming',
    group: 'scene',
    normalizer: 'off',
    eq: 'gaming',
    compressor: 'gaming',
    gameMode: true,
    room: 'gameWorldV2',
  },
  {
    // Gaming on headphones for a match rather than a world: the same chain in
    // the Room's Competitive, which has no walls and no tail — nothing
    // arrives after a step but the step. Two copies of one chain cannot both
    // be "Gaming · Room", so this one is named by its room.
    id: 'gaming-competitive',
    labelKey: 'dsp.eqPreset.gaming',
    copyLabelKey: 'dsp.room.profile.competitiveV2',
    group: 'scene',
    normalizer: 'off',
    eq: 'gaming',
    compressor: 'gaming',
    gameMode: true,
    room: 'competitiveV2',
  },
  {
    id: 'movie',
    labelKey: 'dsp.eqPreset.movie',
    group: 'scene',
    eq: 'movie',
    compressor: 'movie',
    dimension: 'movie',
    maximizer: 'movie',
  },
  {
    // Movie on headphones, in the Room's Cinema — the featured room, not the
    // classic home theatre it stood in first (Ivan's call, 2026-09-19).
    // Without Dimension: it widens the pair AFTER the Room has placed every
    // speaker around the head, and widening a binaural image smears the very
    // places the Room just made.
    id: 'movie-room',
    labelKey: 'dsp.eqPreset.movie',
    group: 'scene',
    eq: 'movie',
    compressor: 'movie',
    maximizer: 'movie',
    room: 'cinemaV2',
  },
  {
    id: 'lossy-repair',
    labelKey: 'dsp.preset.lossyRepair',
    group: 'repair',
    eq: 'air',
    exciter: 'lossy-repair',
    // The repair Exciter can reconstruct a peak above unity. This adds no
    // loudness; it is only the clean final ceiling the repair requires.
    maximizer: 'safety',
  },
  {
    id: 'vinyl-restore',
    labelKey: 'dsp.eqPreset.vinyl',
    group: 'repair',
    denoise: 'vinyl',
    eq: 'vinyl',
    compressor: 'gentle',
    dimension: 'monoSafe',
    master: 'vinyl',
    masterOutputTrimDb: -0.5,
  },
  {
    id: 'tape-restore',
    labelKey: 'dsp.eqPreset.tape',
    group: 'repair',
    denoise: 'tape',
    eq: 'tape',
    // The top a cassette lost, generated from the band under it rather than
    // boosted out of a band that no longer holds it. It works here because
    // of where it sits: after the restoration, so it builds on de-hissed
    // audio — in front of it, the same profile would be a hiss enhancer.
    exciter: 'tape',
    master: 'reference',
    // Tape EQ restores lost body and the cached loudness makeup otherwise
    // adds another four decibels. Calibrate the complete result, not the EQ.
    masterOutputTrimDb: -1.8,
  },
  {
    id: 'podcast',
    labelKey: 'dsp.eqPreset.podcast',
    group: 'repair',
    denoise: 'podcast',
    eq: 'podcast',
    compressor: 'voice',
    /**
     * A target rather than a limiter, because every show arrives at a
     * different level and none of them at yours.
     *
     * Spoken word is the one programme where the listener cannot ride the
     * volume: a quiet interview in a car is lost, and the next episode is
     * four decibels louder for no reason anyone chose. Measured across a
     * large corpus, podcasts average about -19 LUFS with a spread of ten;
     * -16 is what the platforms normalise to. The compressor above has
     * already evened out the voices within the show — this puts the show
     * itself where every other show is.
     */
    master: 'podcast',
  },
  {
    id: 'audiobook',
    labelKey: 'dsp.eqPreset.audiobook',
    group: 'repair',
    denoise: 'audiobook',
    eq: 'audiobook',
    compressor: 'voice',
    // The same, at the quieter target and the -3 dBTP ceiling a submitted
    // audiobook is held to: hours of listening, so the level that matters is
    // the one that does not tire.
    master: 'audiobook',
  },
];
