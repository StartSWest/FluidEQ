/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later

@jest-environment node
*/

/**
 * How long each scene was drawn, kept per account and day on this computer
 * until the server has been told (premium 0047): what is pending, what a
 * landed report marks, what a day is capped at and how long days are kept.
 */

import fs from 'fs';
import os from 'os';
import path from 'path';
import { createScenePlayLedger } from '../../../main/usage/scenePlayLedger';

const DAY_MS = 24 * 60 * 60 * 1000;
const NOON = new Date(2026, 9, 13, 12).getTime();
const ME = '4f1c2b9e-8d3a-4e7b-9c11-2a6f0d5e7b30';
const OTHER = '9a8b7c6d-5e4f-4a3b-8c2d-1e0f9a8b7c6d';

let dir: string;
let now: number;

beforeEach(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'scene-plays-'));
  now = NOON;
});

afterEach(() => {
  fs.rmSync(dir, { recursive: true, force: true });
});

const ledger = () =>
  createScenePlayLedger({ userDataDir: dir, now: () => now });

describe('the scene play ledger', () => {
  it('adds seconds per scene and day, and sends whole seconds', () => {
    const plays = ledger();
    plays.accrue(ME, { sceneId: 'alpine' }, 59.6);
    plays.accrue(ME, { sceneId: 'alpine' }, 0.6);
    plays.accrue(ME, { authorId: OTHER, sceneId: 'lava-lamp' }, 30);
    expect(plays.pending(ME)).toEqual([
      {
        day: '2026-10-13',
        plays: [
          { sceneId: 'alpine', seconds: 60 },
          { authorId: OTHER, sceneId: 'lava-lamp', seconds: 30 },
        ],
      },
    ]);
  });

  it('keeps each account’s scenes apart', () => {
    const plays = ledger();
    plays.accrue(ME, { sceneId: 'alpine' }, 60);
    expect(plays.pending(OTHER)).toEqual([]);
  });

  it('sends only what was added since the last report landed', () => {
    const plays = ledger();
    plays.accrue(ME, { sceneId: 'alpine' }, 60);
    const [day] = plays.pending(ME);
    plays.markUploaded(ME, day);
    expect(plays.pending(ME)).toEqual([]);
    plays.accrue(ME, { sceneId: 'alpine' }, 15);
    expect(plays.pending(ME)[0]?.plays).toEqual([
      { sceneId: 'alpine', seconds: 15 },
    ]);
  });

  it('caps a scene’s day where the server does', () => {
    const plays = ledger();
    plays.accrue(ME, { sceneId: 'alpine' }, 20 * 60 * 60);
    expect(plays.pending(ME)[0]?.plays[0]?.seconds).toBe(16 * 60 * 60);
  });

  it('survives a restart, oldest day first, and forgets days past the fortnight', () => {
    const first = ledger();
    first.accrue(ME, { sceneId: 'alpine' }, 60);
    now = NOON + DAY_MS;
    first.accrue(ME, { sceneId: 'aurora' }, 60);
    expect(
      ledger()
        .pending(ME)
        .map((entry) => entry.day),
    ).toEqual(['2026-10-13', '2026-10-14']);
    now = NOON + 20 * DAY_MS;
    expect(ledger().pending(ME)).toEqual([]);
  });

  it('ignores nothing but garbage in the file', () => {
    fs.writeFileSync(
      path.join(dir, 'scene-plays.json'),
      JSON.stringify({
        [ME]: {
          '2026-10-13': {
            '/alpine': { seconds: 30, uploaded: 0 },
            'not a scene': { seconds: 30, uploaded: 0 },
            '/aurora': { seconds: 'lots', uploaded: 0 },
          },
        },
      }),
    );
    expect(ledger().pending(ME)).toEqual([
      { day: '2026-10-13', plays: [{ sceneId: 'alpine', seconds: 30 }] },
    ]);
  });
});
