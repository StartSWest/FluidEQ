/* Copyright (C) 2026 Ivan Carmenates Garcia. SPDX-License-Identifier: GPL-3.0-or-later */
/** @jest-environment node */

import fs from 'fs';
import path from 'path';
import type webpack from 'webpack';
import devConfigs from '../../../../.erb/configs/webpack.config.preload.dev';

/** The programs main starts in Node: utility processes and workers. */
const NODE_PROGRAMS = [
  'share-audio-worker',
  'inference-worker',
  'library-scan-worker',
];

const entriesOf = (config: webpack.Configuration) =>
  Object.keys((config.entry ?? {}) as Record<string, unknown>);

// Built with the preloads in development, Share Audio's service took `ws`'s
// browser stand-in and its local link could never start, while the packaged
// app, built for Node, worked (Ivan's log, 2026-10-29).
it('builds the Node programs for Node in development, as the packaged build does', () => {
  const configs = devConfigs as unknown as webpack.Configuration[];
  expect(Array.isArray(configs)).toBe(true);
  const forNode = configs.filter((config) => config.target === 'electron-main');
  const forPreload = configs.filter(
    (config) => config.target === 'electron-preload',
  );
  expect(forNode.flatMap(entriesOf).sort()).toEqual([...NODE_PROGRAMS].sort());
  NODE_PROGRAMS.forEach((name) =>
    expect(forPreload.flatMap(entriesOf)).not.toContain(name),
  );
  // The control: production builds the same programs for the same target.
  // Read as text: loading it exits any process not set to production.
  const prod = fs.readFileSync(
    path.join(process.cwd(), '.erb/configs/webpack.config.main.prod.ts'),
    'utf8',
  );
  expect(prod).toMatch(/target: 'electron-main'/);
  NODE_PROGRAMS.forEach((name) => expect(prod).toContain(`'${name}'`));
});
