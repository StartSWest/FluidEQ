/**
 * Builds the DLL for development electron renderer process
 */

import webpack from 'webpack';
import path from 'path';
import { merge } from 'webpack-merge';
import baseConfig from './webpack.config.base';
import webpackPaths from './webpack.paths';
import { dependencies } from '../../package.json';
import checkNodeEnv from '../scripts/check-node-env';

checkNodeEnv('development');

const dist = webpackPaths.dllPath;
// These editor-only packages are lazy web modules. Prebundling them in the
// legacy Electron DLL selects their Node/native export conditions and pulls
// platform binaries into the renderer. Leaving them to the real renderer
// build selects the intended browser/WASM implementation instead.
const lazyWebDependencies = new Set([
  '@huggingface/transformers',
  '@spotify/basic-pitch',
]);

const configuration: webpack.Configuration = {
  context: webpackPaths.rootPath,

  devtool: 'eval',

  mode: 'development',

  target: 'electron-renderer',

  externals: ['fsevents', 'crypto-browserify'],

  /**
   * Use `module` from `webpack.config.renderer.dev.js`
   */
  // The named export: the default is an array of two compilers now, and
  // `.module` on an array is undefined — which would build the DLL with no
  // loader rules and report nothing.
  module: require('./webpack.config.renderer.dev').rendererDevConfig.module,

  entry: {
    renderer: Object.keys(dependencies || {}).filter(
      (dependency) => !lazyWebDependencies.has(dependency),
    ),
  },

  output: {
    path: dist,
    filename: '[name].dev.dll.js',
    library: {
      name: 'renderer',
      type: 'var',
    },
  },

  plugins: [
    new webpack.DllPlugin({
      path: path.join(dist, '[name].json'),
      name: '[name]',
    }),

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
      NODE_ENV: 'development',
    }),

    new webpack.LoaderOptionsPlugin({
      debug: true,
      options: {
        context: webpackPaths.srcPath,
        output: {
          path: webpackPaths.dllPath,
        },
      },
    }),
  ],
};

export default merge(baseConfig, configuration);
