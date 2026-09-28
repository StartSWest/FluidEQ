/** @jest-environment node */
/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * Every EQ edit read the engine's `config.txt` from disk, synchronously, to
 * find a line written once per install. Counted here in reads of that file.
 */

import fs from 'fs';
import os from 'os';
import path from 'path';
import { createConfigInclude } from 'main/configInclude';

let configDir: string;
let reads: jest.SpyInstance;

const configFile = () => path.join(configDir, 'config.txt');
const configReads = () =>
  reads.mock.calls.filter(([file]) => String(file) === configFile()).length;

beforeEach(() => {
  configDir = fs.mkdtempSync(path.join(os.tmpdir(), 'fluideq-config-include-'));
  fs.writeFileSync(configFile(), 'Include: fluideq.txt\n', 'utf8');
  reads = jest.spyOn(fs, 'readFileSync');
});

afterEach(() => {
  reads.mockRestore();
  fs.rmSync(configDir, { recursive: true, force: true });
});

it('reads config.txt once for every edit made while its folder is watched', async () => {
  const include = createConfigInclude(() => true);

  for (let edit = 0; edit < 20; edit += 1) {
    // eslint-disable-next-line no-await-in-loop -- twenty edits one after another, as a drag makes them
    await include.ensure(configDir);
  }

  expect(configReads()).toBe(1);
});

it('reads it on every edit while nobody is watching its folder', async () => {
  const include = createConfigInclude(() => false);

  await include.ensure(configDir);
  await include.ensure(configDir);
  await include.ensure(configDir);

  expect(configReads()).toBe(3);
});

it('reads it again once the watcher reports it, and puts back an include somebody took out', async () => {
  const include = createConfigInclude(() => true);
  await include.ensure(configDir);
  fs.writeFileSync(configFile(), 'Include: somebody-else.txt\n', 'utf8');

  await include.ensure(configDir);
  expect(configReads()).toBe(1);

  include.forget();
  await include.ensure(configDir);
  // The check, then the rewrite reading what it keeps.
  expect(configReads()).toBe(3);
  expect(fs.readFileSync(configFile(), 'utf8')).toBe(
    'Include: somebody-else.txt\nInclude: fluideq.txt\n',
  );
});

it('reads the new folder after an engine switch', async () => {
  const include = createConfigInclude(() => true);
  await include.ensure(configDir);
  const other = fs.mkdtempSync(path.join(os.tmpdir(), 'fluideq-config-other-'));
  try {
    fs.writeFileSync(path.join(other, 'config.txt'), '', 'utf8');

    await include.ensure(other);

    expect(fs.readFileSync(path.join(other, 'config.txt'), 'utf8')).toBe(
      '\nInclude: fluideq.txt\n',
    );
  } finally {
    fs.rmSync(other, { recursive: true, force: true });
  }
});
