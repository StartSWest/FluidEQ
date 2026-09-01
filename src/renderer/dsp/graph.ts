/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * The wire, typed against what it needs rather than against Web Audio.
 *
 * jsdom has no Web Audio nodes, so tests provide this three-method shape. The
 * renderer uses real MediaElementAudioSourceNode and AudioWorkletNode values.
 */
export interface IAudioNodeLike {
  connect(
    destination: IAudioNodeLike,
    output?: number,
    input?: number,
  ): unknown;
  disconnect(): void;
}

export interface IDspGraph {
  dispose(): void;
}

/**
 * Wire source -> passthrough worklet -> destination.
 *
 * The TypeScript DSP rack was deleted when the native host became the only
 * engine. Keeping its old control plane after that deletion was a native-memory
 * leak: settings and linear-phase kernels were still structured-cloned into a
 * MessagePort whose processor had no message handler, so Chromium retained the
 * unread buffers outside the renderer's JS heap.
 *
 * This graph now owns exactly the path that still exists. Native analysis owns
 * the stage meters while their panel is mounted; an always-on bank of seven Web
 * Audio analysers would only keep FFT buffers for an invisible tab.
 */
export const buildDspGraph = (
  source: IAudioNodeLike,
  worklet: IAudioNodeLike,
  destination: IAudioNodeLike,
): IDspGraph => {
  worklet.connect(destination);
  source.connect(worklet);

  return {
    dispose() {
      source.disconnect();
      worklet.disconnect();
    },
  };
};
