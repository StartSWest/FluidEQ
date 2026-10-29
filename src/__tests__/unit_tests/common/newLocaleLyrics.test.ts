/* Copyright (C) 2026 Ivan Carmenates Garcia. SPDX-License-Identifier: GPL-3.0-or-later */

import { isKaraokeSectionText } from 'common/karaoke/sections';
import { parseLrc } from 'common/karaoke/lrc';

it.each(['[후렴]', '[1절]', '[간주]', '[브리지: 가수]', '【獨奏】'])(
  'recognizes %s as a musical section rather than a line to sing',
  (text) => {
    expect(isKaraokeSectionText(text)).toBe(true);
  },
);

it.each(['[오오오]', '[웃음]', '[다시 만나]', '【啦啦啦】', '[후렴처럼]'])(
  'keeps sung words %s out of the structural vocabulary',
  (text) => {
    expect(isKaraokeSectionText(text)).toBe(false);
  },
);

it('imports the headings while retaining Korean and Traditional sung lines', () => {
  const parsed = parseLrc(
    [
      '[00:01.00][후렴]',
      '[00:03.00]다시 만나요',
      '[00:05.00]【獨奏】',
      '[00:07.00]再見到你',
    ].join('\n'),
  );
  expect(parsed.lines.map((line) => line.kind)).toEqual([
    'section',
    'lyrics',
    'section',
    'lyrics',
  ]);
  expect(parsed.lines[1].tokens.map((token) => token.text).join('')).toBe(
    '다시 만나요',
  );
  expect(parsed.lines[3].tokens.map((token) => token.text).join('')).toBe(
    '再見到你',
  );
});
