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
  readAgreedTerms,
  writeAgreedTerms,
} from '../../../main/memberScenes/termsAgreement';

const ALICE = '0f8fad5b-d9cb-469f-a165-70867728950e';
const BOB = '7c9e6679-7425-40de-944b-e07fc1f90ae7';

let root: string;

beforeEach(() => {
  root = fs.mkdtempSync(path.join(os.tmpdir(), 'fluideq-terms-agreed-'));
});

afterEach(() => {
  fs.rmSync(root, { recursive: true, force: true });
});

/** The record from before agreements were kept per account. */
const writeOldRecord = (agreed: number) => {
  const file = path.join(root, 'member-scenes', 'terms.json');
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify({ agreed }), 'utf8');
  return file;
};

describe('whether the Studio asks for the Plus terms again', () => {
  // The control: an account that agreed here is not asked again.
  it('does not ask an account that agreed on this computer', () => {
    writeAgreedTerms(root, ALICE, 5);
    expect(readAgreedTerms(root, ALICE)).toBe(5);
  });

  // The bug: B shared under A's agreement, and the server was told B agreed.
  it('asks a second account on the same computer', () => {
    writeAgreedTerms(root, ALICE, 5);
    expect(readAgreedTerms(root, BOB)).toBe(0);
  });

  it('keeps each account at the highest version it agreed to', () => {
    writeAgreedTerms(root, ALICE, 5);
    writeAgreedTerms(root, ALICE, 3);
    writeAgreedTerms(root, BOB, 4);
    expect(readAgreedTerms(root, ALICE)).toBe(5);
    expect(readAgreedTerms(root, BOB)).toBe(4);
  });

  it('asks nobody to have agreed before anything is written', () => {
    expect(readAgreedTerms(root, ALICE)).toBe(0);
  });
});

describe('the record from before it was kept per account', () => {
  // It says a version was agreed, not by whom, so it answers for nobody.
  it('asks once, and not again after the account agrees', () => {
    const oldFile = writeOldRecord(5);
    expect(readAgreedTerms(root, ALICE)).toBe(0);

    writeAgreedTerms(root, ALICE, 5);
    expect(readAgreedTerms(root, ALICE)).toBe(5);
    // Still nobody else's agreement.
    expect(readAgreedTerms(root, BOB)).toBe(0);
    // Left as it was, for an older build that reads nothing else.
    expect(JSON.parse(fs.readFileSync(oldFile, 'utf8'))).toEqual({
      agreed: 5,
    });
  });
});
