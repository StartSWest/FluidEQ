/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import {
  clampSceneCamera,
  readSceneCamera,
  turnsRound,
} from '../../../common/sceneCamera';
import { SILENT_RHYTHM } from '../../../common/sceneRhythm';
import { SCENE_TAP_AGE_LIMIT_S } from '../../../common/sceneUniformContract';
import {
  CARRY_LIMIT_MS,
  carriedOn,
} from '../../../renderer/graph/sceneFrameCarry';
import type { ISceneFrame } from '../../../renderer/graph/sceneGl';
import {
  createStereoFollower,
  readStereoImage,
} from '../../../renderer/graph/stereoImage';

/**
 * What contract 8 hands a scene beside the music's levels: a camera the
 * viewer turns within the author's limits, where the music stands between
 * the speakers, and clocks that keep time between the page's frames.
 */

describe("a scene's camera", () => {
  it("keeps the author's limits, and the author's own view inside them", () => {
    const limits = readSceneCamera({
      yaw: [-0.8, 0.8],
      pitch: [0.2, 0.6],
      zoom: [0.5, 2],
    });
    // A pitch range that leaves out the view the author drew is stretched
    // to take it in: 0 is where the scene opens.
    expect(limits).toEqual({
      yaw: [-0.8, 0.8],
      pitch: [0, 0.6],
      zoom: [0.5, 2],
    });
  });

  it('keeps a range past what a camera can do as far as it can go', () => {
    const limits = readSceneCamera({ pitch: [-3, 3], zoom: [0, 99] });
    expect(limits?.pitch).toEqual([-1.45, 1.45]);
    expect(limits?.zoom).toEqual([0.25, 4]);
    expect(limits?.yaw).toEqual([0, 0]);
  });

  it('is no camera at all where nothing can move', () => {
    expect(readSceneCamera(undefined)).toBeUndefined();
    expect(readSceneCamera({})).toBeUndefined();
    expect(readSceneCamera({ yaw: [0, 0], zoom: 'far' })).toBeUndefined();
    expect(readSceneCamera([0, 1])).toBeUndefined();
  });

  it('stops where the scene stops, so a drag back moves it at once', () => {
    const limits = readSceneCamera({ yaw: [-0.5, 0.5] });
    if (!limits) {
      throw new Error('no limits');
    }
    expect(clampSceneCamera({ yaw: 3, pitch: 1, zoom: 9 }, limits)).toEqual({
      yaw: 0.5,
      pitch: 0,
      zoom: 1,
    });
  });

  it('turns round and round where the author allows a whole circle', () => {
    // [-3.14, 3.14] is a member's whole circle, a hair short of one.
    const limits = readSceneCamera({ yaw: [-3.14, 3.14] });
    if (!limits) {
      throw new Error('no limits');
    }
    expect(turnsRound(limits)).toBe(true);
    const turned = clampSceneCamera({ yaw: 7, pitch: 0, zoom: 1 }, limits);
    // Kept inside one turn, at the same angle.
    expect(turned.yaw).toBeCloseTo(7 - 2 * Math.PI, 9);
    expect(turnsRound({ ...limits, yaw: [-2, 2] })).toBe(false);
  });
});

describe('where the music stands', () => {
  const tone = (amplitude: number, phase = 0) =>
    Float32Array.from(
      { length: 1024 },
      (_, at) => amplitude * Math.sin((2 * Math.PI * at) / 64 + phase),
    );

  it('reads a mono mix as centred and narrow, however loud', () => {
    const out: [number, number] = [9, 9];
    expect(readStereoImage(tone(0.5), tone(0.5), out)).toEqual([0, 0]);
    expect(readStereoImage(tone(0.01), tone(0.01), out)).toEqual([0, 0]);
  });

  it('reads a side louder than the other as over there', () => {
    const [balance, width] = readStereoImage(tone(0.1), tone(0.3), [0, 0]);
    expect(balance).toBeCloseTo(0.5, 6);
    expect(width).toBeGreaterThan(0);
    const [left] = readStereoImage(tone(0.3), tone(0), [0, 0]);
    expect(left).toBe(-1);
  });

  // Peaks said which side was louder and nothing else: a wide mix with both
  // sides equally loud read as mono.
  it('reads two unrelated sides at one level as wide, and centred', () => {
    const [balance, width] = readStereoImage(
      tone(0.3),
      tone(0.3, Math.PI / 2),
      [0, 0],
    );
    expect(balance).toBeCloseTo(0, 6);
    expect(width).toBeCloseTo(0.5, 2);
    // One side the other's opposite is as wide as it gets.
    expect(readStereoImage(tone(0.3), tone(0.3, Math.PI), [0, 0])[1]).toBe(1);
  });

  it('is nothing in silence', () => {
    expect(
      readStereoImage(new Float32Array(1024), new Float32Array(1024), [5, 5]),
    ).toEqual([0, 0]);
  });

  it('follows the music eased, and settles to the middle when nothing is heard', () => {
    const follow = createStereoFollower();
    const first = follow([1, 1], 90);
    expect(first[0]).toBeCloseTo(0.5, 6);
    // Each step a fresh pair: a recorded moment keeps the one it was given.
    const second = follow([1, 1], 90);
    expect(second).not.toBe(first);
    expect(first[0]).toBeCloseTo(0.5, 6);
    let settled = second;
    for (let step = 0; step < 50; step += 1) {
      settled = follow(undefined, 100);
    }
    expect(settled[0]).toBeLessThan(0.001);
    expect(settled[1]).toBeLessThan(0.001);
  });
});

describe("a page frame carried on between the page's frames", () => {
  const frame: ISceneFrame = {
    timeSeconds: 1,
    level: 0.5,
    beat: 0,
    bands: [0, 0, 0],
    musicAccent: [0, 0],
    musicRun: [0, 0],
    accent: [0, 0, 0],
    fade: 1,
    spectrum: new Uint8Array(4),
    waveform: new Uint8Array(4),
    rhythm: {
      ...SILENT_RHYTHM,
      tempo: 120,
      beatPhase: 0.9,
      barPhase: 0.2,
      running: true,
    },
    tap: [0.5, 0.5, 0.2, 1],
    params: {},
  };

  // A clock held for a page frame and then jumped reads as a dancer
  // stepping at thirty frames a second on a display drawing 144.
  it('moves the beat and bar on at the tempo, and ages a tap', () => {
    const carried = carriedOn(frame, 50);
    // 50 ms at 120 is a tenth of a beat, round past the beat's end.
    expect(carried.rhythm?.beatPhase).toBeCloseTo(0, 9);
    expect(carried.rhythm?.barPhase).toBeCloseTo(0.225, 9);
    expect(carried.tap?.[2]).toBeCloseTo(0.25, 9);
    // Everything else as the page read it.
    expect({ ...carried, rhythm: frame.rhythm, tap: frame.tap }).toEqual(frame);
  });

  it('holds a clock that is not running, and stops at the limit', () => {
    const stopped = {
      ...frame,
      rhythm: { ...SILENT_RHYTHM, tempo: 120, beatPhase: 0.4, running: false },
    };
    expect(carriedOn(stopped, 50).rhythm).toBe(stopped.rhythm);
    // A page that has stopped sending is not run on by itself.
    expect(carriedOn(frame, 10_000).rhythm?.barPhase).toBeCloseTo(
      0.2 + (CARRY_LIMIT_MS * 120) / 60_000 / 4,
      9,
    );
    expect(carriedOn(frame, 0)).toBe(frame);
  });

  it('lets an old tap stay old', () => {
    const old = {
      ...frame,
      tap: [0.5, 0.5, SCENE_TAP_AGE_LIMIT_S, 1] as const,
    };
    expect(carriedOn(old, 50).tap).toBe(old.tap);
  });
});
