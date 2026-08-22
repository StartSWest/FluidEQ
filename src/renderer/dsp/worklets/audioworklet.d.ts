/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * The AudioWorkletGlobalScope, declared here rather than pulled from
 * `@types/audioworklet`.
 *
 * Three globals is the whole surface this project uses, and a dependency
 * whose only job is to describe three globals is a dependency that can break
 * a build for nothing. The shapes below are from the Web Audio spec's
 * AudioWorkletGlobalScope definition.
 *
 * Only files under `worklets/` run in this scope. Nothing else may reference
 * these types — in the main renderer scope they do not exist at runtime.
 */

declare const sampleRate: number;

declare class AudioWorkletProcessor {
  readonly port: MessagePort;

  constructor();

  process(
    inputs: Float32Array[][],
    outputs: Float32Array[][],
    parameters: Record<string, Float32Array>,
  ): boolean;
}

declare function registerProcessor(
  name: string,
  processorCtor: new () => AudioWorkletProcessor,
): void;
