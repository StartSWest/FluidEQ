import path from 'path';
import webpack from 'webpack';
import { merge } from 'webpack-merge';
import { BundleAnalyzerPlugin } from 'webpack-bundle-analyzer';
import baseConfig from './webpack.config.base';
import webpackPaths from './webpack.paths';
import checkNodeEnv from '../scripts/check-node-env';

// When an ESLint server is running, we can't set the NODE_ENV so we'll check if it's
// at the dev webpack config is not accidentally run in a production environment
if (process.env.NODE_ENV === 'production') {
  checkNodeEnv('development');
}

const configuration: webpack.Configuration = {
  devtool: 'inline-source-map',

  mode: 'development',

  target: 'electron-preload',

  // Two preloads, and they are not interchangeable. `preload` is the app's own
  // bridge; `video-preload` runs inside the built-in player, next to a web page
  // we do not control, and shares none of it.
  entry: {
    preload: path.join(webpackPaths.srcMainPath, 'preload.ts'),
    'video-preload': path.join(webpackPaths.srcMainPath, 'videoPreload.ts'),
  },

  output: {
    path: webpackPaths.dllPath,
    filename: '[name].js',
  },

  plugins: [
    /**
     * Keep the last working bridge when a watched source update is momentarily
     * incomplete. Git updates and multi-file saves can make `api.ts` visible a
     * few milliseconds before a newly imported module; webpack otherwise emits
     * a bundle containing `webpackMissingModule()`, and the next Electron reload
     * loses `window.electron` entirely. The compile error still stays visible in
     * the terminal, but it can no longer replace a usable preload on disk.
     */
    new webpack.NoEmitOnErrorsPlugin(),

    new BundleAnalyzerPlugin({
      analyzerMode: process.env.ANALYZE === 'true' ? 'server' : 'disabled',
    }),

    /**
     * Create global constants which can be configured at compile time.
     *
     * Useful for allowing different behaviour between development builds and
     * release builds
     *
     * NODE_ENV should be production so that modules do not perform certain
     * development checks
     *
     * By default, use 'development' as NODE_ENV. This can be overriden with
     * 'staging', for example, by changing the ENV variables in the npm scripts
     */
    new webpack.EnvironmentPlugin({
      NODE_ENV: 'development',
    }),

    new webpack.LoaderOptionsPlugin({
      debug: true,
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

  watch: true,
};

export default merge(baseConfig, configuration);
