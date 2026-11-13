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
 * The gallery drawing (`harness/index.tsx`), built for a browser through the
 * app's own loaders, as the Help captures build theirs
 * (`scripts/help-captures/webpack.config.ts`). Built into `BUILT`.
 */

const HERE = __dirname;

const configuration: webpack.Configuration = {
  mode: 'production',
  target: 'web',
  devtool: false,
  entry: { ground: path.join(HERE, 'harness', 'index.tsx') },
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
      // Help's figures, whose frame of the tab the drawing borrows, reach the
      // tour's films and the Studio's skills; bundled as the app bundles them
      // (`webpack.config.renderer.prod.ts`).
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
        '<!doctype html><html lang="en"><head><meta charset="utf-8"><title>Gallery</title></head><body><div id="root"></div></body></html>',
    }),
  ],
};

const merged = merge(baseConfig, configuration);
// The base config makes the packaged app's native dependencies external;
// a browser has none of them.
merged.externals = [];

export default merged;
