/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import path from 'path';
import webpackPaths from './webpack.paths';

/**
 * The DSP worklet's build, defined once because dev and prod must not diverge.
 *
 * They did, and it cost a debugging session in a real window. The production
 * bundle worked and a test proved it; the development bundle threw
 * `ReferenceError: self is not defined` before reaching `registerProcessor`,
 * so `addModule` resolved with nothing registered and constructing the node
 * failed with "the node name 'fluideq-dsp' is not defined". Two copies of a
 * config are two chances to be right and only one of them was exercised.
 *
 * Three things have to be true and none of them is webpack's default:
 *
 *  - `library: 'var'`. The renderer bundles as `umd`, whose preamble probes
 *    for `exports`, `define` and a global object. An AudioWorkletGlobalScope
 *    has none of them, not even `self`.
 *  - `chunkLoading: false`. This is the one that only bit in development. The
 *    jsonp chunk-loading runtime webpack adds for HMR references `self` at top
 *    level, and a worklet has no `self` either. The worklet loads no chunks,
 *    so the runtime is pure overhead even where it works.
 *  - `wasmLoading: false`, for the same reason a step earlier: nothing here
 *    loads wasm, and its loader makes the same assumptions.
 *
 * An entry rather than the `\.worklet$` asset rule used by
 * `pitch-worklet.worklet`: that rule copies its file through untouched, so a
 * worklet using it must be self-contained. This one is not — its DSP is shared
 * with the graph and with the tests that prove the filters correct, and
 * duplicating four modules to avoid an entry would mean the tested code and
 * the shipped code were different code.
 */
export const DSP_WORKLET_ENTRY = {
  import: path.join(
    webpackPaths.srcRendererPath,
    'dsp/worklets/dspProcessor.worklet.ts',
  ),
  library: { type: 'var' as const, name: 'fluidEqDspWorklet' },
  chunkLoading: false as const,
  wasmLoading: false as const,
};

export default DSP_WORKLET_ENTRY;
