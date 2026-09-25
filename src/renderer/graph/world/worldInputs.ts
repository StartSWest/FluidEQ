/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import {
  DataTexture,
  LinearFilter,
  RedFormat,
  Texture,
  UnsignedByteType,
  Vector2,
  Vector3,
  Vector4,
  type IUniform,
} from 'three';
import type { IScenePack } from 'common/scenePacks';
import {
  WORLD_SIGNALS,
  worldInstanceScopeNames,
  worldParamName,
  worldScopeNames,
  worldVarUniform,
} from 'common/sceneWorld';
import { SILENT_RHYTHM } from 'common/sceneRhythm';
import { getEaseFactor } from 'common/smoothing';
import {
  SPECTRUM_TEXELS,
  WAVEFORM_TEXELS,
  uniformNameForParam,
} from 'common/sceneUniformContract';
import type {
  IExpressionRuntime,
  IExpressionScope,
} from 'common/worldExpression';
import type { ISceneFrame } from '../sceneGl';
import { HOME_CAMERA, NO_POINTER, NO_TAP } from '../sceneFrameRest';
import { createFormula, type IWorldFormula } from './worldFormula';

/**
 * The music a world is given each frame, in the two forms it is read in: the
 * uniforms the shader contract names (for the sky and for every material's
 * GLSL), and the plain numbers the formulas run on.
 *
 * The same measurements, eased the same way, as the shader-only path
 * (`sceneGl.ts`): a scene that moves its sky and its pillars off the same
 * spectrum must see them move together.
 */

export interface IWorldInputs {
  /** By uniform name; materials and the sky share these very objects. */
  uniforms: Record<string, IUniform>;
  runtime: IExpressionRuntime;
  /** A second runtime for per-copy formulas, over `instanceEnv`. */
  instanceRuntime: IExpressionRuntime;
  instanceEnv: Float64Array;
  /** Where the per-copy names start in `instanceEnv`. */
  instanceBase: number;
  scope: IExpressionScope;
  instanceScope: IExpressionScope;
  /** The spectrum as last given, 0..255, for anything that keeps history. */
  spectrumBytes: Uint8Array;
  /** The viewer's turn of the camera as last given: yaw, pitch, zoom. */
  view: [number, number, number];
  update(frame: ISceneFrame, width: number, height: number): void;
  settled(): boolean;
  dispose(): void;
}

const createLineTexture = (width: number) => {
  const texture = new DataTexture(
    new Uint8Array(width),
    width,
    1,
    RedFormat,
    UnsignedByteType,
  );
  texture.minFilter = LinearFilter;
  texture.magFilter = LinearFilter;
  texture.generateMipmaps = false;
  texture.needsUpdate = true;
  return texture;
};

/** Linear interpolation into bytes, as a sampler reads them, 0..1. */
const sampleBytes = (bytes: ArrayLike<number>, u: number, scale: number) => {
  const last = bytes.length - 1;
  const at = Math.min(1, Math.max(0, u)) * last;
  const low = Math.floor(at);
  const high = Math.min(last, low + 1);
  const t = at - low;
  return (bytes[low] + (bytes[high] - bytes[low]) * t) * scale;
};

export const createWorldInputs = (
  pack: IScenePack,
  artwork: Texture | null,
): IWorldInputs => {
  const { world } = pack;
  const paramIds = pack.params.map((param) => param.id);
  const varNames = (world?.vars ?? []).map((known) => known.name);
  const names = worldScopeNames(paramIds, varNames);
  const instanceNames = worldInstanceScopeNames(paramIds, varNames);
  const env = new Float64Array(names.length);
  const instanceEnv = new Float64Array(instanceNames.length);

  const spectrum = createLineTexture(SPECTRUM_TEXELS);
  const slow = createLineTexture(SPECTRUM_TEXELS);
  const waveform = createLineTexture(WAVEFORM_TEXELS);
  const spectrumBytes = spectrum.image.data as Uint8Array;
  const slowBytes = slow.image.data as Uint8Array;
  const waveBytes = waveform.image.data as Uint8Array;
  const slowValues = new Float32Array(SPECTRUM_TEXELS);
  // The contract always declares the artwork; a scene without one samples
  // a single black texel, which is what the shader-only path's unbound
  // unit reads as.
  const blank = new DataTexture(new Uint8Array(4), 1, 1);
  blank.needsUpdate = true;

  const sampler = {
    spectrum: (u: number) => sampleBytes(spectrumBytes, u, 1 / 255),
    slow: (u: number) => sampleBytes(slowValues, u, 1 / 255),
    wave: (u: number) => sampleBytes(waveBytes, u, 1 / 255),
  };
  const runtime: IExpressionRuntime = {
    env,
    state: new Float64Array(1),
    stateBase: 0,
    dt: 0,
    ...sampler,
  };
  const instanceRuntime: IExpressionRuntime = {
    env: instanceEnv,
    state: new Float64Array(1),
    stateBase: 0,
    dt: 0,
    ...sampler,
  };

  const uniforms: Record<string, IUniform> = {
    uTime: { value: 0 },
    uResolution: { value: new Vector2(1, 1) },
    uLevel: { value: 0 },
    uBeat: { value: 0 },
    uBands: { value: new Vector3() },
    uAccent: { value: new Vector3(1, 1, 1) },
    uSceneFade: { value: 1 },
    uSpectrum: { value: spectrum },
    uSpectrumSlow: { value: slow },
    uMusicAccent: { value: new Vector2() },
    uMusicRun: { value: new Vector2() },
    uWaveform: { value: waveform },
    uArtwork: { value: artwork ?? blank },
    uSpectrumRect: { value: new Vector4(0, 1, 0, 1) },
    uRhythm: { value: new Vector4() },
    uDrums: { value: new Vector3() },
    uSong: { value: new Vector4() },
    uStereo: { value: new Vector2() },
    uVoice: { value: new Vector3() },
    uPointer: { value: new Vector4(...NO_POINTER) },
    uTap: { value: new Vector4(...NO_TAP) },
    uCamera: { value: new Vector3(...HOME_CAMERA) },
    // Half the drawn height, for a point's size at a distance
    // (`buildPointsMaterial`).
    uWorldPointScale: { value: 1 },
  };
  pack.params.forEach((param) => {
    uniforms[uniformNameForParam(param.id)] = { value: param.value };
  });
  varNames.forEach((name) => {
    uniforms[worldVarUniform(name)] = { value: 0 };
  });

  const scope = { names };
  // Each variable reads those before it: compiled against the whole scope,
  // evaluated in order, so a later name is still 0 when an earlier one runs.
  const vars: { index: number; formula: IWorldFormula; uniform: IUniform }[] = (
    world?.vars ?? []
  ).map((known) => ({
    index: names.indexOf(known.name),
    formula: createFormula(known.value, runtime, scope),
    uniform: uniforms[worldVarUniform(known.name)],
  }));
  const paramSlots = pack.params.map((param) => ({
    id: param.id,
    fallback: param.value,
    index: names.indexOf(worldParamName(param.id)),
    uniform: uniforms[uniformNameForParam(param.id)],
  }));
  const slots = Object.fromEntries(
    WORLD_SIGNALS.map((name) => [name, names.indexOf(name)]),
  ) as Record<(typeof WORLD_SIGNALS)[number], number>;
  /** Consecutive signals from `first`, set from `values` in order. */
  const setRun = (
    first: (typeof WORLD_SIGNALS)[number],
    values: readonly number[],
  ) => {
    env.set(values, slots[first]);
  };

  const view: [number, number, number] = [...HOME_CAMERA];
  let previousTime: number | undefined;
  let isSettled = true;

  const easeSlow = (frame: ISceneFrame, elapsed: number) => {
    const attack = getEaseFactor(elapsed, 180);
    const release = getEaseFactor(elapsed, 420);
    isSettled = true;
    for (let i = 0; i < SPECTRUM_TEXELS; i += 1) {
      const target = frame.spectrum[i] ?? 0;
      if (previousTime === undefined) {
        slowValues[i] = target;
      }
      slowValues[i] +=
        (target - slowValues[i]) * (target > slowValues[i] ? attack : release);
      slowBytes[i] = Math.round(slowValues[i]);
      if (Math.abs(target - slowValues[i]) > 0.25) {
        isSettled = false;
      }
    }
  };

  return {
    uniforms,
    runtime,
    instanceRuntime,
    instanceEnv,
    instanceBase: names.length,
    scope,
    instanceScope: { names: instanceNames },
    spectrumBytes,
    view,
    update: (frame, width, height) => {
      const elapsed =
        previousTime === undefined
          ? 0
          : Math.max(
              0,
              Math.min(
                100,
                frame.deltaMs ?? (frame.timeSeconds - previousTime) * 1000,
              ),
            );
      spectrumBytes.set(frame.spectrum.subarray(0, SPECTRUM_TEXELS));
      waveBytes.set(frame.waveform.subarray(0, WAVEFORM_TEXELS));
      easeSlow(frame, elapsed);
      previousTime = frame.timeSeconds;
      spectrum.needsUpdate = true;
      slow.needsUpdate = true;
      waveform.needsUpdate = true;

      uniforms.uTime.value = frame.timeSeconds;
      (uniforms.uResolution.value as Vector2).set(width, height);
      uniforms.uWorldPointScale.value = height * 0.5;
      uniforms.uLevel.value = frame.level;
      uniforms.uBeat.value = frame.beat;
      (uniforms.uBands.value as Vector3).set(...frame.bands);
      (uniforms.uAccent.value as Vector3).set(...frame.accent);
      uniforms.uSceneFade.value = frame.fade;
      (uniforms.uMusicAccent.value as Vector2).set(...frame.musicAccent);
      (uniforms.uMusicRun.value as Vector2).set(...frame.musicRun);
      (uniforms.uSpectrumRect.value as Vector4).set(
        ...(frame.spectrumRect ?? [0, 1, 0, 1]),
      );
      // As the shader-only path fills them (`sceneGl.ts`): nothing heard,
      // nobody pointing and the author's own view where the frame is silent.
      const rhythm = frame.rhythm ?? SILENT_RHYTHM;
      const time = [
        rhythm.beatPhase,
        rhythm.barPhase,
        rhythm.tempo,
        rhythm.confidence,
      ] as const;
      const drums = [rhythm.kick, rhythm.snare, rhythm.hat] as const;
      const song = [
        rhythm.intensity,
        rhythm.build,
        rhythm.drop,
        rhythm.dropSerial,
      ] as const;
      const stereo = frame.stereo ?? [0, 0];
      const voice = frame.voice ?? [0, 0, 0];
      const pointer = frame.pointer ?? NO_POINTER;
      const tap = frame.tap ?? NO_TAP;
      [view[0], view[1], view[2]] = frame.camera ?? HOME_CAMERA;
      (uniforms.uRhythm.value as Vector4).set(...time);
      (uniforms.uDrums.value as Vector3).set(...drums);
      (uniforms.uSong.value as Vector4).set(...song);
      (uniforms.uStereo.value as Vector2).set(...stereo);
      (uniforms.uVoice.value as Vector3).set(...voice);
      (uniforms.uPointer.value as Vector4).set(...pointer);
      (uniforms.uTap.value as Vector4).set(...tap);
      (uniforms.uCamera.value as Vector3).set(...view);

      const dt = elapsed / 1000;
      runtime.dt = dt;
      instanceRuntime.dt = dt;
      env[slots.time] = frame.timeSeconds;
      env[slots.dt] = dt;
      env[slots.level] = frame.level;
      env[slots.beat] = frame.beat;
      [env[slots.bass], env[slots.mid], env[slots.treble]] = frame.bands;
      [env[slots.accent], env[slots.accentId]] = frame.musicAccent;
      [env[slots.run], env[slots.runSpeed]] = frame.musicRun;
      env[slots.aspect] = width / Math.max(1, height);
      setRun('beatPhase', time);
      setRun('drumKick', drums);
      setRun('songIntensity', song);
      setRun('stereoPan', stereo);
      setRun('voiceOpen', voice);
      setRun('pointerX', pointer);
      setRun('tapX', tap);
      setRun('viewYaw', view);
      paramSlots.forEach((param) => {
        const value = frame.params[param.id] ?? param.fallback;
        env[param.index] = value;
        param.uniform.value = value;
      });
      vars.forEach((known) => {
        const value = known.formula.value();
        env[known.index] = value;
        known.uniform.value = value;
      });
      instanceEnv.set(env);
    },
    settled: () => isSettled,
    dispose: () => {
      spectrum.dispose();
      slow.dispose();
      waveform.dispose();
      blank.dispose();
    },
  };
};
