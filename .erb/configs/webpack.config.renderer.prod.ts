/**
 * Build config for electron renderer process
 */

import path from 'path';
import webpack from 'webpack';
import HtmlWebpackPlugin from 'html-webpack-plugin';
import MiniCssExtractPlugin from 'mini-css-extract-plugin';
import { BundleAnalyzerPlugin } from 'webpack-bundle-analyzer';
import CssMinimizerPlugin from 'css-minimizer-webpack-plugin';
import { merge } from 'webpack-merge';
import TerserPlugin from 'terser-webpack-plugin';
import baseConfig from './webpack.config.base';
import webpackPaths from './webpack.paths';
import checkNodeEnv from '../scripts/check-node-env';
import deleteSourceMaps from '../scripts/delete-source-maps';
import PUBLIC_ENV_DEFAULTS from './public-env';

checkNodeEnv('production');
deleteSourceMaps();

const devtoolsConfig =
  process.env.DEBUG_PROD === 'true'
    ? {
        devtool: 'source-map',
      }
    : {};

const configuration: webpack.Configuration = {
  ...devtoolsConfig,

  mode: 'production',

  target: ['web', 'electron-renderer'],

  // Karaoke's lazy Transformers.js import must resolve its browser/WASM
  // export even though the rest of this renderer also targets Electron.
  resolve: {
    conditionNames: ['browser', 'import', 'module', 'default'],
    alias: {
      '@fluideq/whisper-wasm': path.resolve(
        webpackPaths.rootPath,
        'node_modules/@huggingface/transformers/dist/ort-wasm-simd-threaded.jsep.wasm',
      ),
      '@fluideq/whisper-runtime': path.resolve(
        webpackPaths.rootPath,
        'node_modules/@huggingface/transformers/dist/ort-wasm-simd-threaded.jsep.mjs',
      ),
    },
  },

  entry: {
    renderer: path.join(webpackPaths.srcRendererPath, 'index.tsx'),
    'karaoke-whisper-worker': path.join(
      webpackPaths.srcRendererPath,
      'karaoke/whisper.worker.ts',
    ),
    'karaoke-separation-worker': path.join(
      webpackPaths.srcRendererPath,
      'karaoke/separation.worker.ts',
    ),
  },

  output: {
    path: webpackPaths.distRendererPath,
    publicPath: './',
    filename: '[name].js',
    library: {
      type: 'umd',
    },
  },

  module: {
    rules: [
      // d3 is NOT marked side-effect free, and the missing rule here is the
      // point.
      //
      // It was marked so once, on the reasoning that its submodules are pure
      // function exports. That is true of most of them and false of the one
      // that matters: `d3-transition` does its work by attaching `transition`
      // and `interrupt` to `selection.prototype` when it is evaluated, and
      // nothing imports either by name. Told the package had no side effects,
      // webpack correctly concluded nothing referenced it and dropped it — and
      // every `.transition()` in the graph became "e.transition is not a
      // function" the moment a chart tried to draw. It shipped.
      //
      // The rule is not worth repairing. Measured on its own it saved 567
      // bytes; the 44% the renderer actually lost came from emitting ESM in
      // ts-loader so webpack could see the import graph at all, which is
      // untouched and does its work without anyone having to assert anything
      // about a library's internals.
      {
        test: /\.s?(a|c)ss$/,
        use: [
          MiniCssExtractPlugin.loader,
          {
            loader: 'css-loader',
            options: {
              modules: true,
              sourceMap: true,
              importLoaders: 1,
            },
          },
          'sass-loader',
        ],
        include: /\.module\.s?(c|a)ss$/,
      },
      {
        test: /\.s?(a|c)ss$/,
        use: [MiniCssExtractPlugin.loader, 'css-loader', 'sass-loader'],
        exclude: /\.module\.s?(c|a)ss$/,
      },
      // Fonts
      {
        test: /\.(woff|woff2|eot|ttf|otf)$/i,
        type: 'asset/resource',
      },
      // Images
      {
        test: /\.(png|svg|jpg|jpeg|gif)$/i,
        type: 'asset/resource',
      },
      // Standalone JavaScript fetched by AudioWorklet.addModule. Keeping the
      // source outside the renderer bundle also keeps realtime DSP off the UI
      // thread; the .js output name gives Chromium the expected module type.
      {
        test: /\.worklet$/i,
        type: 'asset/resource',
        generator: { filename: '[name].js' },
      },
      // Basic Pitch's TensorFlow graph references its binary shard by a
      // relative URL. Emit both under one stable folder so that relationship
      // survives development and packaged builds.
      {
        test: /\.(json|bin)$/i,
        resourceQuery: /url/,
        type: 'asset/resource',
        generator: { filename: 'karaoke-models/basic-pitch/[name][ext]' },
      },
      {
        // ONNX Runtime dynamically imports this MJS bootstrap and then loads
        // the matching WASM binary. A packaged build needs both local files.
        // Both Karaoke workers land here, which is only safe because
        // `onnxruntime-web` is pinned in package.json to the exact build
        // @huggingface/transformers depends on. Two versions ship these same
        // basenames with different content and webpack fails outright.
        test: /ort-wasm-simd-threaded\.jsep\.(?:mjs|wasm)$/i,
        type: 'asset/resource',
        generator: { filename: 'karaoke-models/whisper/[name][ext]' },
      },
    ],
  },

  optimization: {
    minimize: true,
    minimizer: [
      new TerserPlugin({
        parallel: true,
      }),
      new CssMinimizerPlugin(),
    ],
  },

  plugins: [
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
      ...PUBLIC_ENV_DEFAULTS,
    }),

    new MiniCssExtractPlugin({
      filename: 'style.css',
    }),

    new BundleAnalyzerPlugin({
      analyzerMode: process.env.ANALYZE === 'true' ? 'server' : 'disabled',
    }),

    new HtmlWebpackPlugin({
      filename: 'index.html',
      template: path.join(webpackPaths.srcRendererPath, 'index.ejs'),
      minify: {
        collapseWhitespace: true,
        removeAttributeQuotes: true,
        removeComments: true,
      },
      isBrowser: false,
      isDevelopment: process.env.NODE_ENV !== 'production',
      chunks: ['renderer'],
    }),
  ],
};

export default merge(baseConfig, configuration);
