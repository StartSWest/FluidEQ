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
  const signal = (name: (typeof WORLD_SIGNALS)[number]) => names.indexOf(name);
  const slots = {
    time: signal('time'),
    dt: signal('dt'),
    level: signal('level'),
    beat: signal('beat'),
    bass: signal('bass'),
    mid: signal('mid'),
    treble: signal('treble'),
    accent: signal('accent'),
    accentId: signal('accentId'),
    run: signal('run'),
    runSpeed: signal('runSpeed'),
    aspect: signal('aspect'),
  };

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
