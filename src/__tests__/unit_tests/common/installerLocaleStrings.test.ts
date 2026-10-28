/* Copyright (C) 2026 Ivan Carmenates Garcia. SPDX-License-Identifier: GPL-3.0-or-later */

import fs from 'fs';
import path from 'path';
import { LOCALES, type LocaleCode } from 'common/i18n';

const languages: Record<LocaleCode, string> = {
  en: 'ENGLISH',
  zh: 'SIMPCHINESE',
  'zh-Hant': 'TRADCHINESE',
  ko: 'KOREAN',
  hi: 'HINDI',
  es: 'SPANISHINTERNATIONAL',
  fr: 'FRENCH',
  pt: 'PORTUGUESEBR',
  ru: 'RUSSIAN',
  ja: 'JAPANESE',
  de: 'GERMAN',
  it: 'ITALIAN',
};
const source = fs.readFileSync(
  path.join(__dirname, '../../../../assets/nsis/engine-strings.nsh'),
  'utf8',
);
const entries = Array.from(
  source.matchAll(/^LangString\s+(\w+)\s+\$\{LANG_(\w+)\}\s+"(.*)"\r?$/gm),
  (match) => ({ key: match[1], language: match[2], text: match[3] }),
);
const english = entries.filter((entry) => entry.language === 'ENGLISH');

it('supplies every engine prompt once per installer language, including scripts', () => {
  expect(english.length).toBeGreaterThan(0);
  LOCALES.forEach(({ code }) => {
    const translated = entries.filter(
      (entry) => entry.language === languages[code],
    );
    expect(translated.map(({ key }) => key).sort()).toEqual(
      english.map(({ key }) => key).sort(),
    );
    english.forEach(({ key, text }) => {
      const target = translated.find((entry) => entry.key === key)?.text ?? '';
      expect(target.match(/\$\d+/g) ?? []).toEqual(text.match(/\$\d+/g) ?? []);
    });
  });
});
