/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * How the pet follows the music (`petChoreography.ts`): each part of the
 * music moves its own part of her, and each case is held beside a control
 * that plays her the same thing without that part, so a choreography that
 * moved her all the time, or never, fails.
 */

import {
  createPetMotion,
  type IPetCue,
  type IPetMusic,
  type IPetPose,
  SILENT_PET_MUSIC,
  SLEEP_AFTER_MS,
  stepPetMotion,
} from '../../../renderer/pet/petChoreography';

const BEAT_S = 0.5;
const SUPPORTER: IPetCue = {
  hearsMusic: true,
  isListening: true,
  isPaused: false,
  isReducedMotion: false,
};

/** A drum's envelope `since` seconds after its hit, as the rhythm gives it. */
const envelope = (since: number, tauS: number) => Math.exp(-since / tauS);

interface ISong {
  beat?: boolean;
  kick?: boolean;
  snare?: boolean;
  hat?: boolean;
  sway?: boolean;
  voice?: boolean;
  intensity?: number;
  dropAt?: number;
}

/** 120 bpm with only the parts asked for. */
const songAt = (song: ISong, t: number): IPetMusic => {
  const beats = t / BEAT_S;
  const beatPhase = beats - Math.floor(beats);
  const sinceBeat = beatPhase * BEAT_S;
  const sinceEighth = (beats * 2 - Math.floor(beats * 2)) * (BEAT_S / 2);
  const kick = song.kick ? envelope(sinceBeat, 0.12) : 0;
  const isBackbeat = Math.floor(beats) % 2 === 1;
  const snare = song.snare && isBackbeat ? envelope(sinceBeat, 0.11) : 0;
  const hat = song.hat ? envelope(sinceEighth, 0.06) * 0.6 : 0;
  const dropped = song.dropAt !== undefined && t >= song.dropAt;
  return {
    ...SILENT_PET_MUSIC,
    level: 0.5,
    bass: Math.min(1, 0.72 * kick),
    mid: song.voice ? 0.5 : 0.1,
    treble: hat,
    beatPhase: song.beat ? beatPhase : 0,
    barPhase: song.sway ? beats / 4 - Math.floor(beats / 4) : 0,
    confidence: song.beat ? 1 : 0,
    kick,
    snare,
    hat,
    intensity: song.intensity ?? 0.5,
    drop: dropped ? envelope(t - (song.dropAt ?? 0), 0.6) : 0,
    dropSerial: dropped ? 1 : 0,
    voiceOpen: song.voice ? Math.max(0, Math.sin(beats * Math.PI)) : 0,
    voiceSure: song.voice ? 0.9 : 0,
  };
};

interface IFrame {
  t: number;
  music: IPetMusic;
  pose: IPetPose;
}

/** Play her `seconds` of the song, a frame every `stepMs`. */
const play = (
  song: ISong,
  seconds: number,
  cue: IPetCue = SUPPORTER,
  stepMs = 1000 / 60,
) => {
  const motion = createPetMotion();
  const frames: IFrame[] = [];
  for (let ms = 0; ms <= seconds * 1000; ms += stepMs) {
    const t = ms / 1000;
    const music = songAt(song, t);
    frames.push({ t, music, pose: stepPetMotion(motion, music, cue, stepMs) });
  }
  return frames;
};

/** The frames after she has had time to hear the song. */
const settled = (frames: IFrame[], afterS = 2) =>
  frames.filter((frame) => frame.t >= afterS);

const range = (values: number[]) => Math.max(...values) - Math.min(...values);
const mean = (values: number[]) =>
  values.reduce((sum, value) => sum + value, 0) / values.length;

describe('the beat', () => {
  it('lands her head on the beat, not between beats', () => {
    const frames = settled(play({ beat: true, intensity: 0.7 }, 6));
    const onBeat = frames.filter((f) => f.music.beatPhase < 0.06);
    const between = frames.filter(
      (f) => f.music.beatPhase > 0.4 && f.music.beatPhase < 0.6,
    );
    const down = mean(onBeat.map((f) => f.pose.faceY));
    const up = mean(between.map((f) => f.pose.faceY));
    expect(down).toBeGreaterThan(0.25);
    expect(down).toBeGreaterThan(up * 3);
  });

  it('holds her head still with no beat to keep (the control)', () => {
    const frames = settled(play({ intensity: 0.7 }, 6));
    expect(range(frames.map((f) => f.pose.faceY))).toBeLessThan(0.02);
  });
});

describe('the kick', () => {
  it('squashes her body on each kick', () => {
    const frames = settled(play({ kick: true }, 4));
    expect(Math.min(...frames.map((f) => f.pose.scaleY))).toBeLessThan(0.96);
  });

  // Her breath stretches her too, so the rebound is measured against the
  // same four seconds with no kick: a body that only squashed and came back
  // would stand no taller than her breathing makes her.
  it('springs her back past her shape after it, like something soft', () => {
    const tallest = (frames: IFrame[]) =>
      Math.max(...frames.map((f) => f.pose.scaleY));
    const withKick = tallest(settled(play({ kick: true }, 4)));
    const breathing = tallest(settled(play({}, 4)));
    expect(withKick - breathing).toBeGreaterThan(0.002);
  });

  it('leaves her body alone without one (the control)', () => {
    const frames = settled(play({}, 4));
    const heights = frames.map((f) => f.pose.scaleY);
    expect(Math.min(...heights)).toBeGreaterThan(0.99);
    expect(Math.max(...heights)).toBeLessThan(1.012);
  });
});

describe('the hats', () => {
  it('flick her ears', () => {
    const frames = settled(play({ hat: true }, 4));
    expect(range(frames.map((f) => f.pose.earLeft))).toBeGreaterThan(0.05);
    expect(range(frames.map((f) => f.pose.earRight))).toBeGreaterThan(0.05);
  });

  it('leave her ears still without hats (the control)', () => {
    const frames = settled(play({}, 4));
    expect(range(frames.map((f) => f.pose.earLeft))).toBeLessThan(0.01);
  });
});

describe('the snare and the bar', () => {
  it('sway her a bar each way and tilt her on the backbeat', () => {
    const frames = settled(
      play({ beat: true, snare: true, sway: true, intensity: 0.8 }, 8),
    );
    expect(range(frames.map((f) => f.pose.lean))).toBeGreaterThan(0.1);
  });

  it('keep her upright without them (the control)', () => {
    const frames = settled(play({ beat: true, intensity: 0.8 }, 8));
    expect(range(frames.map((f) => f.pose.lean))).toBeLessThan(0.01);
  });
});

describe('the voice', () => {
  it('opens her mouth while somebody sings', () => {
    const frames = settled(play({ voice: true }, 4));
    expect(Math.max(...frames.map((f) => f.pose.mouth))).toBeGreaterThan(0.5);
  });

  it('keeps it closed with nobody singing (the control)', () => {
    const frames = settled(play({}, 4));
    expect(Math.max(...frames.map((f) => f.pose.mouth))).toBe(0);
  });
});

describe('a drop', () => {
  it('makes her jump, in a song too calm to hop to', () => {
    const frames = play(
      { beat: true, kick: true, intensity: 0.5, dropAt: 3 },
      4,
    );
    const before = frames.filter((f) => f.t < 3);
    const after = frames.filter((f) => f.t >= 3 && f.t < 3.6);
    expect(Math.max(...before.map((f) => f.pose.hop))).toBe(0);
    expect(Math.max(...after.map((f) => f.pose.hop))).toBeGreaterThan(0.1);
  });

  it('has her hopping on the beat in an intense chorus, and not in a calm one', () => {
    const intense = settled(play({ beat: true, kick: true, intensity: 1 }, 6));
    const calm = settled(play({ beat: true, kick: true, intensity: 0.5 }, 6));
    expect(Math.max(...intense.map((f) => f.pose.hop))).toBeGreaterThan(0.05);
    expect(Math.max(...calm.map((f) => f.pose.hop))).toBe(0);
  });
});

describe('who hears the music', () => {
  const loud: ISong = {
    beat: true,
    kick: true,
    snare: true,
    hat: true,
    sway: true,
    voice: true,
    intensity: 1,
  };

  it('is only a supporter’s pet', () => {
    const frames = settled(play(loud, 4, { ...SUPPORTER, hearsMusic: false }));
    expect(Math.max(...frames.map((f) => f.pose.mouth))).toBe(0);
    expect(Math.max(...frames.map((f) => f.pose.hop))).toBe(0);
    expect(range(frames.map((f) => f.pose.lean))).toBeLessThan(0.01);
    // The control: the same song moves a supporter's pet.
    const supporter = settled(play(loud, 4));
    expect(Math.max(...supporter.map((f) => f.pose.mouth))).toBeGreaterThan(
      0.5,
    );
  });

  it('holds still for somebody who asked for less motion', () => {
    const frames = settled(
      play(loud, 4, { ...SUPPORTER, isReducedMotion: true }),
    );
    frames.forEach(({ pose }) => {
      expect(pose.lean).toBe(0);
      expect(pose.hop).toBe(0);
      expect(pose.scaleX).toBe(1);
      expect(pose.scaleY).toBe(1);
      expect(pose.blink).toBe(0);
      expect(pose.mouth).toBe(0);
    });
  });
});

describe('silence', () => {
  /** Silence after the meters let go, for `ms`, then whatever follows. */
  const silentFor = (ms: number) => {
    const motion = createPetMotion();
    const quiet: IPetCue = { ...SUPPORTER, isListening: false };
    let pose = stepPetMotion(motion, SILENT_PET_MUSIC, quiet, 16);
    for (let at = 0; at < ms; at += 50) {
      pose = stepPetMotion(motion, SILENT_PET_MUSIC, quiet, 50);
    }
    return { motion, pose };
  };

  it('makes her drowsy at once and puts her to sleep after a while', () => {
    const drowsy = silentFor(10000).pose;
    expect(drowsy.isAsleep).toBe(false);
    expect(drowsy.lid).toBeGreaterThan(0.2);
    expect(drowsy.lid).toBeLessThan(0.5);
    const asleep = silentFor(SLEEP_AFTER_MS + 8000).pose;
    expect(asleep.isAsleep).toBe(true);
    expect(asleep.lid).toBeGreaterThan(0.9);
  });

  it('wakes her when the sound comes back, ears up and eyes open', () => {
    const { motion } = silentFor(SLEEP_AFTER_MS + 8000);
    let pose = stepPetMotion(motion, SILENT_PET_MUSIC, SUPPORTER, 16);
    expect(pose.isAsleep).toBe(false);
    for (let at = 0; at < 3000; at += 16) {
      pose = stepPetMotion(motion, SILENT_PET_MUSIC, SUPPORTER, 16);
    }
    expect(pose.lid).toBeLessThan(0.05);
  });

  it('keeps her awake while she can hear (the control)', () => {
    const motion = createPetMotion();
    let pose = stepPetMotion(motion, SILENT_PET_MUSIC, SUPPORTER, 16);
    for (let at = 0; at < SLEEP_AFTER_MS + 8000; at += 50) {
      pose = stepPetMotion(motion, SILENT_PET_MUSIC, SUPPORTER, 50);
    }
    expect(pose.isAsleep).toBe(false);
    expect(pose.lid).toBeLessThan(0.01);
  });
});

describe('her clock', () => {
  it('moves her as far on a slow frame as on fast ones', () => {
    const song: ISong = { beat: true, kick: true, intensity: 0.7 };
    const fast = settled(play(song, 6, SUPPORTER, 1000 / 120));
    const slow = settled(play(song, 6, SUPPORTER, 1000 / 30));
    const deepest = (frames: IFrame[]) =>
      Math.max(...frames.map((f) => f.pose.faceY));
    const squashed = (frames: IFrame[]) =>
      Math.min(...frames.map((f) => f.pose.scaleY));
    expect(deepest(fast)).toBeGreaterThan(0.25);
    expect(Math.abs(deepest(fast) - deepest(slow))).toBeLessThan(0.08);
    expect(Math.abs(squashed(fast) - squashed(slow))).toBeLessThan(0.02);
  });
});
