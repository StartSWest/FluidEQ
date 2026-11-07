/* Copyright (C) 2026 Ivan Carmenates Garcia. SPDX-License-Identifier: GPL-3.0-or-later */

import fs from 'fs';
import os from 'os';
import path from 'path';
import ts from 'typescript';

it('type-checks source, unit tests and the capture harness without QA outputs', () => {
  const fixture = fs.mkdtempSync(path.join(os.tmpdir(), 'fluideq-typecheck-'));
  try {
    const sourceFiles = [
      'src/main/main.ts',
      'src/__tests__/unit_tests/main/gameSound.test.ts',
      'scripts/help-captures/harness/index.ts',
    ];
    const fixtureFiles = [...sourceFiles, 'outputs/browser/bootstrap.js'];
    fixtureFiles.forEach((file) => {
      const absolute = path.join(fixture, file);
      fs.mkdirSync(path.dirname(absolute), { recursive: true });
      fs.writeFileSync(absolute, '');
    });

    const configPath = path.resolve(__dirname, '../../../../tsconfig.json');
    const { config, error } = ts.readConfigFile(configPath, ts.sys.readFile);
    expect(error).toBeUndefined();
    const { fileNames, errors } = ts.parseJsonConfigFileContent(
      config,
      ts.sys,
      fixture,
    );
    expect(errors).toEqual([]);
    expect(
      fileNames
        .map((file) => path.relative(fixture, file).split(path.sep).join('/'))
        .sort(),
    ).toEqual(sourceFiles.sort());
  } finally {
    fs.rmSync(fixture, { recursive: true, force: true });
  }
});
