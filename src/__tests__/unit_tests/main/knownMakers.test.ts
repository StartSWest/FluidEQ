/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/** @jest-environment node */

import fs from 'fs';
import os from 'os';
import path from 'path';
import { isKnownMaker, setKnownMaker } from '../../../main/account/knownMakers';

/**
 * Which accounts on this computer have had a scene approved, which is what
 * keeps one Studio project open to a maker whose earned month has run out.
 *
 * It goes both ways on purpose: a scene taken down or deleted takes the last
 * approval with it, and a bench left open here to somebody the server
 * refuses is the Studio saying one thing and publishing another.
 */

const ME = 'c0ffee00-1111-4222-8333-444455556666';
const SOMEONE = 'deadbeef-1111-4222-8333-444455556666';

let root = '';

beforeEach(() => {
  root = fs.mkdtempSync(path.join(os.tmpdir(), 'fluideq-makers-'));
});

afterEach(() => {
  fs.rmSync(root, { recursive: true, force: true });
});

test('a maker is remembered, and forgotten when the server stops saying so', () => {
  expect(isKnownMaker(root, ME)).toBe(false);

  expect(setKnownMaker(root, ME, true)).toBe(true);
  expect(isKnownMaker(root, ME)).toBe(true);

  // The same answer again changes nothing, so nothing is announced twice.
  expect(setKnownMaker(root, ME, true)).toBe(false);

  expect(setKnownMaker(root, ME, false)).toBe(true);
  expect(isKnownMaker(root, ME)).toBe(false);
  expect(setKnownMaker(root, ME, false)).toBe(false);
});

test('it is one account’s answer, never the computer’s', () => {
  setKnownMaker(root, ME, true);
  expect(isKnownMaker(root, SOMEONE)).toBe(false);

  setKnownMaker(root, SOMEONE, true);
  setKnownMaker(root, ME, false);
  expect(isKnownMaker(root, SOMEONE)).toBe(true);
  expect(isKnownMaker(root, ME)).toBe(false);
});
