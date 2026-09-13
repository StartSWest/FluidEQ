/** @jest-environment node */
/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import fs from 'fs';
import os from 'os';
import path from 'path';

const handlers = new Map<string, (...args: unknown[]) => unknown>();
jest.mock('electron', () => ({
  ipcMain: {
    handle: (channel: string, fn: (...args: unknown[]) => unknown) =>
      handlers.set(channel, fn),
    removeHandler: (channel: string) => handlers.delete(channel),
  },
}));

/* eslint-disable import/first -- the electron mock must be installed first */
import { registerMotionPreferenceIpc } from '../../../main/ipc/motionPreference';
import {
  MOTION_SWITCHES,
  readMotionPreference,
  writeMotionPreference,
} from '../../../main/motionPreference';
/* eslint-enable import/first */

let dir: string;

beforeEach(() => {
  handlers.clear();
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'fluideq-motion-'));
});

afterEach(() => {
  fs.rmSync(dir, { recursive: true, force: true });
});

describe('whether the app animates', () => {
  it('animates unless somebody chose otherwise, whatever Windows says', () => {
    expect(readMotionPreference(dir)).toBe('full');
    expect(MOTION_SWITCHES.full).toBe('force-prefers-no-reduced-motion');
  });

  it('keeps a choice of reduced motion for the next launch, and its switch says so', () => {
    writeMotionPreference(dir, 'reduced');
    expect(readMotionPreference(dir)).toBe('reduced');
    expect(MOTION_SWITCHES.reduced).toBe('force-prefers-reduced-motion');
  });

  it.each([
    ['a damaged file', '{motion'],
    ['a value it does not know', JSON.stringify({ motion: 'sideways' })],
  ])('animates after %s', (_label, text) => {
    fs.writeFileSync(path.join(dir, 'motion.json'), text);
    expect(readMotionPreference(dir)).toBe('full');
  });

  it('tells the menu the saved choice beside the one this launch runs, and ignores nonsense', async () => {
    registerMotionPreferenceIpc({ userDataDir: dir, atLaunch: 'full' });
    const set = handlers.get('motion-preference-set');
    const get = handlers.get('motion-preference-get');
    expect(await get?.({})).toEqual({ chosen: 'full', atLaunch: 'full' });
    expect(await set?.({}, 'reduced')).toEqual({
      chosen: 'reduced',
      atLaunch: 'full',
    });
    expect(await set?.({}, 'fast')).toEqual({
      chosen: 'reduced',
      atLaunch: 'full',
    });
  });
});
