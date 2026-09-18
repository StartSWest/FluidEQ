/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * The shape check on a path the window named.
 *
 * What it is for is one thing: `stat` on `\\host\share` makes Windows open an
 * SMB connection to that host and authenticate as the logged-in user, so a
 * path that arrived over IPC could post this person's username and an NTLMv2
 * hash to a machine of the caller's choosing. Two channels take a path in
 * from the window — the Library's dropped folders and the Karaoke session's
 * remembered files — and both ask the filesystem about it.
 */

import { isLocalRendererPath } from '../../../main/rendererPaths';

// The control: ordinary paths, of the shapes the two callers really see.
it.each([
  'C:\\Users\\someone\\Music\\song.mp3',
  'C:/Users/someone/Music/song.mp3',
  '/home/someone/Music/song.mp3',
  'D:\\',
  // Extended-length, which is a LOCAL drive however it is spelled.
  '\\\\?\\C:\\Users\\someone\\Music\\song.mp3',
])('lets main look at %s', (value) => {
  expect(isLocalRendererPath(value)).toBe(true);
});

it.each([
  ['a share', '\\\\attacker.example\\share\\song.mp3'],
  ['a share with forward slashes', '//attacker.example/share/song.mp3'],
  ['a mixed spelling', '\\/attacker.example\\share'],
  ['the extended-length share spelling', '\\\\?\\UNC\\attacker.example\\share'],
  ['its lowercase spelling', '\\\\?\\unc\\attacker.example\\share'],
  ['a bare host', '\\\\attacker.example'],
])('refuses %s before the filesystem is asked', (_name, value) => {
  expect(isLocalRendererPath(value)).toBe(false);
});

it('refuses what is not a usable path at all', () => {
  expect(isLocalRendererPath('')).toBe(false);
  expect(isLocalRendererPath(42)).toBe(false);
  expect(isLocalRendererPath(undefined)).toBe(false);
  expect(isLocalRendererPath(null)).toBe(false);
  // A NUL truncates the name every layer below this one sees, so the path
  // checked and the path opened would not be the same path.
  expect(isLocalRendererPath('C:\\Users\\someone\\song.mp3\0.txt')).toBe(false);
  expect(isLocalRendererPath(`C:\\${'x'.repeat(4096)}`)).toBe(false);
});
