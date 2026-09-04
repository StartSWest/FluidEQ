/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import path from 'path';
import webpack from 'webpack';
import webpackPaths from './webpack.paths';

/**
 * The DSP worklet's build — its OWN compiler, not an entry in the renderer's.
 *
 * That separation is the whole point of this file, and it took two failed
 * attempts to arrive at. An AudioWorkletGlobalScope has no `window`, no
 * `self`, no `document` and no module system; every piece of machinery webpack
 * and its dev server wrap around a browser bundle assumes at least one of
 * them, and each one that leaks in throws before `registerProcessor` ever
 * runs. `addModule` does not report a throw from inside the module, so the
 * failure surfaces two steps later and points at the wrong thing: "the node
 * name 'fluideq-dsp' is not defined".
 *
 * Three leaks had to be closed, in this order:
 *
 *  1. The renderer's `umd` wrapper, which probes for `exports`, `define` and
 *     a global object. Fixed by `library: 'var'`.
 *  2. Webpack's jsonp chunk-loading runtime, added for HMR, which reads `self`
 *     at module scope. Fixed by `chunkLoading: false`. This one only appeared
 *     in development, and a test that only ever executed the production bundle
 *     could not see it.
 *  3. `webpack-dev-server`'s own client and `react-refresh`, which the server
 *     injects into every entry of a compiler it considers a web target. This
 *     one cannot be fixed per entry at all — `Server.addAdditionalEntries`
 *     decides PER COMPILER, from `Server.isWebTarget(compiler)`. Hence a
 *     separate compiler whose `target` is not in that list.
 *
 * `target: 'es2020'` is chosen precisely because `webpack-dev-server` does not
 * count it as a web target. Its list is `web`, `webworker`,
 * `electron-preload`, `electron-renderer`, `nwjs`, `node-webkit`, `undefined`
 * and `null` — so leaving `target` unset would inject, and `webworker` would
 * too (and would be wrong anyway: a worklet is not a worker and has no
 * `self`). `dspWorkletIsNotAWebTarget` in the tests asserts this against the
 * server's own function rather than against a copy of that list.
 *
 * It is an entry rather than the `\.worklet$` asset rule that
 * `pitch-worklet.worklet` uses, because that rule copies its file through
 * untouched and this worklet imports: its DSP is shared with the graph and
 * with the tests that prove the filters correct. Duplicating four modules into
 * a standalone file would mean the tested code and the shipped code were
 * different code.
 */
export const dspWorkletConfig = (
  isDevelopment: boolean,
): webpack.Configuration => ({
  // Not `web`, and not merely "not browser" — see the doc comment. This exact
  // value is what keeps the dev server's client out of the audio thread.
  target: 'es2020',

  mode: isDevelopment ? 'development' : 'production',

  // No source map in development either. A worklet's map would be fetched by
  // a scope that cannot fetch, and the eval-based devtools webpack prefers in
  // development need a global this file is built to avoid.
  devtool: false,

  entry: {
    'sender-spectrum': path.join(
      webpackPaths.srcRendererPath,
      'remoteAudio/senderSpectrum.worker.ts',
    ),
    'dsp-worklet': path.join(
      webpackPaths.srcRendererPath,
      'dsp/worklets/dspProcessor.worklet.ts',
    ),
  },

  output: {
    path: webpackPaths.distRendererPath,
    filename: isDevelopment ? '[name].dev.js' : '[name].js',
    // A plain assignment, which runs in any scope. The worklet exports
    // nothing — it registers a processor by side effect.
    library: { type: 'var', name: 'fluidEqDspWorklet' },
    chunkLoading: false,
    wasmLoading: false,
    // Required once `target` is a bare ECMAScript version: webpack infers the
    // chunk format from the environment, and `es2020` names no environment to
    // infer one from — it fails the build with "no default script chunk format
    // available". `false` is the honest answer here rather than a placeholder,
    // because `chunkLoading: false` means there is never a second chunk to
    // format.
    chunkFormat: false,
  },

  module: {
    rules: [
      {
        test: /\.ts$/,
        exclude: /node_modules/,
        use: {
          loader: 'ts-loader',
          options: {
            transpileOnly: true,
            compilerOptions: { module: 'esnext' },
          },
        },
      },
    ],
  },

  resolve: {
    extensions: ['.js', '.ts'],
    modules: [webpackPaths.srcPath, 'node_modules'],
    // Deliberately no `conditionNames: ['browser']`: the dev server treats
    // that as a web target too, whatever `target` says.
  },

  plugins: [
    new webpack.EnvironmentPlugin({
      NODE_ENV: isDevelopment ? 'development' : 'production',
    }),
  ],

  // Nothing here is worth splitting, and a split would reintroduce the chunk
  // loader that `chunkLoading: false` just removed.
  optimization: { splitChunks: false, runtimeChunk: false },

  performance: { hints: false },
});

export default dspWorkletConfig;
