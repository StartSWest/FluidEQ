/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import fs from 'fs';
import os from 'os';
import path from 'path';
import { loadLocale, translate } from 'common/i18n';
import en from 'common/i18n/en';
import mainText from 'main/mainText';
import { Refusal, userMessageOf } from 'main/refusal';
import { importConvolutionFile, importEqFile } from 'main/importSettings';
import { setTrayLocale } from 'main/tray';

/*
 * Main said everything in English whatever the window's language: file
 * dialogs, what an import did, and why one was refused — the refusals thrown
 * as English sentences and relayed to the window as they were.
 */

const noWindow = { getMainWindow: () => null };

beforeAll(async () => {
  await loadLocale('de');
});

afterEach(() => {
  setTrayLocale('en', noWindow);
});

describe("main's own words", () => {
  it("are in the window's language, and English until it says one", () => {
    expect(mainText('files.title.importEq')).toBe(en['files.title.importEq']);
    setTrayLocale('de', noWindow);
    expect(mainText('files.title.importEq')).toBe(
      translate('de', 'files.title.importEq'),
    );
    expect(mainText('files.title.importEq')).not.toBe(
      en['files.title.importEq'],
    );
  });

  it('fill their numbers in', () => {
    setTrayLocale('de', noWindow);
    expect(mainText('eq.refused.bandLimit', { max: 64 })).toBe(
      translate('de', 'eq.refused.bandLimit', { max: 64 }),
    );
    expect(mainText('eq.refused.bandLimit', { max: 64 })).toContain('64');
  });
});

describe('a refusal', () => {
  it('reaches the user in their language and the log in English', () => {
    setTrayLocale('de', noWindow);
    const refusal = new Refusal('files.wav.rate', {
      rate: 22050,
      rates: '44100, 48000',
    });
    expect(refusal.message).toBe(
      translate('en', 'files.wav.rate', { rate: 22050, rates: '44100, 48000' }),
    );
    expect(userMessageOf(refusal)).toBe(
      translate('de', 'files.wav.rate', { rate: 22050, rates: '44100, 48000' }),
    );
  });

  it('is told apart from a fault, which reaches the user as the system worded it', () => {
    setTrayLocale('de', noWindow);
    expect(userMessageOf(new Error('EACCES: permission denied'))).toBe(
      'EACCES: permission denied',
    );
    expect(userMessageOf('not an error')).toBeUndefined();
  });
});

describe("the importer's refusals", () => {
  let dir: string;

  beforeEach(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'fluideq-refusal-'));
  });

  afterEach(() => {
    fs.rmSync(dir, { recursive: true, force: true });
  });

  it('say in German that a text file holds no EQ', () => {
    setTrayLocale('de', noWindow);
    const file = path.join(dir, 'notes.txt');
    fs.writeFileSync(file, 'not an equaliser at all');
    let caught: unknown;
    try {
      importEqFile(file);
    } catch (error) {
      caught = error;
    }
    expect(caught).toBeInstanceOf(Refusal);
    expect(userMessageOf(caught)).toBe(translate('de', 'files.eq.noFilters'));
  });

  it('say in German that a file is not a WAV', () => {
    setTrayLocale('de', noWindow);
    const file = path.join(dir, 'impulse.wav');
    fs.writeFileSync(file, Buffer.from('this is not a RIFF file at all, no'));
    let caught: unknown;
    try {
      importConvolutionFile(file, dir);
    } catch (error) {
      caught = error;
    }
    expect(caught).toBeInstanceOf(Refusal);
    expect(userMessageOf(caught)).toBe(translate('de', 'files.wav.notWav'));
  });

  it('name what an EQ file was recognised as, for the summary to say', () => {
    const file = path.join(dir, 'eq.txt');
    fs.writeFileSync(file, 'Filter 1: ON PK Fc 1000 Hz Gain 3 dB Q 1\n');
    expect(importEqFile(file).source).toBe('parametricEq');
  });
});
