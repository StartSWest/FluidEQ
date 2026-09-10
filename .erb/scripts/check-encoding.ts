/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU General Public License version 3 or later.

Rejects text that has been through the wrong encoder, which is a mistake
nothing else in this tree can see.

Every source file here is UTF-8 and full of em-dashes, and two ways of writing
one back have already corrupted files that then compiled, linted, passed the
whole suite and got committed:

  - PowerShell's `Set-Content`/`Add-Content` default to the system ANSI
    codepage. Read a UTF-8 file with `Get-Content -Raw`, write it back, and
    every em-dash is re-encoded a byte at a time as if it were Latin-1: E2 80
    94 becomes C3 A2 C2 80 C2 94, which renders as a dash followed by two
    invisible C1 control codes.
  - Windows PowerShell 5.1 does the same through CP1252 rather than Latin-1,
    and CP1252 gives 80-9F printable characters: the same em-dash comes back
    as `a-circumflex, euro sign, right double quote` -- three visible glyphs
    and not one control code. Thirty of those got past the first two
    signatures in one document while this check reported the tree clean.
  - `Out-File` and `>` write a UTF-8 BOM, invisible in every editor, which
    changes the first token of the file.

The signatures themselves live in `encodingPatterns.ts`, where Jest holds each
one to bytes a real round-trip produced -- the positive control without which
"unmangled" and "matches nothing" read the same.

Both fail silently, and mostly they land in comments, which is why nobody sees
them until a person reads the file. Not always, though: this check's first run
found a middle dot mangled inside a `title` attribute, so the tooltip on the
karaoke text-size slider had been reading "Text size A. 120%" on screen.

The rule is: files are UTF-8, without a BOM, and never double-encoded. Use the
editing tools rather than a shell round-trip -- CLAUDE.md says the same thing
about `$` and backslashes, and this is the same failure with a different
trigger.
*/

import { execFileSync } from 'child_process';
import { readFileSync } from 'fs';
import path from 'path';
import { isMangledLine } from './encodingPatterns';

const REPO_ROOT = path.join(__dirname, '..', '..');

/**
 * Text this project authors that carries no extension.
 *
 * `native/CMakeLists.txt` held a Latin-1-mangled em-dash for weeks: the file
 * is full of comments, the comment is where mangling lands, and an
 * extension-only filter never opened it.
 */
const TEXT_BASENAMES = new Set(['CMakeLists.txt']);

/** Text this project authors. Binaries and vendored trees are not ours. */
const TEXT_EXTENSIONS = new Set([
  '.ts',
  '.tsx',
  '.js',
  '.jsx',
  '.cjs',
  '.mjs',
  '.scss',
  '.css',
  '.md',
  '.json',
  '.yml',
  '.yaml',
  '.html',
  '.cpp',
  '.h',
  '.hpp',
  '.nsh',
]);

/**
 * The one legitimate reason to hold these bytes: text about decoding text.
 *
 * `karaokeFiles.test.ts` asserts that the same two bytes read one way under a
 * UTF-8 header and another under a CP1252 one, which is the positive control
 * for the header being honoured at all -- there the mangled-looking string is
 * the expected output rather than damage. A reason is required rather than a
 * bare path, so anything added here has to say what it is for.
 */
const ALLOWED = new Map<string, string>([
  [
    'src/__tests__/unit_tests/common/karaokeFiles.test.ts',
    'asserts CP1252 decoding; the mangled text is the expected result',
  ],
]);

const tracked = execFileSync('git', ['ls-files', '-z'], {
  cwd: REPO_ROOT,
  encoding: 'utf8',
  maxBuffer: 32 * 1024 * 1024,
})
  .split('\0')
  .filter(
    (name) =>
      name !== '' &&
      (TEXT_EXTENSIONS.has(path.extname(name)) ||
        TEXT_BASENAMES.has(path.basename(name))),
  );

const offences: string[] = [];

tracked.forEach((name) => {
  const bytes = readFileSync(path.join(REPO_ROOT, name));

  if (bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf) {
    offences.push(`${name}:1  UTF-8 BOM`);
  }

  // `fatal` so bytes that are not UTF-8 at all are caught here rather than
  // becoming U+FFFD and slipping past the pattern below.
  let text: string;
  try {
    text = new TextDecoder('utf-8', { fatal: true }).decode(bytes);
  } catch {
    offences.push(`${name}:1  not valid UTF-8`);
    return;
  }

  if (ALLOWED.has(name)) {
    return;
  }

  text.split('\n').forEach((line, index) => {
    if (isMangledLine(line)) {
      offences.push(
        `${name}:${index + 1}  double-encoded UTF-8: ${line.trim().slice(0, 72)}`,
      );
    }
  });
});

if (offences.length > 0) {
  console.error(
    `\n${offences.length} encoding problem(s) -- a file was written back through a shell rather than an editor; see the header of this script:\n\n${offences.join('\n')}\n`,
  );
  process.exit(1);
}

console.log(
  `${tracked.length} text files are UTF-8, unmangled and BOM-free (${ALLOWED.size} allowed by name).`,
);
