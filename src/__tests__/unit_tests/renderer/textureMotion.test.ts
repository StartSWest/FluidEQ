/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * A look's texture moving with the music (Ivan, 2026-11-27: "they will
 * subtly move with music", and of the three ways shown, the drift): it
 * travels as fast as the music's flywheel turns, a kick pushes it, the
 * treble makes it glint, and nothing about it snaps. Off, on a plain or a
 * stroked look, or with motion reduced, there is no pose at all, which is
 * what prints the texture exactly as it always was.
 */

import { getDefaultTuning, type ILookTuning } from 'common/customLooks';
import { SILENT_RHYTHM } from 'common/sceneRhythm';
import { RUN_MAX_TURNS, type ISpectrumEnergy } from 'common/spectrumEnergy';
import { SILENT_VOICE } from 'common/voiceReading';
import type { ILiveSound } from 'renderer/graph/liveSound';
import {
  GLINT,
  createTextureMotion,
  lookTexturePose,
  moveTexture,
  texturePoseOf,
  textureUnitOf,
  type ITextureMotion,
} from 'renderer/graph/textureMotion';
import { prefersReducedMotion } from 'renderer/utils/bandReveal';

jest.mock('renderer/utils/bandReveal', () => ({
  ...jest.requireActual('renderer/utils/bandReveal'),
  prefersReducedMotion: jest.fn(() => false),
}));
const reduced = prefersReducedMotion as jest.MockedFunction<
  typeof prefersReducedMotion
>;

const TILE = 16;

const music = (heard: Partial<ISpectrumEnergy> = {}): ISpectrumEnergy => ({
  level: 0,
  bass: 0,
  mid: 0,
  treble: 0,
  beat: 0,
  accent: 0,
  accentSerial: 0,
  run: 0,
  runSpeed: 0,
  rhythm: SILENT_RHYTHM,
  voice: SILENT_VOICE,
  ...heard,
});

/** A chorus: the flywheel at its fastest, the level high, no kick. */
const CHORUS = music({ level: 0.9, bass: 0.7, runSpeed: RUN_MAX_TURNS });

/** Frames of `heard` at `fps` for `seconds`, each frame's step returned. */
const play = (
  state: ITextureMotion,
  heard: (frame: number) => ISpectrumEnergy | undefined,
  seconds: number,
  fps = 30,
): number[] => {
  const steps: number[] = [];
  for (let frame = 0; frame < seconds * fps; frame += 1) {
    const { x, y } = state;
    moveTexture(state, heard(frame), 1000 / fps, TILE);
    steps.push(Math.hypot(state.x - x, state.y - y));
  }
  return steps;
};

const travelled = (steps: readonly number[]) =>
  steps.reduce((sum, step) => sum + step, 0);

const dotsMoving: ILookTuning = {
  ...getDefaultTuning('analyzer'),
  filled: true,
  texture: 'dots',
  textureMotion: true,
};

const hearing = (heard: ISpectrumEnergy): ILiveSound => ({
  take: () => [],
  music: () => heard,
});

beforeEach(() => reduced.mockReturnValue(false));

describe('when the texture lies still', () => {
  it('has no pose with the switch off, no texture, a stroked look or motion reduced', () => {
    const sound = hearing(CHORUS);
    const poseOf = (tuning: ILookTuning) =>
      lookTexturePose(createTextureMotion(), tuning, sound, 33).pose;
    expect(poseOf({ ...dotsMoving, textureMotion: false })).toBeUndefined();
    expect(poseOf({ ...dotsMoving, texture: 'none' })).toBeUndefined();
    expect(poseOf({ ...dotsMoving, filled: false })).toBeUndefined();
    reduced.mockReturnValue(true);
    expect(poseOf(dotsMoving)).toBeUndefined();
    // The control: the same look with motion allowed has a pose.
    reduced.mockReturnValue(false);
    expect(poseOf(dotsMoving)).toBeDefined();
  });

  it('does not hear the music while it lies still', () => {
    const asked = jest.fn(() => CHORUS);
    const sound: ILiveSound = { take: () => [], music: asked };
    lookTexturePose(
      createTextureMotion(),
      { ...dotsMoving, textureMotion: false },
      sound,
      33,
    );
    expect(asked).not.toHaveBeenCalled();
    lookTexturePose(createTextureMotion(), dotsMoving, sound, 33);
    expect(asked).toHaveBeenCalledTimes(1);
  });

  it('starts again from where the texture lies, once switched off and on', () => {
    const state = createTextureMotion();
    const sound = hearing(CHORUS);
    for (let frame = 0; frame < 90; frame += 1) {
      lookTexturePose(state, dotsMoving, sound, 33);
    }
    // The control: three seconds of a chorus carried it well away.
    expect(Math.hypot(state.x, state.y)).toBeGreaterThan(TILE);
    lookTexturePose(state, { ...dotsMoving, textureMotion: false }, sound, 33);
    const { pose } = lookTexturePose(state, dotsMoving, sound, 33);
    expect(Math.hypot(pose?.x ?? 99, pose?.y ?? 99)).toBeLessThan(0.5);
    expect(pose?.reach).toBeLessThan(0.15);
  });
});

describe('travelling with the music', () => {
  it('stands still in silence and travels through a chorus', () => {
    const quiet = createTextureMotion();
    expect(travelled(play(quiet, () => undefined, 3))).toBe(0);
    expect(travelled(play(createTextureMotion(), () => music(), 3))).toBe(0);
    // A chorus: most of a tile a second from the flywheel and a little more
    // from the level, three seconds of it.
    const moved = travelled(play(createTextureMotion(), () => CHORUS, 3));
    expect(moved).toBeGreaterThan(2.5 * TILE);
    expect(moved).toBeLessThan(4 * TILE);
  });

  it('goes as fast as the flywheel turns', () => {
    const winding = music({ level: 0.9, runSpeed: RUN_MAX_TURNS * 0.3 });
    const slow = travelled(play(createTextureMotion(), () => winding, 3));
    const fast = travelled(play(createTextureMotion(), () => CHORUS, 3));
    expect(fast).toBeGreaterThan(slow * 1.6);
  });

  it('is pushed a little further on each kick, the bass deciding how far', () => {
    // A kick every half second, the beat's flash falling over 200 ms.
    const kicks = (bass: number) => (frame: number) =>
      music({
        ...CHORUS,
        bass,
        beat: Math.max(0, 1 - ((frame % 15) * 33) / 200),
      });
    const steady = travelled(play(createTextureMotion(), () => CHORUS, 3));
    const kicked = travelled(play(createTextureMotion(), kicks(0.9), 3));
    const lightly = travelled(play(createTextureMotion(), kicks(0), 3));
    expect(kicked).toBeGreaterThan(steady * 1.15);
    expect(lightly).toBeGreaterThan(steady);
    expect(kicked).toBeGreaterThan(lightly);
  });

  it('never jumps: a chorus arriving with a kick eases it into motion', () => {
    const arrival = music({ ...CHORUS, beat: 1, bass: 1 });
    const steps = play(createTextureMotion(), () => arrival, 2, 60);
    const settled = Math.max(...steps);
    // The first frame moves a small part of what a frame moves at speed.
    expect(steps[0]).toBeLessThan(settled * 0.15);
    // And no frame ever moves more than the next speed up allows.
    steps.slice(1).forEach((step, index) => {
      expect(step - steps[index]).toBeLessThan(settled * 0.12);
    });
    // The control: at full speed a frame moves most of a pixel at 60 a second.
    expect(settled).toBeGreaterThan(0.3);
  });

  it('coasts to rest when the music goes, never stopping dead', () => {
    const state = createTextureMotion();
    const before = play(state, () => CHORUS, 3);
    const after = play(state, () => undefined, 3);
    const last = before[before.length - 1];
    expect(after[0]).toBeGreaterThan(last * 0.8);
    after.slice(1).forEach((step, index) => {
      expect(step).toBeLessThanOrEqual(after[index] + 1e-9);
    });
    expect(after[after.length - 1]).toBeLessThan(last * 0.01);
    // And once it has come to rest it says so, so the graph may sleep.
    play(state, () => undefined, 3);
    expect(moveTexture(state, undefined, 33, TILE)).toBe(false);
  });

  it('travels as far at any frame rate', () => {
    const at30 = travelled(play(createTextureMotion(), () => CHORUS, 2, 30));
    const at144 = travelled(play(createTextureMotion(), () => CHORUS, 2, 144));
    expect(Math.abs(at144 - at30) / at30).toBeLessThan(0.03);
  });

  it('takes a long stall as a step, not a leap', () => {
    const state = createTextureMotion();
    play(state, () => CHORUS, 3);
    const { x, y } = state;
    moveTexture(state, CHORUS, 5000, TILE);
    const leap = Math.hypot(state.x - x, state.y - y);
    // At most a tenth of a second of travel at the fastest it goes.
    expect(leap).toBeLessThan(0.21 * TILE);
  });
});

describe('glinting with the treble', () => {
  it('glints with the hats and cymbals and never with a voice', () => {
    const hats = createTextureMotion();
    play(hats, () => music({ treble: 0.95 }), 0.5);
    const voice = createTextureMotion();
    play(voice, () => music({ treble: 0.52 }), 0.5);
    expect(texturePoseOf(hats).strength).toBeGreaterThan(1 + GLINT * 0.9);
    expect(texturePoseOf(hats).strength).toBeLessThanOrEqual(1 + GLINT);
    // The control: a singer's "s", under the treble's usual level.
    expect(texturePoseOf(voice).strength).toBe(1);
  });
});

describe('a picture over the whole plot', () => {
  it('grows into its margin over a second, never at the press', () => {
    const state = createTextureMotion();
    const sound = hearing(CHORUS);
    const first = lookTexturePose(state, dotsMoving, sound, 33).pose;
    expect(first?.reach).toBeLessThan(0.1);
    for (let frame = 0; frame < 60; frame += 1) {
      lookTexturePose(state, dotsMoving, sound, 33);
    }
    expect(
      lookTexturePose(state, dotsMoving, sound, 33).pose?.reach,
    ).toBeGreaterThan(0.99);
  });
});

describe('the tile the travel is counted in', () => {
  it.each([
    ['dots at their first size', { texture: 'dots', patternSize: 16 }, 16],
    ['small dots', { texture: 'dots', patternSize: 8 }, 8],
    ['grown dots', { texture: 'dots', patternSize: 96 }, 16],
    // Strokes half as far apart as the dots' rows: half the travel.
    ['a grid', { texture: 'grid', patternSize: 16 }, 8],
    ['a small grid', { texture: 'grid', patternSize: 8 }, 4],
    [
      'a hatch',
      { texture: 'hatch', patternSize: 16 },
      (16 * 16) / 3 / Math.SQRT2 / 8,
    ],
    [
      'a tiled picture',
      { texture: 'image', textureFit: 'tile', textureSize: 192 },
      16,
    ],
    [
      'a small tiled picture',
      { texture: 'image', textureFit: 'tile', textureSize: 12 },
      12,
    ],
    ['a picture over the plot', { texture: 'image', textureFit: 'cover' }, 16],
  ] as const)('%s', (_, tuning, unit) => {
    expect(
      textureUnitOf({ ...getDefaultTuning('analyzer'), ...tuning }),
    ).toBeCloseTo(unit, 9);
  });
});
