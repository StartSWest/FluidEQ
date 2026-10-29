/** @jest-environment node */
/* Copyright (C) 2026 Ivan Carmenates Garcia. SPDX-License-Identifier: GPL-3.0-or-later */

import { existsSync, readFileSync } from 'fs';
import { join } from 'path';
import { LOCALES } from 'common/i18n';

/**
 * macOS asks for the system audio and the microphone in the Mac's own
 * language, from the bundle's `<name>.lproj/InfoPlist.strings`, and falls
 * back to English for a language with no folder. 2.2 added Korean and
 * Traditional Chinese to the app and not here, so a Korean Mac asked in
 * English. The folders take Electron's own names for its locales.
 */
const LOCALES_DIR = join(__dirname, '../../../../assets/mac/locales');
const LPROJ: Record<string, string> = {
  pt: 'pt_BR',
  zh: 'zh_CN',
  'zh-Hant': 'zh_TW',
};
const KEYS = ['NSAudioCaptureUsageDescription', 'NSMicrophoneUsageDescription'];

describe('the Mac permission prompts', () => {
  it.each(LOCALES.map(({ code }) => code))('are written in %s', (code) => {
    const file = join(
      LOCALES_DIR,
      `${LPROJ[code] ?? code}.lproj`,
      'InfoPlist.strings',
    );
    expect(existsSync(file)).toBe(true);
    const text = readFileSync(file, 'utf8');
    KEYS.forEach((key) => {
      expect(text).toMatch(new RegExp(`^"${key}" = "[^"]+";$`, 'mu'));
    });
  });

  it('are not English in another language’s folder', () => {
    const english = readFileSync(
      join(LOCALES_DIR, 'en.lproj', 'InfoPlist.strings'),
      'utf8',
    );
    LOCALES.filter(({ code }) => code !== 'en').forEach(({ code }) => {
      const file = join(
        LOCALES_DIR,
        `${LPROJ[code] ?? code}.lproj`,
        'InfoPlist.strings',
      );
      expect(readFileSync(file, 'utf8')).not.toBe(english);
    });
  });
});
