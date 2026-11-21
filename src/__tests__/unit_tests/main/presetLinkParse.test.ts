/*
Copyright (C) 2026 Ivan Carmenates Garcia. SPDX-License-Identifier: GPL-3.0-or-later

@jest-environment node
*/

/**
 * `fluideq://preset/<id>` is the one thing a web page can hand FluidEQ about
 * a preset, and the whole address must be exactly that: the scheme, the host
 * `preset`, and eight letters or digits (Ivan, 2026-11-20: "no hacker or
 * virus can hack this or inject things"). Everything else that names a
 * preset link is dropped with a line in the log, before any URL parser can
 * normalise it into something that would pass.
 */

import log from 'electron-log';
import { presetLinkIdOf, presetLinkInArgs } from '../../../main/presetLinks';
import {
  findSharedPresetId,
  sharedPresetIdOfAppLink,
} from '../../../common/presetShare/sharedPresetLink';

jest.mock('electron', () => ({
  app: { on: jest.fn() },
  ipcMain: { handle: jest.fn() },
}));
jest.mock('electron-log', () => ({ warn: jest.fn(), info: jest.fn() }));

const ID = 'Ab3dE6gH';

const HOSTILE = [
  // More path, a query, a fragment, a trailing slash.
  `fluideq://preset/${ID}/x`,
  `fluideq://preset/${ID}/`,
  `fluideq://preset/${ID}?code=FQP1.abcdefgh`,
  `fluideq://preset/${ID}#x`,
  `fluideq://preset/${ID}/../../credits/paid`,
  // Another host, a host that only starts like it, credentials, a port.
  `fluideq://evil/${ID}`,
  `fluideq://preset.evil.example/${ID}`,
  `fluideq://user@preset/${ID}`,
  `fluideq://preset:80/${ID}`,
  // The wrong length.
  `fluideq://preset/${ID}9`,
  `fluideq://preset/${ID.slice(0, 7)}`,
  `fluideq://preset/${'A'.repeat(5000)}`,
  // Percent-encoding, unicode look-alikes, invisible and control characters.
  `fluideq://preset/%41b3dE6gH`,
  `fluideq://preset/Ab3dE6g\uFF28`,
  `fluideq://preset/Ab3dE6g\u0410`,
  `fluideq://preset/Ab3d\u200BE6gH`,
  `fluideq://preset/${ID}\n`,
  `fluideq://preset/${ID}\u0000`,
  ` fluideq://preset/${ID}`,
  // The old form that carried the whole code, and another scheme's look.
  'fluideq://preset/FQP1.abcdefghijklmnop',
  `FLUIDEQ://PRESET/${ID}`,
  `fluideq:preset/${ID}`,
  `fluideq:///preset/${ID}`,
  `https://fluideq.com/p/${ID}`,
  `javascript:alert(1)//fluideq://preset/${ID}`,
];

describe('a preset link from a page', () => {
  it('is read when the whole address is exactly fluideq://preset/<id>', () => {
    expect(presetLinkIdOf(`fluideq://preset/${ID}`)).toBe(ID);
    expect(sharedPresetIdOfAppLink(`fluideq://preset/${ID}`)).toBe(ID);
  });

  it.each(HOSTILE)('drops %j', (address) => {
    expect(presetLinkIdOf(address)).toBeUndefined();
  });

  it('takes the first exact link among a launch arguments and logs the rest', () => {
    jest.mocked(log.warn).mockClear();
    const argv = [
      'C:/Program Files/FluidEQ/FluidEQ.exe',
      '--start-in-tray',
      `fluideq://preset/${ID}/../x`,
      `fluideq://preset/${ID}`,
      'fluideq://preset/Zz9Yy8Xx',
    ];
    expect(presetLinkInArgs(argv)).toBe(ID);
    expect(log.warn).toHaveBeenCalledTimes(1);
    // The log line is bounded and quoted, so a hostile argument cannot write
    // lines of its own into the log.
    const line = String(jest.mocked(log.warn).mock.calls[0][0]);
    expect(line).not.toContain('\n');
  });

  it('logs a hostile argument without its newlines and cuts it short', () => {
    jest.mocked(log.warn).mockClear();
    expect(
      presetLinkInArgs([`fluideq://preset/x\nFAKE LOG LINE${'a'.repeat(500)}`]),
    ).toBeUndefined();
    const line = String(jest.mocked(log.warn).mock.calls[0][0]);
    expect(line).not.toContain('\n');
    expect(line.length).toBeLessThan(200);
  });

  it('leaves the other fluideq:// links alone and unlogged', () => {
    jest.mocked(log.warn).mockClear();
    expect(presetLinkInArgs(['fluideq://credits/paid'])).toBeUndefined();
    expect(log.warn).not.toHaveBeenCalled();
  });
});

describe('a short link inside pasted text', () => {
  it.each([
    [`Try this https://fluideq.com/p/${ID} !`, ID],
    [`(https://www.fluideq.com/p/${ID})`, ID],
    [`https://fluideq.com/es/p/${ID}`, ID],
    [`https://fluideq.com/zh-Hant/p/${ID}`, ID],
    [`open fluideq://preset/${ID}.`, ID],
  ])('finds the id in %j', (text, id) => {
    expect(findSharedPresetId(text)).toBe(id);
  });

  it.each([
    `https://fluideq.com/p/${ID}9`,
    `https://fluideq.com.evil.example/p/${ID}`,
    `https://evil.example/fluideq.com/p/${ID}`,
    `https://fluideq.com/p/${ID.slice(0, 7)}`,
    'https://fluideq.com/p#FQP1.abcdefgh',
  ])('finds no id in %j', (text) => {
    expect(findSharedPresetId(text)).toBeUndefined();
  });
});
