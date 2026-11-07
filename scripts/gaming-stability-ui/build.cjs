/*
Copyright (C) 2026 Ivan Carmenates Garcia
SPDX-License-Identifier: GPL-3.0-or-later
*/
const fs = require('fs');
const path = require('path');
const webpack = require('webpack');

const root = path.resolve(__dirname, '../..');
process.env.NODE_ENV = 'development';
const output = path.join(root, 'outputs/gaming-stability-ui/dist');
fs.mkdirSync(output, { recursive: true });
const bootstrap = path.join(output, 'bootstrap.js');
fs.writeFileSync(
  bootstrap,
  'window.process={env:{}};window.electron={ipcRenderer:{sendMessage(){},on(){return ()=>{}},once(){},invoke:async()=>undefined}};',
);
webpack(
  {
    mode: 'development',
    target: 'web',
    devtool: false,
    entry: [bootstrap, path.join(__dirname, 'index.tsx')],
    output: { path: output, filename: 'harness.js' },
    resolve: {
      extensions: ['.tsx', '.ts', '.js'],
      modules: [path.join(root, 'src'), 'node_modules'],
    },
    plugins: [
      new webpack.DefinePlugin({
        'process.env': '{}',
        'process.platform': JSON.stringify('win32'),
      }),
    ],
    module: {
      rules: [
        {
          test: /\.[jt]sx?$/,
          exclude: /node_modules/,
          use: {
            loader: 'ts-loader',
            options: {
              transpileOnly: true,
              compilerOptions: { module: 'esnext' },
            },
          },
        },
        { test: /\.scss$/, use: ['style-loader', 'css-loader', 'sass-loader'] },
        { test: /\.(png|svg|jpg|woff2?)$/, type: 'asset/resource' },
      ],
    },
    stats: 'errors-warnings',
  },
  (error, stats) => {
    if (error || stats.hasErrors()) {
      process.stderr.write(`${error || stats.toString()}\n`);
      process.exitCode = 1;
      return;
    }
    fs.writeFileSync(
      path.join(output, 'index.html'),
      '<html><meta charset="UTF-8"><div id="root"></div><script src="harness.js"></script></html>',
    );
    process.stdout.write('built\n');
  },
);
