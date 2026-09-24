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
  dimension?: TDimensionPresetId;
  maximizer?: TMaximizerPresetId;
  master?: TMasterPresetId;
  /** Compare the processed chain at its incoming level, without LUFS makeup. */
  masterGainMatch?: boolean;
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
 * Complete chains, the genres apart: each genre is a row of its own in the
 * genre racks (`genres/*.ts`), which set every stage under the genre's name.
 * No recipe stacks Maximizer with Master, Denoise appears only for a named
 * source problem — cleanup on already-clean music is damage rather than
 * polish — and the Room is only ever in a copy of a chain that also exists
 * without it, because it is for headphones alone.
 */
export const DSP_PRESET_RECIPES: readonly IDspPresetRecipe[] = [
  {
    // Nothing at all: every stage off, the Normalizer included, and no
    // curve. The rack switched on with this chosen is the record as it
    // came, delayed by the stages' standby buffers and nothing else — the
    // chain to pick when the question is whether the rack is doing
    // something. First in the list at Ivan's call (2026-09-22). Not `none`,
    // which both pickers already read as "take the preset away" and answer
    // by switching the rack off (`resolveDspPreset`).
    id: 'empty',
    labelKey: 'dsp.preset.none',
    group: 'basic',
    normalizer: 'off',
  },
  {
    id: 'balanced',
    labelKey: 'dsp.eqPreset.default',
    group: 'basic',
    // Default must be a clean baseline. Enabling Exciter here added fuzz to
    // every source before the user had chosen any character at all; the
    // standalone Exciter preset remains available when that colour is wanted.
    eq: 'balanced',
    dimension: 'default',
    // A ceiling and a decibel, like every music chain, and no loudness
    // target: a target is a level somebody chose (Reference, Podcast,
    // Audiobook, Speech say so by name), and Default's streaming one turned
    // every loud record down to it — the one preset quieter than none.
    maximizer: 'default',
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
    maximizer: 'safety',
    room: 'musicSpaceV2',
  },
  {
    id: 'speech',
    labelKey: 'dsp.preset.speech',
    group: 'scene',
    voicing: 'speech',
    // Speech is listened to in the places music is not — a train, a kitchen,
    // a car — where what costs a sentence is the level, not the tone. This
    // puts whatever is playing at the level everything else plays at, which
    // a limiter cannot do.
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
    dimension: 'intimate',
    // Its own profile, the transparent timing with the drive that sets the
    // chain half a decibel over DSP Off once its curve is limited through
    // (`maximizerPresets.ts`).
    maximizer: 'warm',
  },
  {
    id: 'clarity',
    labelKey: 'dsp.eqPreset.air',
    group: 'basic',
    eq: 'air',
    // No Exciter. Harmonics were never here — the curve already lifts the
    // top, and exciting it as well is how clarity turns into sibilance — and
    // the Timing that stood here instead cost level after all: turning the
    // bottom's phase against the top re-creates the peaks a mastering limiter
    // took off, and the Maximizer took them back from everything. On five
    // loud masters the chain pumped nearly twice as much with it and played
    // 0.8 dB quieter (2026-09-22).
    // Its own width, the top opened where the curve lifts: the Speakers
    // profile it borrowed widens the middle for two boxes across a room.
    dimension: 'air',
    maximizer: 'clarity',
  },
  {
    id: 'punch',
    labelKey: 'dsp.maximizerPreset.punch',
    group: 'basic',
    // One source of punch, not five stacked versions of it. The old chain
    // boosted both ends, synthesized a sub octave, exaggerated the bass
    // transient, let a slow compressor accent it, then drove a second fast
    // punch limiter. Each stage was reasonable alone and their sum was
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
    // The Punch profile's own timing lets each hit's front through and lets
    // go before the next, where the transparent timing held the whole bar
    // down after every kick: louder with less reduction on average.
    maximizer: 'punch',
  },
  {
    id: 'expansive',
    labelKey: 'dsp.dimensionPreset.expansive',
    group: 'basic',
    // Width plus space, without exciting and re-limiting the widened side
    // channel. Those extra stages made the diffuse top sound distorted even
    // while the final sample peaks remained numerically safe. No curve: it
    // borrowed Ambient's, which made it Ambient made wider, and a chain whose
    // whole point is space should not also change the tone.
    dimension: 'expansive',
    // A ceiling and nothing more, for the peaks the widening itself makes:
    // without one the widened side put the chain 3.7 dB over full scale and
    // Auto normalize held everything down under it, 0.6 LU under DSP Off.
    // With it, 0.4 LU over and the limiter touching half a decibel on
    // average (2026-09-23); the harshness the old chain had came from
    // exciting the side and driving a limiter with it, and neither is here.
    maximizer: 'safety',
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
    maximizer: 'lateNight',
  },
  {
    id: 'headphones',
    labelKey: 'dsp.dimensionPreset.headphones',
    group: 'scene',
    eq: 'openBack',
    bassForge: 'headphones',
    dimension: 'headphones',
    maximizer: 'headphones',
  },
  {
    id: 'speakers',
    labelKey: 'dsp.dimensionPreset.speakers',
    group: 'scene',
    eq: 'speakers',
    dimension: 'speakers',
    maximizer: 'speakers',
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
    dimension: 'laptop',
    maximizer: 'laptop',
  },
  {
    id: 'car',
    labelKey: 'dsp.eqPreset.car',
    group: 'scene',
    eq: 'car',
    bassForge: 'car',
    dimension: 'monoSafe',
    maximizer: 'car',
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
    // Now the curve puts the cues forward, and a ceiling a millisecond long
    // holds what the curve would put over it (`maximizerPresets.ts`'s
    // `gaming`): with no ceiling at all, the loud moments went 7 dB over
    // full scale and Auto normalize turned the game down for tens of seconds
    // after each, the footsteps after an explosion with it. The Normalizer's
    // peak guard at the input stays off: a limiter in front of the game, and
    // 2 ms of delay.
    id: 'gaming',
    labelKey: 'dsp.eqPreset.gaming',
    group: 'scene',
    normalizer: 'off',
    eq: 'gaming',
    gameMode: true,
    maximizer: 'gaming',
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
    gameMode: true,
    room: 'gameWorldV2',
    // WITH the ceiling, as Music's Room copy has it: a full-scale stereo
    // record leaves a room up to 3 dB over full scale, and since the rack's
    // final guard went (2026-09-22) nothing after the Room catches that but
    // a stage of the chain's own. Gaming's own, a millisecond long.
    maximizer: 'gaming',
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
    gameMode: true,
    room: 'competitiveV2',
    // The same ceiling, for the same reason as Gaming's other Room copy.
    maximizer: 'gaming',
  },
  {
    id: 'movie',
    labelKey: 'dsp.eqPreset.movie',
    group: 'scene',
    eq: 'movie',
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
    maximizer: 'movie',
    room: 'cinemaV2',
  },
  {
    id: 'lossy-repair',
    labelKey: 'dsp.preset.lossyRepair',
    group: 'repair',
    // Its own repair curve, not the Character group's Air, which lifts the
    // octave where an encoder leaves its swirl (`lossyRestore`).
    eq: 'lossyRestore',
    exciter: 'lossy-repair',
    // The repair Exciter can reconstruct a peak above unity; its own
    // ceiling holds it, with the gentle drive every repair has.
    maximizer: 'lossy',
  },
  {
    // Every stage its own repair profile: the EQ's repair curve rather than
    // the Character group's Vinyl, and the Maximizer's Vinyl rather than the
    // Master's, which is a cutting lathe's target and held the rip 2.6 LU
    // under DSP Off.
    id: 'vinyl-restore',
    labelKey: 'dsp.eqPreset.vinyl',
    group: 'repair',
    denoise: 'vinyl',
    eq: 'vinylRestore',
    dimension: 'monoSafe',
    maximizer: 'vinyl',
  },
  {
    id: 'tape-restore',
    labelKey: 'dsp.eqPreset.tape',
    group: 'repair',
    denoise: 'tape',
    eq: 'tapeRestore',
    // The top a cassette lost, generated from the band under it rather than
    // boosted out of a band that no longer holds it. It works here because
    // of where it sits: after the restoration, so it builds on de-hissed
    // audio — in front of it, the same profile would be a hiss enhancer.
    exciter: 'tape',
    // Its own ceiling, where the Master's Reference stood: a -18 LUFS
    // comparison target that played every transfer louder than that quieter
    // than it came.
    maximizer: 'tape',
  },
  {
    id: 'podcast',
    labelKey: 'dsp.eqPreset.podcast',
    group: 'repair',
    denoise: 'podcast',
    eq: 'podcast',
    /**
     * A target rather than a limiter, because every show arrives at a
     * different level and none of them at yours.
     *
     * Spoken word is the one programme where the listener cannot ride the
     * volume: a quiet interview in a car is lost, and the next episode is
     * four decibels louder for no reason anyone chose. Measured across a
     * large corpus, podcasts average about -19 LUFS with a spread of ten;
     * -16 is what the platforms normalise to. This puts the show where every
     * other show is.
     */
    master: 'podcast',
  },
  {
    id: 'audiobook',
    labelKey: 'dsp.eqPreset.audiobook',
    group: 'repair',
    denoise: 'audiobook',
    eq: 'audiobook',
    // The same, at the quieter target and the -3 dBTP ceiling a submitted
    // audiobook is held to: hours of listening, so the level that matters is
    // the one that does not tire.
    master: 'audiobook',
  },
];
