/* Copyright (C) 2026 Ivan Carmenates Garcia. SPDX-License-Identifier: GPL-3.0-or-later */

import path from 'path';
import webpack from 'webpack';
import HtmlWebpackPlugin from 'html-webpack-plugin';
import MiniCssExtractPlugin from 'mini-css-extract-plugin';
import { merge } from 'webpack-merge';
import baseConfig from '../../.erb/configs/webpack.config.base';
import webpackPaths from '../../.erb/configs/webpack.paths';
import PUBLIC_ENV_DEFAULTS from '../../.erb/configs/public-env';
import BUILT from './built';

/**
 * The stills' page (`harness/index.tsx`), built for a browser through the
 * app's own loaders, as the gallery's ground is
 * (`scripts/gallery-ground/webpack.config.ts`). Its stats name every module
 * the drawing is made of, which is what the stills' freshness is hashed
 * over (`generate.ts`).
 */

const configuration: webpack.Configuration = {
  mode: 'production',
  target: 'web',
  devtool: false,
  entry: { stills: path.join(__dirname, 'harness', 'index.tsx') },
  output: { path: BUILT, publicPath: './', filename: '[name].js' },
  resolve: {
    conditionNames: ['browser', 'import', 'module', 'default'],
    alias: {
      main: webpackPaths.srcMainPath,
      renderer: webpackPaths.srcRendererPath,
    },
    fallback: { fs: false, path: false, os: false, crypto: false },
  },
  module: {
    rules: [
      {
        test: /\.s?(a|c)ss$/,
        use: [MiniCssExtractPlugin.loader, 'css-loader', 'sass-loader'],
      },
      { test: /\.(woff|woff2|eot|ttf|otf)$/i, type: 'asset/resource' },
      { test: /\.(png|svg|jpg|jpeg|gif|webp)$/i, type: 'asset/resource' },
      { test: /\.(md|vtt)$/i, type: 'asset/source' },
      {
        test: /\.(mp4|webm|wav|mp3|ogg|wasm|onnx|glb|worklet)$/i,
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
      templateContent:
        '<!doctype html><html lang="en"><head><meta charset="utf-8"><title>Look stills</title></head><body></body></html>',
    }),
  ],
};

const merged = merge(baseConfig, configuration);
// The base config makes the packaged app's native dependencies external;
// a browser has none of them. Nor does a page export anything, which the
// base config's CommonJS library would try to.
merged.externals = [];
if (merged.output) {
  delete merged.output.library;
}
// Every module, the concatenated ones' insides too: what the stills are
// drawn from is read off this list.
merged.stats = {
  all: false,
  errors: true,
  warnings: true,
  modules: true,
  nestedModules: true,
  modulesSpace: Infinity,
  nestedModulesSpace: Infinity,
};

export default merged;
