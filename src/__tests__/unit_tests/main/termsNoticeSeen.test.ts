/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * @jest-environment node
 */

import fs from 'fs';
import os from 'os';
import path from 'path';
import {
  readTermsNoticeSeen,
  writeTermsNoticeSeen,
} from '../../../main/account/termsNoticeSeen';

let root: string;

beforeEach(() => {
  root = fs.mkdtempSync(path.join(os.tmpdir(), 'fluideq-terms-seen-'));
});

afterEach(() => {
  fs.rmSync(root, { recursive: true, force: true });
});

const file = () => path.join(root, 'plus-terms-notice.json');

describe('which terms notice each account has seen', () => {
  it('has seen nothing before anything is written', () => {
    expect(readTermsNoticeSeen(root, 'account-a')).toBe(0);
  });

  it('remembers the version per account', () => {
    writeTermsNoticeSeen(root, 'account-a', 5);
    expect(readTermsNoticeSeen(root, 'account-a')).toBe(5);
    // Somebody else on this computer has been told nothing.
    expect(readTermsNoticeSeen(root, 'account-b')).toBe(0);
  });

  it('never goes back to an older version', () => {
    writeTermsNoticeSeen(root, 'account-a', 5);
    writeTermsNoticeSeen(root, 'account-a', 4);
    expect(readTermsNoticeSeen(root, 'account-a')).toBe(5);
  });

  it('keeps the other accounts when one is written', () => {
    writeTermsNoticeSeen(root, 'account-a', 4);
    writeTermsNoticeSeen(root, 'account-b', 5);
    expect(readTermsNoticeSeen(root, 'account-a')).toBe(4);
    expect(readTermsNoticeSeen(root, 'account-b')).toBe(5);
  });

  it('reads a damaged file as nothing seen, and can write over it', () => {
    fs.writeFileSync(file(), '{"account-a": 5', 'utf8');
    expect(readTermsNoticeSeen(root, 'account-a')).toBe(0);
    writeTermsNoticeSeen(root, 'account-a', 5);
    expect(readTermsNoticeSeen(root, 'account-a')).toBe(5);
  });

  it('ignores entries that are not a version', () => {
    fs.writeFileSync(
      file(),
      JSON.stringify({ 'account-a': '5', 'account-b': 2.5, 'account-c': 3 }),
      'utf8',
    );
    expect(readTermsNoticeSeen(root, 'account-a')).toBe(0);
    expect(readTermsNoticeSeen(root, 'account-b')).toBe(0);
    expect(readTermsNoticeSeen(root, 'account-c')).toBe(3);
  });

  it('forgets the oldest accounts rather than growing without end', () => {
    for (let index = 0; index < 70; index += 1) {
      writeTermsNoticeSeen(root, `account-${index}`, 5);
    }
    const kept = Object.keys(JSON.parse(fs.readFileSync(file(), 'utf8')));
    expect(kept).toHaveLength(64);
    expect(readTermsNoticeSeen(root, 'account-0')).toBe(0);
    expect(readTermsNoticeSeen(root, 'account-69')).toBe(5);
  });
});
