/* Copyright (C) 2026 Ivan Carmenates Garcia. SPDX-License-Identifier: GPL-3.0-or-later */

import path from 'path';
import webpack from 'webpack';
import HtmlWebpackPlugin from 'html-webpack-plugin';
import MiniCssExtractPlugin from 'mini-css-extract-plugin';
import { merge } from 'webpack-merge';
import baseConfig from '../../.erb/configs/webpack.config.base';
import webpackPaths from '../../.erb/configs/webpack.paths';
import PUBLIC_ENV_DEFAULTS from '../../.erb/configs/public-env';
import { dspWorkletConfig } from '../../.erb/configs/webpack.dspWorklet';
import BUILT from './built';

/**
 * The window, built for a browser: the app's own renderer and stylesheets
 * through the app's own loaders (`webpack.config.base.ts` and the rules the
 * production renderer uses), with `electron` answered by `fakeElectron.ts` so
 * the real preload and its bridges run unchanged. Built into `BUILT`.
 */

const HERE = __dirname;

const configuration: webpack.Configuration = {
  mode: 'production',
  target: 'web',
  devtool: false,
  entry: { harness: path.join(HERE, 'harness', 'index.ts') },
  output: {
    path: BUILT,
    publicPath: './',
    filename: '[name].js',
    library: { type: 'umd' },
  },
  resolve: {
    conditionNames: ['browser', 'import', 'module', 'default'],
    alias: {
      electron: path.join(HERE, 'harness', 'fakeElectron.ts'),
      main: webpackPaths.srcMainPath,
      renderer: webpackPaths.srcRendererPath,
    },
    fallback: {
      fs: false,
      path: false,
      os: false,
      crypto: false,
      child_process: false,
      worker_threads: false,
      stream: false,
      util: false,
      buffer: false,
      events: false,
      url: false,
    },
  },
  module: {
    rules: [
      {
        test: /\.s?(a|c)ss$/,
        use: [
          MiniCssExtractPlugin.loader,
          {
            loader: 'css-loader',
            options: { modules: true, importLoaders: 1 },
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
      { test: /\.(woff|woff2|eot|ttf|otf)$/i, type: 'asset/resource' },
      { test: /\.(png|svg|jpg|jpeg|gif)$/i, type: 'asset/resource' },
      { test: /\.worklet$/i, type: 'asset/resource' },
      {
        test: /\.(json|bin)$/i,
        resourceQuery: /url/,
        type: 'asset/resource',
      },
      {
        test: /\.(?:wasm|onnx|glb|vtt|mp3|wav|ogg)$/i,
        type: 'asset/resource',
      },
    ],
  },
  optimization: { minimize: false },
  performance: { hints: false },
  plugins: [
    new webpack.EnvironmentPlugin({
      NODE_ENV: 'production',
      DEBUG_PROD: false,
      ...PUBLIC_ENV_DEFAULTS,
    }),
    new MiniCssExtractPlugin({ filename: '[name].css' }),
    new HtmlWebpackPlugin({
      filename: 'index.html',
      template: path.join(HERE, 'harness', 'index.html'),
      chunks: ['harness'],
    }),
  ],
};

// The base config makes the packaged app's native dependencies external;
// the browser has none of them, and nothing the captures draw reaches one.
const merged = merge(baseConfig, configuration);
// `merge` appends arrays; the base config's externals have to go, not grow.
merged.externals = [];

// The worklets and workers the window loads by URL beside its page — the
// audio clock the live graph runs on among them — built as the app builds
// them, into the same folder.
const workers = dspWorkletConfig(false);

export default [
  merged,
  { ...workers, output: { ...workers.output, path: BUILT } },
];
