/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { SMOOTH_FRAME_MS } from '../../../common/smoothing';
import {
  createRestWatch,
  isSilentWaveform,
  SCENE_REST_AFTER_MS,
  SCENE_REST_PACE_MS,
  SCENE_SILENCE_PEAK,
} from '../../../renderer/graph/sceneRest';

describe('a scene at rest', () => {
  it('rests at the graph’s thirty', () => {
    expect(SCENE_REST_PACE_MS).toBe(SMOOTH_FRAME_MS);
  });

  it('hears silence in a waveform under the floor, and sound in one peak over it', () => {
    expect(isSilentWaveform([])).toBe(true);
    expect(isSilentWaveform([0, 0.001, SCENE_SILENCE_PEAK * 0.9])).toBe(true);
    expect(isSilentWaveform([0, 0, SCENE_SILENCE_PEAK * 2, 0])).toBe(false);
    // Peaks are magnitudes; a negative one is still a peak.
    expect(isSilentWaveform([-0.5])).toBe(false);
  });

  /** A gap between tracks is shorter than the wait: the rate never wavers over one. */
  it('rests only after silence has lasted the wait, judged on the frames’ own clock', () => {
    const watch = createRestWatch();
    expect(watch.frame(0, true)).toBe(false);
    expect(watch.frame(SCENE_REST_AFTER_MS - 1, true)).toBe(false);
    expect(watch.resting()).toBe(false);
    expect(watch.frame(SCENE_REST_AFTER_MS, true)).toBe(true);
    expect(watch.resting()).toBe(true);
  });

  it('wakes on the first frame with sound in it, and starts the wait again after', () => {
    const watch = createRestWatch();
    watch.frame(0, true);
    watch.frame(SCENE_REST_AFTER_MS, true);
    expect(watch.resting()).toBe(true);
    expect(watch.frame(SCENE_REST_AFTER_MS + 16, false)).toBe(false);
    expect(watch.resting()).toBe(false);
    // Silent again: the whole wait, counted from now, not from before.
    expect(watch.frame(SCENE_REST_AFTER_MS + 32, true)).toBe(false);
    expect(watch.frame(SCENE_REST_AFTER_MS * 2, true)).toBe(false);
    expect(watch.frame(SCENE_REST_AFTER_MS * 2 + 32, true)).toBe(true);
  });

  it('starts over on reset', () => {
    const watch = createRestWatch();
    watch.frame(0, true);
    watch.frame(SCENE_REST_AFTER_MS, true);
    watch.reset();
    expect(watch.resting()).toBe(false);
    expect(watch.frame(SCENE_REST_AFTER_MS + 1, true)).toBe(false);
  });
});
