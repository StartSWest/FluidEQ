/** @jest-environment node */
/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * The installer writes the engine choice where the installed app reads it.
 *
 * Two languages and two build systems decide that folder: Electron names the
 * app's data folder after `release/app/package.json`, and `installer.nsh`
 * spells a path of its own. They disagreed — setup wrote to %APPDATA%\FluidEQ,
 * the installed app lived in %APPDATA%\fluideq-app — so a user who picked the
 * FluidEQ Engine in setup got the engine installed and the app running on
 * Equalizer APO. Nothing failed loudly; only this can catch it.
 */

import fs from 'fs';
import os from 'os';
import path from 'path';
import { AUDIO_ENGINE_FILENAME } from '../../../common/audioEngine';
import { loadAudioEnginePreference } from '../../../main/audioEngineStore';

const ROOT = path.join(__dirname, '../../../..');
const INSTALLER = fs.readFileSync(
  path.join(ROOT, 'assets/nsis/installer.nsh'),
  'utf8',
);
const APP_PACKAGE: Record<string, unknown> = JSON.parse(
  fs.readFileSync(path.join(ROOT, 'release/app/package.json'), 'utf8'),
);

/** Instructions only: comments explain the old folder and are allowed to. */
const code = INSTALLER.split(/\r?\n/)
  .filter((line) => !line.trimStart().startsWith(';'))
  .join('\n');

/** An NSIS define reference, `${name}`, spelled without a template string. */
const define = (name: string) => ['$', '{', name, '}'].join('');

describe('where setup writes what the installed app reads', () => {
  it('names the app by its package name, which is the folder Electron uses', () => {
    // Electron prefers `productName` over `name` for the data folder. One
    // added here would move the app's folder while electron-builder's
    // APP_PACKAGE_NAME, which setup writes into, stays the package name.
    expect(typeof APP_PACKAGE.name).toBe('string');
    expect(APP_PACKAGE).not.toHaveProperty('productName');
  });

  it('builds its data folder from the package name electron-builder passes in', () => {
    expect(code).toContain(
      `!define FLUIDEQ_DATA "$APPDATA\\${define('APP_PACKAGE_NAME')}"`,
    );
  });

  it('never writes into a folder spelled out by hand', () => {
    // Positive control: the instructions do reach %APPDATA%, through the one
    // definition, so an empty match below is not an empty file.
    expect(code).toMatch(/\$APPDATA/);
    expect(code.match(/\$APPDATA\\[^$"]/g)).toEqual(null);
  });

  it('keeps the engine choice and the install log in that folder', () => {
    const choice = `${define('FLUIDEQ_DATA')}\\${AUDIO_ENGINE_FILENAME}`;
    // Written by setup, checked before the page is shown, removed on uninstall.
    expect(code.split(choice).length - 1).toBe(4);
    expect(code).toContain(`${define('FLUIDEQ_DATA')}\\logs\\install.log`);
  });

  it('writes a choice the app reads back', () => {
    const template = /FileWrite \$9 '(\{[^']*\})'/.exec(code)?.[1];
    expect(template).toBeDefined();
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'fluideq-setup-'));
    try {
      fs.writeFileSync(
        path.join(directory, AUDIO_ENGINE_FILENAME),
        (template ?? '').replace(define('Engine'), 'fluid'),
      );
      expect(loadAudioEnginePreference(directory)).toEqual({
        version: 1,
        engine: 'fluid',
      });
    } finally {
      fs.rmSync(directory, { recursive: true, force: true });
    }
  });
});
