/* Copyright (C) 2026 Ivan Carmenates Garcia. SPDX-License-Identifier: GPL-3.0-or-later */

import fs from 'fs';
import path from 'path';
import { LOCALES } from 'common/i18n';

const readme = fs.readFileSync(
  path.join(__dirname, '../../../../README.md'),
  'utf8',
);

it('lists the current registry count and every native interface name in the README', () => {
  const summary = readme.match(
    /\*\*(\d+) interface languages\.\*\* ([\s\S]*?)\nThe installer/,
  );
  expect(Number(summary?.[1])).toBe(LOCALES.length);
  LOCALES.forEach(({ name }) => expect(summary?.[2]).toContain(name));
});

it('keeps current language-count claims aligned without rewriting release history', () => {
  // The earlier New in 2.0 section describes that release's ten languages.
  // Current feature, development and guide claims begin at What it does.
  const at = readme.indexOf('## What it does');
  expect(at).toBeGreaterThan(0);
  const current = readme.slice(at);
  const numberNames: readonly string[] = [
    'zero',
    'one',
    'two',
    'three',
    'four',
    'five',
    'six',
    'seven',
    'eight',
    'nine',
    'ten',
    'eleven',
    'twelve',
    'thirteen',
    'fourteen',
    'fifteen',
    'sixteen',
    'seventeen',
    'eighteen',
    'nineteen',
    'twenty',
  ];
  const expression = new RegExp(
    `\\b(\\d+|${numberNames.join('|')})\\s+(?:interface\\s+)?languages\\b`,
    'gi',
  );
  const claims = [...current.matchAll(expression)];
  expect(claims.length).toBeGreaterThan(0);
  claims.forEach(([, value]) => {
    const count = /^\d+$/.test(value)
      ? Number(value)
      : numberNames.indexOf(value.toLowerCase());
    expect(count).toBe(LOCALES.length);
  });
});
