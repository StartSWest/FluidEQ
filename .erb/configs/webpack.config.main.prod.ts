/**
 * Webpack config for production electron main process
 */

import path from 'path';
import webpack from 'webpack';
import { merge } from 'webpack-merge';
import TerserPlugin from 'terser-webpack-plugin';
import { BundleAnalyzerPlugin } from 'webpack-bundle-analyzer';
import baseConfig from './webpack.config.base';
import webpackPaths from './webpack.paths';
import checkNodeEnv from '../scripts/check-node-env';
import deleteSourceMaps from '../scripts/delete-source-maps';
import PUBLIC_ENV_DEFAULTS from './public-env';

checkNodeEnv('production');
deleteSourceMaps();

// The documented flow for debugging a production bundle. EnvironmentPlugin
// substitutes this at build time, so main.ts's isDebug folds to true in such a
// build — everything guarded by it is live code there, not dead code.
const isDebugProd = process.env.DEBUG_PROD === 'true';

const devtoolsConfig = isDebugProd
  ? {
      devtool: 'source-map',
    }
  : {};

const configuration: webpack.Configuration = {
  ...devtoolsConfig,

  mode: 'production',

  target: 'electron-main',

  entry: {
    main: path.join(webpackPaths.srcMainPath, 'main.ts'),
    preload: path.join(webpackPaths.srcMainPath, 'preload.ts'),
    'inference-worker': path.join(
      webpackPaths.srcMainPath,
      'inferenceWorker.ts',
    ),
    // The built-in player's preload — the ad blocker and nothing else. Kept
    // out of `preload` on purpose: that one is the app's own bridge, and this
    // one is loaded next to a web page.
    'video-preload': path.join(webpackPaths.srcMainPath, 'videoPreload.ts'),
    // Runs the library scan off the main thread. Its own entry because
    // `utilityProcess.fork` needs a real file to start, not a module main
    // happens to have loaded.
    'library-scan-worker': path.join(
      webpackPaths.srcMainPath,
      'library/scanWorker.ts',
    ),
  },

  output: {
    path: webpackPaths.distMainPath,
    filename: '[name].js',
  },

  optimization: {
    minimizer: [
      new TerserPlugin({
        parallel: true,
      }),
    ],
  },

  plugins: [
    new BundleAnalyzerPlugin({
      analyzerMode: process.env.ANALYZE === 'true' ? 'server' : 'disabled',
    }),

    /**
     * React DevTools are a development affordance. In a release build the
     * require in main.ts sits behind an isDebug guard that folds to false, so
     * terser drops the call — but webpack has already pulled the installer,
     * JSZip and pako into the graph, and V8 parses that dead code at every
     * launch. Nothing a user runs can reach the guarded branch, so drop it.
     *
     * Except under DEBUG_PROD, where isDebug folds to true and the branch is
     * reachable: with INSTALL_EXTENSIONS set, main.ts really does require this
     * module. Against a stub the require throws 'Cannot find module', the
     * rejection is swallowed by the catch on createMainWindow, and the build
     * someone is debugging starts with no window at all.
     */
    ...(isDebugProd
      ? []
      : [
          new webpack.IgnorePlugin({
            resourceRegExp: /^electron-devtools-installer$/,
          }),
        ]),

    /**
     * Create global constants which can be configured at compile time.
     *
     * Useful for allowing different behaviour between development builds and
     * release builds
     *
     * NODE_ENV should be production so that modules do not perform certain
     * development checks
     */
    new webpack.EnvironmentPlugin({
      NODE_ENV: 'production',
      DEBUG_PROD: false,
      START_MINIMIZED: false,
      // Public trust pins, set only by `pnpm package:signed`. They are compiled
      // into main so a third-party package cannot enable updates merely by
      // replacing app-update.yml. Azure credentials remain packaging-process
      // variables and must never be added here.
      FLUIDEQ_SIGN_PUBLISHER: '',
      FLUIDEQ_UPDATE_URL: '',
      // The same public values the renderer gets, because `src/common` is read
      // by both and a constant that resolves in one process and comes back
      // empty in the other is a fault nothing reports. PRODUCT_VERSION was
      // already like that: main imports `branding`, and its version string was
      // silently '' in this bundle while the window showed it correctly.
      //
      // Values only one side uses cost a few bytes and no thought. A rule that
      // says "the public values are the public values" holds; a list of which
      // ones each half happens to need today does not survive the next import.
      ...PUBLIC_ENV_DEFAULTS,
    }),
  ],

  /**
   * Disables webpack processing of __dirname and __filename.
   * If you run the bundle in node.js it falls back to these values of node.js.
   * https://github.com/webpack/webpack/issues/2010
   */
  node: {
    __dirname: false,
    __filename: false,
  },
};

export default merge(baseConfig, configuration);
