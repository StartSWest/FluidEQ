/* Copyright (C) 2026 Ivan Carmenates Garcia. SPDX-License-Identifier: GPL-3.0-or-later */

import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import ts from 'typescript';

/**
 * What the shipped stills were drawn from: every source file of the app the
 * stills' page bundled (`generate.ts` reads them from webpack's stats), and
 * one hash over their code. A still is stale when that code has changed, and
 * `lookStillsFresh.test.ts` fails then, naming the file.
 *
 * The code, not the text: each file is read as TypeScript's scanner reads
 * it, comments and layout skipped, so a comment rewritten or a file
 * reformatted is not a change to a look, and anything that is - a number, a
 * colour, a call, a new import - is.
 */

export const ROOT = path.resolve(__dirname, '../..');

/** Where the list and its hash are kept, beside the stills. */
export const SOURCES_FILE = path.join(
  ROOT,
  'src',
  'renderer',
  'graph',
  'lookStills',
  'stills',
  'sources.json',
);

export interface IStillSources {
  /** Over every file's code, in the order listed. */
  hash: string;
  /** Each file, from the root, with forward slashes, and its own hash. */
  files: ReadonlyArray<{ file: string; hash: string }>;
}

/** A file's tokens, comments and whitespace left out. */
export const codeOf = (text: string, file: string): string => {
  const scanner = ts.createScanner(
    ts.ScriptTarget.Latest,
    true,
    /\.tsx$|\.jsx$/.test(file)
      ? ts.LanguageVariant.JSX
      : ts.LanguageVariant.Standard,
    text,
  );
  const tokens: string[] = [];
  for (
    let token = scanner.scan();
    token !== ts.SyntaxKind.EndOfFileToken;
    token = scanner.scan()
  ) {
    tokens.push(scanner.getTokenText());
  }
  return tokens.join(' ');
};

const sha = (text: string) =>
  crypto.createHash('sha256').update(text).digest('hex');

/** `files` (from the root) hashed as `IStillSources` keeps them. */
export const hashSources = (files: readonly string[]): IStillSources => {
  const listed = [...files].sort().map((file) => {
    const text = fs.readFileSync(path.join(ROOT, file), 'utf8');
    return { file, hash: sha(codeOf(text, file)) };
  });
  return {
    hash: sha(listed.map(({ file, hash }) => `${file} ${hash}`).join('\n')),
    files: listed,
  };
};
