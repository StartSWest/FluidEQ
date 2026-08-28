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
  - `Out-File` and `>` write a UTF-8 BOM, invisible in every editor, which
    changes the first token of the file.

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

const REPO_ROOT = path.join(__dirname, '..', '..');

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
 * A C1 control character, which is the loudest half of the signature.
 *
 * A 3-byte UTF-8 character -- every dash, curly quote and ellipsis in this
 * tree -- is E2 followed by two continuation bytes in 80-BF. Mis-decoded as
 * Latin-1 the lead becomes `a-circumflex` (U+00E2) and BOTH continuations
 * become codepoints in U+0080-U+009F, which is the C1 control block: no
 * printable character, no keyboard, and nothing any of this project's ten
 * locales contains. One anywhere in a source file means the bytes went through
 * the wrong decoder.
 *
 * The first version of this looked for the lead character instead and matched
 * U+00C2/U+00C3 only, which is what a mangled TWO-byte character starts with.
 * It therefore missed every mangled em-dash -- the nine that prompted the
 * script. Its own positive control caught that, which is the whole argument
 * for writing one.
 */
const C1_CONTROL = /[\u0080-\u009f]/;

/**
 * The other half: a mangled two-byte character, whose tail can be printable.
 *
 * `middle dot` is C2 B7, and mis-decoded it is U+00C2 followed by U+00B7 --
 * a real, printable character, so `C1_CONTROL` never sees it. That exact case
 * had been sitting in a `title` attribute in the karaoke workspace. The lead
 * is restricted to the two characters a mangled 2-byte sequence can start
 * with, so ordinary accented prose does not trip it.
 */
const MANGLED_PAIR = /[\u00c2\u00c3][\u0080-\u00bf]/;

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
  .filter((name) => name !== '' && TEXT_EXTENSIONS.has(path.extname(name)));

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
    if (C1_CONTROL.test(line) || MANGLED_PAIR.test(line)) {
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
