/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import type { ISpectrumEnergy } from 'common/spectrumEnergy';

/** What the pet's choreography hears, knows and says (`petChoreography.ts`). */

/** The parts of the music she listens to (`ISpectrumEnergy`). */
export interface IPetMusic {
  level: number;
  bass: number;
  mid: number;
  treble: number;
  /** 0 on a beat, rising to 1 where the next is expected. */
  beatPhase: number;
  /** The same over a bar of four. */
  barPhase: number;
  /** How sure the beat clock is, 0..1. */
  confidence: number;
  /** Each drum as an envelope: 1 at its hit, falling away quickly. */
  kick: number;
  snare: number;
  hat: number;
  intensity: number;
  build: number;
  drop: number;
  dropSerial: number;
  voiceOpen: number;
  /** The voice's note, 0 low to 1 high. */
  voicePitch: number;
  voiceSure: number;
}

export const SILENT_PET_MUSIC: IPetMusic = {
  level: 0,
  bass: 0,
  mid: 0,
  treble: 0,
  beatPhase: 0,
  barPhase: 0,
  confidence: 0,
  kick: 0,
  snare: 0,
  hat: 0,
  intensity: 0,
  build: 0,
  drop: 0,
  dropSerial: 0,
  voiceOpen: 0,
  voicePitch: 0.5,
  voiceSure: 0,
};

export const petMusicOf = (energy: ISpectrumEnergy): IPetMusic => ({
  level: energy.level,
  bass: energy.bass,
  mid: energy.mid,
  treble: energy.treble,
  beatPhase: energy.rhythm.beatPhase,
  barPhase: energy.rhythm.barPhase,
  confidence: energy.rhythm.confidence,
  kick: energy.rhythm.kick,
  snare: energy.rhythm.snare,
  hat: energy.rhythm.hat,
  intensity: energy.rhythm.intensity,
  build: energy.rhythm.build,
  drop: energy.rhythm.drop,
  dropSerial: energy.rhythm.dropSerial,
  voiceOpen: energy.voice.open,
  voicePitch: energy.voice.pitch,
  voiceSure: energy.voice.sure,
});

/** What she knows besides the music. */
export interface IPetCue {
  /** She hears the music at all: a supporter's pet, on a surface that plays it. */
  hearsMusic: boolean;
  /** The meters have not let go of the last sound (`hasLetGo`). */
  isListening: boolean;
  isPaused: boolean;
  isReducedMotion: boolean;
}

/** One frame of her, every part as a share of her body's radius or in radians. */
export interface IPetPose {
  swayX: number;
  lean: number;
  hop: number;
  scaleX: number;
  scaleY: number;
  faceX: number;
  faceY: number;
  earLeft: number;
  earRight: number;
  eyeWide: number;
  blink: number;
  /** How far sleep has closed her eyes, 0..1. */
  lid: number;
  pupil: number;
  gazeX: number;
  gazeY: number;
  mouth: number;
  smile: number;
  footLeft: number;
  footRight: number;
  pawLeft: number;
  pawRight: number;
  /** Her fur's swing behind her moves, in radians. */
  furSwing: number;
  /** How far her fur stands up with each part of the music, 0..1. */
  furBass: number;
  furMid: number;
  furTreble: number;
  furHat: number;
  /** The bass in her headphones. */
  speaker: number;
  starPop: number;
  /**
   * A loud chorus: her squint, her grin and the waves in her eyes. It
   * follows the song, never a switch; Colourful mode, always on, kept it at
   * full for good.
   */
  joy: number;
  isAsleep: boolean;
}

/** Her standing still, eyes open: the share card, and the first frame. */
export const REST_POSE: IPetPose = {
  swayX: 0,
  lean: 0,
  hop: 0,
  scaleX: 1,
  scaleY: 1,
  faceX: 0,
  faceY: 0,
  earLeft: 0.02,
  earRight: -0.02,
  eyeWide: 1,
  blink: 0,
  lid: 0,
  pupil: 0.86,
  gazeX: 0,
  gazeY: 0,
  mouth: 0,
  smile: 0.42,
  footLeft: 0,
  footRight: 0,
  pawLeft: 0,
  pawRight: 0,
  furSwing: 0,
  furBass: 0,
  furMid: 0,
  furTreble: 0,
  furHat: 0,
  speaker: 0,
  starPop: 0,
  joy: 0,
  isAsleep: false,
};
