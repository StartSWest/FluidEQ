/** @jest-environment node */
/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * Every PowerShell this app runs answers in UTF-8 (GitHub issue 39).
 *
 * The app reads PowerShell's output as UTF-8 and Windows PowerShell 5.1 writes
 * it in the console's code page, so an output Windows names in Chinese reached
 * the window as replacement characters on a Chinese system, and as question
 * marks here. The live case runs real PowerShell through `execFile` the way
 * the app does, beside the same script without the statement as its control.
 */

import { execFile } from 'child_process';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { promisify } from 'util';
import {
  POWERSHELL_PATH,
  UTF8_OUTPUT_STATEMENT,
  utf8Command,
} from 'main/powershell';

const execFileAsync = promisify(execFile);

const ROOT = path.join(__dirname, '../../../..');
const ASSETS = path.join(ROOT, 'assets');
const MAIN = path.join(ROOT, 'src/main');

/**
 * Names Windows gives outputs. The first two are the reporter's, as his Sound
 * page shows them: 扬声器 is Windows' own "Speakers" in Simplified Chinese, so
 * every output on such a machine starts with it. Then Windows' "Speakers" in
 * Japanese, Korean and Russian, and names a user can rename an output to.
 */
const NAMES = [
  '扬声器 (USB Audio Device)',
  '扬声器 (MIXLINE)',
  'スピーカー',
  '스피커',
  'Динамики',
  'Haut-parleurs Réalité',
  '🎧 Headset',
];

const shippedScripts = () =>
  fs
    .readdirSync(ASSETS)
    .filter((name) => name.endsWith('.ps1'))
    .map((name) => ({ name, text: fs.readFileSync(path.join(ASSETS, name)) }));

/** The script's statements with comments and blank lines left out. */
const codeLines = (text: string): string[] =>
  text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith('#'));

/** The first statement after the `param(...)` block, if there is one. */
const firstStatement = (text: string): string | undefined => {
  const lines = codeLines(text);
  if (!lines[0]?.toLowerCase().startsWith('param(')) {
    return lines[0];
  }
  // The line the block's brackets balance on closes it.
  let depth = 0;
  const closing = lines.findIndex((line) => {
    depth +=
      (line.match(/\(/g) ?? []).length - (line.match(/\)/g) ?? []).length;
    return depth === 0;
  });
  return closing === -1 ? undefined : lines[closing + 1];
};

const sourceFiles = (dir: string): string[] =>
  fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      return sourceFiles(full);
    }
    return entry.name.endsWith('.ts') ? [full] : [];
  });

describe('PowerShell answers in UTF-8', () => {
  it('every shipped script sets it before anything else', () => {
    const scripts = shippedScripts();
    expect(scripts.length).toBeGreaterThanOrEqual(4);
    scripts.forEach(({ name, text }) => {
      expect([name, firstStatement(text.toString('utf8'))]).toEqual([
        name,
        UTF8_OUTPUT_STATEMENT,
      ]);
    });
    // Positive control for the reader: a script that prints first is caught.
    expect(
      firstStatement(
        `param([string]$A = '')\n'hello'\n${UTF8_OUTPUT_STATEMENT}`,
      ),
    ).toBe("'hello'");
  });

  it('every shipped script is plain ASCII', () => {
    // Windows PowerShell 5.1 reads a script without a byte-order mark in the
    // console's code page too: a character past ASCII outside a comment
    // would break the script on a Chinese system, and a mark would break the
    // repository's encoding check. So neither.
    shippedScripts().forEach(({ name, text }) => {
      const wide = [...text].findIndex((byte) => byte > 0x7f);
      expect([name, wide]).toEqual([name, -1]);
    });
  });

  it('every inline command goes through utf8Command', () => {
    const inline = sourceFiles(MAIN).filter((file) =>
      fs.readFileSync(file, 'utf8').includes("'-Command'"),
    );
    // Positive control: there are inline commands for this to look at.
    expect(inline.length).toBeGreaterThan(0);
    inline.forEach((file) => {
      const text = fs.readFileSync(file, 'utf8');
      const commands = text.split("'-Command'").length - 1;
      const wrapped = text.split('utf8Command(').length - 1;
      expect([path.relative(ROOT, file), wrapped >= commands]).toEqual([
        path.relative(ROOT, file),
        true,
      ]);
    });
  });

  it('turns the reporter’s bytes into what the screenshot showed, read the old way', () => {
    // 扬声器 ("speakers") in GBK, the console code page of a Chinese system.
    const gbk = Buffer.from([0xd1, 0xef, 0xc9, 0xf9, 0xc6, 0xf7]);
    expect(new TextDecoder('gbk').decode(gbk)).toBe('扬声器');
    expect(gbk.toString('utf8')).toBe(String.fromCharCode(0xfffd).repeat(6));
  });
});

const describeOnWindows =
  process.platform === 'win32' ? describe : describe.skip;

describeOnWindows('through real PowerShell, as the app runs it', () => {
  /** One run of a script that prints the names it is handed, as JSON. */
  const roundTrip = async (dir: string, withStatement: boolean) => {
    const file = path.join(dir, withStatement ? 'with.ps1' : 'without.ps1');
    fs.writeFileSync(
      file,
      [
        'param()',
        ...(withStatement ? [UTF8_OUTPUT_STATEMENT] : []),
        // Handed over in the environment, which Windows keeps in UTF-16 the
        // whole way: only the answer travels through the code page.
        '$names = $env:FLUIDEQ_TEST_NAMES -split "`n"',
        '$page = [Console]::OutputEncoding.CodePage',
        'ConvertTo-Json -Compress -InputObject @{ page = $page; names = @($names) }',
      ].join('\r\n'),
    );
    const { stdout } = await execFileAsync(
      POWERSHELL_PATH,
      [
        '-NoLogo',
        '-NoProfile',
        '-NonInteractive',
        '-ExecutionPolicy',
        'Bypass',
        '-File',
        file,
      ],
      {
        windowsHide: true,
        env: { ...process.env, FLUIDEQ_TEST_NAMES: NAMES.join('\n') },
      },
    );
    return JSON.parse(stdout.trim()) as { page: number; names: string[] };
  };

  it('brings every name through a script, and only with the statement', async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'fluideq-ps-utf8-'));
    try {
      const fixed = await roundTrip(dir, true);
      expect(fixed.names).toEqual(NAMES);
      expect(fixed.page).toBe(65001);
      // Control: the same script without it loses the names — the bug,
      // reproduced — on any machine whose console is not already UTF-8.
      const control = await roundTrip(dir, false);
      const lost = JSON.stringify(control.names) !== JSON.stringify(NAMES);
      expect(control.page === 65001 || lost).toBe(true);
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  }, 60000);

  it('brings every name through an inline command made by utf8Command', async () => {
    const { stdout } = await execFileAsync(
      POWERSHELL_PATH,
      [
        '-NoProfile',
        '-NonInteractive',
        '-Command',
        utf8Command(
          'ConvertTo-Json -Compress -InputObject @($env:FLUIDEQ_TEST_NAMES -split "`n")',
        ),
      ],
      {
        windowsHide: true,
        env: { ...process.env, FLUIDEQ_TEST_NAMES: NAMES.join('\n') },
      },
    );
    expect(JSON.parse(stdout.trim())).toEqual(NAMES);
  }, 60000);
});
