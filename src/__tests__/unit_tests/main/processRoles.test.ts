/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * Every program the native build makes and the app starts has a row in the
 * Processes list.
 *
 * The list finds the app's own programs by asking Windows which processes it
 * started, and one it has no role for is left out — its memory missing from
 * the total the list is opened to read. The system volume, game detection and
 * shared-audio playback helpers all shipped that way, so this reads the
 * build's own list of programs rather than trusting somebody to remember.
 */
import { readdirSync, readFileSync } from 'fs';
import { join } from 'path';
import { EXECUTABLE_ROLES, roleForExecutable } from 'main/processRoles';

const NATIVE = join(__dirname, '../../../../native');

/**
 * Built there, never listed: the engine is a DLL that Windows' audio service
 * loads, and the setup helper runs for a moment at a time, which the role
 * table leaves out on purpose.
 */
const NOT_LISTED = new Set(['FluidEQ-Engine', 'FluidEQ-Engine-Setup']);

/** Every CMakeLists.txt of ours, skipping build output and fetched sources. */
const cmakeFiles = (dir: string): string[] =>
  readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    if (entry.isDirectory()) {
      return entry.name.startsWith('.') || entry.name === '_deps'
        ? []
        : cmakeFiles(join(dir, entry.name));
    }
    return entry.name === 'CMakeLists.txt' ? [join(dir, entry.name)] : [];
  });

const builtPrograms = cmakeFiles(NATIVE).flatMap((file) =>
  [
    ...readFileSync(file, 'utf8').matchAll(/OUTPUT_NAME\s+"(FluidEQ-[^"]+)"/g),
  ].map((match) => match[1]),
);

describe('the Processes list and the programs the app ships', () => {
  it('reads the build’s programs', () => {
    // The control: without it an empty scan passes every check below.
    expect(builtPrograms).toEqual(
      expect.arrayContaining(['FluidEQ-DSP', 'FluidEQ-Meter']),
    );
  });

  it('names every program the app starts', () => {
    const unnamed = builtPrograms.filter(
      (name) =>
        !NOT_LISTED.has(name) &&
        roleForExecutable(`${name}.exe`, 'FluidEQ.exe') === undefined,
    );
    expect(unnamed).toEqual([]);
  });

  it('names no program the build no longer makes', () => {
    const built = new Set(
      builtPrograms.map((name) => `${name.toLowerCase()}.exe`),
    );
    // Windows' own PowerShell is the one program in the table not ours.
    const stale = Object.keys(EXECUTABLE_ROLES).filter(
      (executable) => executable !== 'powershell.exe' && !built.has(executable),
    );
    expect(stale).toEqual([]);
  });

  it('gives the three helpers of this release their own rows', () => {
    expect(roleForExecutable('FluidEQ-Volume.exe', 'FluidEQ.exe')).toBe(
      'volume',
    );
    expect(roleForExecutable('FluidEQ-Games.exe', 'FluidEQ.exe')).toBe('games');
    expect(roleForExecutable('FluidEQ-LAN-Playback.exe', 'FluidEQ.exe')).toBe(
      'sharePlayback',
    );
  });
});
