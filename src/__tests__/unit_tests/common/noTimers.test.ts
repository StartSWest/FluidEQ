/**
 * @jest-environment node
 */
/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * No timers, anywhere in the app's own code: the rule in CLAUDE.md, held as
 * the source's own text.
 *
 * A timer decides when something happens by guessing how long another
 * machine takes, and guesses wrong on the machine that needed it to be right.
 * Seventy of them had collected while the rule was only written down — each
 * one reasonable where it stood, from a notice's linger to a device poll every
 * three seconds — and every one was replaced by the event it stood in for.
 * This is what keeps the count at zero: a new one fails here, with its file
 * and line, before it can reach a window.
 *
 * Also held: PowerShell sleeping in a loop, which is the same guess made in a
 * child process instead of this one; and the same guess in its other
 * spellings, each of which was found in the tree after the plain calls were
 * gone — a timer passed in under another name (the instance marker's twenty-
 * second heartbeat), `AbortSignal.timeout` (the pairing's five seconds), a
 * child process's `timeout:` option, and a PowerShell `Wait(4000)`.
 */

import fs from 'fs';
import path from 'path';

const SRC = path.join(__dirname, '..', '..', '..');
const ASSETS = path.join(SRC, '..', 'assets');
const SOURCE_DIRS = ['main', 'renderer', 'common'].map((dir) =>
  path.join(SRC, dir),
);

const filesUnder = (dir: string, extensions: readonly string[]): string[] =>
  fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      return filesUnder(full, extensions);
    }
    return extensions.some((extension) => entry.name.endsWith(extension))
      ? [full]
      : [];
  });

/**
 * The name in code, not only a call: a timer handed on under another name
 * (`setInterval: schedule = setInterval`) is still a timer. Comments explaining
 * why one is gone are taken off first (`codeOf`).
 */
const TIMER = /\b(?:setTimeout|setInterval)\b|\bAbortSignal\s*\.\s*timeout\b/;
/** A deadline on a child process or a request: `{ timeout: 10000 }`. */
const DEADLINE_OPTION = /\btimeout\s*:\s*[\d_]+/;
const SLEEP = /\bStart-Sleep\b|\.Wait\(\s*\d/i;

/** The line with its comments taken off, so prose about timers is allowed. */
const codeOf = (line: string): string => {
  const trimmed = line.trim();
  if (
    trimmed.startsWith('//') ||
    trimmed.startsWith('*') ||
    trimmed.startsWith('/*') ||
    trimmed.startsWith('#')
  ) {
    return '';
  }
  const comment = line.indexOf('//');
  return comment >= 0 ? line.slice(0, comment) : line;
};

const offences = (files: readonly string[], pattern: RegExp): string[] =>
  files.flatMap((file) =>
    fs
      .readFileSync(file, 'utf8')
      .split('\n')
      .flatMap((line, index) =>
        pattern.test(codeOf(line))
          ? [`${path.relative(SRC, file)}:${index + 1}: ${line.trim()}`]
          : [],
      ),
  );

describe('waiting is spelled with events', () => {
  const sources = SOURCE_DIRS.flatMap((dir) =>
    filesUnder(dir, ['.ts', '.tsx']),
  );

  it('finds the source it is meant to read', () => {
    // The positive control: an empty walk would pass every check below.
    expect(sources.length).toBeGreaterThan(500);
    expect(
      offences([path.join(__dirname, 'noTimers.test.ts')], /\bcodeOf\s*\(/),
    ).not.toHaveLength(0);
  });

  it('calls no setTimeout and no setInterval, by any name', () => {
    expect(offences(sources, TIMER)).toEqual([]);
  });

  it('puts no deadline on a child process or a request', () => {
    expect(offences(sources, DEADLINE_OPTION)).toEqual([]);
  });

  it('sleeps and times out no PowerShell, in a script file or one written inline', () => {
    const scripts = filesUnder(ASSETS, ['.ps1']);
    expect(offences([...scripts, ...sources], SLEEP)).toEqual([]);
  });
});
