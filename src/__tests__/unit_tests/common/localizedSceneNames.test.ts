/* Copyright (C) 2026 Ivan Carmenates Garcia. SPDX-License-Identifier: GPL-3.0-or-later */

import { LOCALES } from 'common/i18n';
import { promptWithIdea } from 'renderer/studio/aiPrompt';
import { readNames as readPackNames } from 'common/scenePackFields';
import { readNames as readGalleryNames } from 'common/plusGallery';

const names = {
  en: 'Light',
  zh: '光',
  ko: '빛',
  'zh-Hant': '光芒',
  'zh-Hant-arbitrary': 'discard this',
  'en-US': 'discard this too',
};

it.each([
  ['pack and controls', readPackNames],
  ['gallery', readGalleryNames],
] as const)(
  'keeps Korean and Traditional names in %s without accepting arbitrary tags',
  (_place, read) => {
    expect(read(names)).toEqual({
      en: 'Light',
      zh: '光',
      ko: '빛',
      'zh-Hant': '光芒',
    });
    expect(read({ ko: '빛', 'zh-Hant': '光芒' })).toBeFalsy();
  },
);

it('asks scene creators for every supported name tag, including the Chinese script', () => {
  const namesLine =
    promptWithIdea('A light')
      .split('\n')
      .find((line) => line.startsWith('- names:')) ?? '';
  LOCALES.filter((locale) => locale.code !== 'en').forEach(({ code }) => {
    expect(namesLine.split(/[ ,;.]+/)).toContain(code);
  });
});
