/* Copyright (C) 2026 Ivan Carmenates Garcia. SPDX-License-Identifier: GPL-3.0-or-later */

import { spawnSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import BUILT from './built';

/**
 * What both scripts here share: the harness's build (`webpack.config.ts`)
 * and the way they write what they take — beside the target and renamed into
 * place, the way every file the app writes is.
 */

export const ROOT = path.resolve(__dirname, '../..');

export const writeAtomically = (file: string, bytes: string | Buffer) => {
  const temporary = `${file}.${process.pid}.tmp`;
  fs.writeFileSync(temporary, bytes);
  fs.renameSync(temporary, file);
};

export const buildHarness = () => {
  // Emptied here rather than by either compiler, which share the folder.
  fs.rmSync(BUILT, { recursive: true, force: true });
  const built = spawnSync(
    'pnpm',
    ['exec', 'webpack', '--config', path.join(__dirname, 'webpack.config.ts')],
    {
      cwd: ROOT,
      stdio: 'inherit',
      shell: process.platform === 'win32',
      env: {
        ...process.env,
        NODE_ENV: 'production',
        TS_NODE_TRANSPILE_ONLY: 'true',
      },
    },
  );
  if (built.status !== 0) {
    throw new Error('The harness did not build.');
  }
};
