/** @jest-environment node */
/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * The Linux words laid over the shared dictionaries (`common/i18n/linux`).
 *
 * The Linux app said "Restart Windows audio", promised Windows permission
 * prompts that never come and listed Windows 10 as a requirement. These pin
 * that the Linux words win once a process asks for them, that the shared ones
 * stand when it has not (the positive control: the same key, the same
 * language, the Windows sentence), and that every language says the same
 * thing in the same shape — the same keys and the same placeholders.
 */

import {
  LOCALES,
  loadLocale,
  setPlatformText,
  translate,
  type TranslationKey,
} from 'common/i18n';
import en from 'common/i18n/en';
import LINUX_TEXT from 'common/i18n/linux';

const KEY: TranslationKey = 'app.menu.restartAudio';

afterEach(() => setPlatformText({}));

describe('the Linux words', () => {
  it('stand in for the shared ones once asked for', async () => {
    await loadLocale('es');
    expect(translate('en', KEY)).toBe(en[KEY]);
    expect(translate('es', KEY)).not.toBe(LINUX_TEXT.es[KEY]);

    setPlatformText(LINUX_TEXT);
    expect(translate('en', KEY)).toBe('Restart audio');
    expect(translate('es', KEY)).toBe(LINUX_TEXT.es[KEY]);
  });

  it('leave every other key to the shared dictionary', () => {
    setPlatformText(LINUX_TEXT);
    expect(translate('en', 'app.menu.reinstallApp', { product: 'X' })).toBe(
      'Reinstall X…',
    );
  });

  it('say the same keys in every language', () => {
    const keys = Object.keys(LINUX_TEXT.en).sort();
    LOCALES.forEach(({ code }) => {
      expect([code, Object.keys(LINUX_TEXT[code]).sort()]).toEqual([
        code,
        keys,
      ]);
    });
  });

  it('keep each key’s placeholders and its number of lines', () => {
    const placeholders = (text: string) =>
      (text.match(/\{\w+\}/g) ?? []).sort();
    (Object.keys(LINUX_TEXT.en) as TranslationKey[]).forEach((key) => {
      const source = LINUX_TEXT.en[key] ?? '';
      LOCALES.forEach(({ code }) => {
        const text = LINUX_TEXT[code][key] ?? '';
        expect([code, key, placeholders(text)]).toEqual([
          code,
          key,
          placeholders(source),
        ]);
        expect([code, key, text.split('\n').length]).toEqual([
          code,
          key,
          source.split('\n').length,
        ]);
      });
    });
  });

  it('only replace keys the shared dictionary has', () => {
    Object.keys(LINUX_TEXT.en).forEach((key) => {
      expect([key, key in en]).toEqual([key, true]);
    });
  });
});
