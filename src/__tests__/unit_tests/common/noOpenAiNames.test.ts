/* Copyright (C) 2026 Ivan Carmenates Garcia. SPDX-License-Identifier: GPL-3.0-or-later */

import fs from 'fs';
import path from 'path';

/**
 * No GPT, ChatGPT, Codex or OpenAI anywhere a member reads (Ivan,
 * 2026-11-12): the Studio's one maker is Higgsfield and its AI is the
 * member's Claude Code or another assistant that speaks MCP. Read from every
 * language's strings and everything the Studio ships to a member's AI (its
 * skills, its starter, its notes), so a word added in any of them fails here.
 *
 * Two files are records, not text the app says, and keep the names they
 * must: the starter pictures' licence, which says how they were made, and
 * the speech model's notice (outside these folders, named for clarity).
 */

const root = path.join(__dirname, '../../../..');

// Whole words in any case: Help's search words carried a lowercase
// "chatgpt" past a case-sensitive pattern. "gpt" stands alone or before a
// hyphen ("GPT-4o"), and a whole word keeps "openAir", a Room preset's key,
// from reading as the company.
const NAMES = /\bchatgpt\b|\bgpt\b|\bcodex\b|\bopenai\b/i;

const RECORDS = [
  'assets/studio/starter/LICENSES.md',
  'assets/licenses/THIRD-PARTY-NOTICES.txt',
];

const TEXT = /\.(ts|md|json|txt|glsl|frag|vert)$/;

const filesUnder = (dir: string): string[] =>
  fs
    .readdirSync(path.join(root, dir), { withFileTypes: true })
    .flatMap((entry) => {
      const relative = `${dir}/${entry.name}`;
      if (entry.isDirectory()) {
        return filesUnder(relative);
      }
      return TEXT.test(entry.name) ? [relative] : [];
    });

const READ = [...filesUnder('src/common/i18n'), ...filesUnder('assets/studio')];

const withNames = (files: string[]) =>
  files.filter((file) =>
    NAMES.test(fs.readFileSync(path.join(root, file), 'utf8')),
  );

it('names no OpenAI product in any language or anything the Studio ships', () => {
  expect(withNames(READ.filter((file) => !RECORDS.includes(file)))).toEqual([]);
});

it('reads what it says it reads, and the pattern finds what it looks for', () => {
  // Every language, and the Studio's skills among what it ships.
  expect(READ.filter((file) => file.endsWith('/studio.ts'))).toHaveLength(12);
  expect(READ.some((file) => file.includes('/skills/'))).toBe(true);
  // The starter's licence is read and does carry the names: the allowlist is
  // what lets it through, not a scan that never reached it.
  expect(withNames(READ)).toContain('assets/studio/starter/LICENSES.md');
  [
    'ChatGPT, Codex or any other assistant',
    'OpenAI, Gemini',
    'GPT',
    'shader, glsl, code, ai, chatgpt, claude',
    '、chatgpt、',
    'made with gpt-image',
    'ask gpt to draw',
  ].forEach((text) => expect(text).toMatch(NAMES));
  // Words that only hold the letters are not names.
  ['openAir', 'Open air', 'decodexed', 'gptq'].forEach((text) =>
    expect(text).not.toMatch(NAMES),
  );
});
