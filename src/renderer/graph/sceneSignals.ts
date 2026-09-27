/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { SILENT_RHYTHM } from 'common/sceneRhythm';
import { SPECTRUM_TEXELS } from 'common/sceneUniformContract';
import { getEaseFactor } from 'common/smoothing';
import type { ISceneFrame } from './sceneGl';
import { HOME_CAMERA, NO_POINTER, NO_TAP } from './sceneFrameRest';

/**
 * What a frame hands a scene beyond its own numbers, worked out one way for
 * the shader path (`sceneGl.ts`) and a 3D world (`world/worldInputs.ts`)
 * alike. The world is a bundle of its own, and each kept its own copy of
 * these — the step a clock takes, the eased spectrum, the music's signals
 * laid into the contract's values — which is how one rule becomes two that
 * disagree. Nothing here touches a GPU, so the world's bundle carries none of
 * the shader path by importing it.
 */

/**
 * Milliseconds since the frame before, as a scene's clocks take them: the
 * frame's own step, or its time's, never below nought and never more than a
 * tenth of a second, so a page that slept does not jump its scene.
 */
export const frameStepMs = (
  frame: ISceneFrame,
  previousTime: number | undefined,
): number =>
  previousTime === undefined
    ? 0
    : Math.max(
        0,
        Math.min(
          100,
          frame.deltaMs ?? (frame.timeSeconds - previousTime) * 1000,
        ),
      );

/**
 * The spectrum eased for the atmospheric texture (`uSpectrumSlow`). The
 * analyser's updates arrive in steps and a sky that followed them stepped
 * too; this rises over 180 ms and falls over 420, while meters and boats
 * keep the raw one. Settled once every bin is within a quarter of a step of
 * where it is going, which is when a still scene may rest.
 */
export const createSlowSpectrum = () => {
  const values = new Float32Array(SPECTRUM_TEXELS);
  const bytes = new Uint8Array(SPECTRUM_TEXELS);
  let started = false;
  let settled = true;
  return {
    /** Eased, unrounded: what a world's formulas read. */
    values: values as Readonly<Float32Array>,
    /** Eased and rounded: what the texture holds. */
    bytes,
    ease: (spectrum: Uint8Array, elapsedMs: number): void => {
      const attack = getEaseFactor(elapsedMs, 180);
      const release = getEaseFactor(elapsedMs, 420);
      settled = true;
      for (let i = 0; i < SPECTRUM_TEXELS; i += 1) {
        const target = spectrum[i] ?? 0;
        if (!started) {
          values[i] = target;
        }
        values[i] +=
          (target - values[i]) * (target > values[i] ? attack : release);
        bytes[i] = Math.round(values[i]);
        if (Math.abs(target - values[i]) > 0.25) {
          settled = false;
        }
      }
      started = true;
    },
    settled: () => settled,
  };
};

/**
 * The music's time and shape, the listener's hands and the camera, as the
 * contract's values (`uRhythm`, `uDrums`, `uSong`, `uStereo`, `uVoice`,
 * `uPointer`, `uTap`, `uCamera`): nothing heard, nobody pointing and the
 * author's own view wherever the frame says nothing.
 */
export const frameSignals = (frame: ISceneFrame) => {
  const rhythm = frame.rhythm ?? SILENT_RHYTHM;
  return {
    rhythm: [
      rhythm.beatPhase,
      rhythm.barPhase,
      rhythm.tempo,
      rhythm.confidence,
    ] as const,
    drums: [rhythm.kick, rhythm.snare, rhythm.hat] as const,
    song: [
      rhythm.intensity,
      rhythm.build,
      rhythm.drop,
      rhythm.dropSerial,
    ] as const,
    stereo: frame.stereo ?? ([0, 0] as const),
    voice: frame.voice ?? ([0, 0, 0] as const),
    pointer: frame.pointer ?? NO_POINTER,
    tap: frame.tap ?? NO_TAP,
    camera: frame.camera ?? HOME_CAMERA,
  };
};
