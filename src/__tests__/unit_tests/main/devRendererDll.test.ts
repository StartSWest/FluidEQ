/** @jest-environment node */
/* Copyright (C) 2026 Ivan Carmenates Garcia. SPDX-License-Identifier: GPL-3.0-or-later */

import fs from 'fs';
import os from 'os';
import path from 'path';
import vm from 'vm';
import webpack from 'webpack';
import HtmlWebpackPlugin from 'html-webpack-plugin';
import { rendererDevConfig } from '../../../../.erb/configs/webpack.config.renderer.dev';

const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'fluideq-dev-boot-'));
const previousNodeEnv = process.env.NODE_ENV;
beforeAll(() => {
  process.env.NODE_ENV = 'development';
});

afterAll(() => {
  if (previousNodeEnv === undefined) {
    delete process.env.NODE_ENV;
  } else {
    process.env.NODE_ENV = previousNodeEnv;
  }
  const resolved = path.resolve(directory);
  if (
    path.dirname(resolved) !== path.resolve(os.tmpdir()) ||
    !path.basename(resolved).startsWith('fluideq-dev-boot-')
  ) {
    throw new Error('Refusing to remove a directory outside this test fixture');
  }
  fs.rmSync(resolved, { recursive: true });
});

it('boots React from the development entry in an isolated page without a DLL', async () => {
  const entry = path.join(directory, 'boot.cjs');
  fs.writeFileSync(
    entry,
    "const React = require('react'); document.getElementById('root').textContent = React.createElement('div', null, 'Interface ready').props.children;",
  );
  const source = { ...rendererDevConfig, devServer: undefined };
  const compiler = webpack({
    ...source,
    context: process.cwd(),
    resolve: {
      ...source.resolve,
      modules: [
        path.join(process.cwd(), 'node_modules'),
        ...(source.resolve?.modules ?? []),
      ],
    },
    entry: { renderer: entry, wallpaper: entry },
    devtool: false,
    watch: false,
    cache: false,
    output: { ...source.output, path: directory },
    plugins: source.plugins?.filter(
      (plugin) => plugin?.constructor.name !== 'ReactRefreshPlugin',
    ),
  });
  await new Promise<void>((resolve, reject) => {
    compiler.run((error, stats) => {
      const failure =
        error ?? (stats?.hasErrors() ? new Error(stats.toString()) : undefined);
      compiler.close((closeError) => {
        if (failure || closeError) {
          reject(failure ?? closeError);
        } else {
          resolve();
        }
      });
    });
  });
  expect(
    source.plugins?.some(
      (plugin) => plugin instanceof webpack.DllReferencePlugin,
    ),
  ).toBe(false);

  [
    ['index.html', 'renderer.dev.js'],
    ['wallpaper.html', 'wallpaper.dev.js'],
  ].forEach(([htmlFile, scriptFile]) => {
    const html = fs.readFileSync(path.join(directory, htmlFile), 'utf8');
    const scripts = [
      ...html.matchAll(
        /<script\b[^>]*\bsrc=(?:"([^"]+)"|'([^']+)'|([^\s>]+))/g,
      ),
    ].map((match) => match[1] ?? match[2] ?? match[3]);
    expect(scripts).toEqual([`/${scriptFile}`]);
    const root = { textContent: '' };
    const page = { document: { getElementById: () => root }, self: {} };
    // No Node global, require(), or preloaded renderer variable: Electron's
    // isolated page must boot using only the script its HTML actually loads.
    vm.runInNewContext(
      fs.readFileSync(path.join(directory, scriptFile), 'utf8'),
      page,
    );
    expect(root.textContent).toBe('Interface ready');
  });
});

it('does not put a development-only dependency in the shared HTML templates', () => {
  const plugins = rendererDevConfig.plugins?.filter(
    (plugin): plugin is HtmlWebpackPlugin =>
      plugin instanceof HtmlWebpackPlugin,
  );
  expect(plugins?.map((plugin) => plugin.userOptions.filename).sort()).toEqual([
    'index.html',
    'wallpaper.html',
  ]);
  plugins?.forEach((plugin) => {
    expect(plugin.userOptions.rendererDll).toBeUndefined();
  });
});
