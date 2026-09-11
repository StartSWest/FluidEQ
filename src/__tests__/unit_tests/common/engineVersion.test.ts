/** @jest-environment node */
/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * Which engine versions the app trusts to report what they are doing, and
 * the version the engine this tree builds actually carries — two files in
 * two languages that have to agree, or a working engine reads as "not
 * running" (the version too low) or a failing one reads as fine (the
 * minimum raised without the engine).
 */

import fs from 'fs';
import path from 'path';
import { ENGINE_STATUS_SINCE, engineReportsStatus } from 'common/engineHealth';

const ENGINE_RC = path.join(
  __dirname,
  '../../../../native/system-apo/src/engine.rc',
);

const binaryVersion = (field: 'FILEVERSION' | 'PRODUCTVERSION'): string => {
  const text = fs.readFileSync(ENGINE_RC, 'utf8');
  const match = new RegExp(
    `^${field}\\s+(\\d+)\\s*,\\s*(\\d+)\\s*,\\s*(\\d+)\\s*,\\s*(\\d+)`,
    'm',
  ).exec(text);
  if (!match) {
    throw new Error(`${field} not found in engine.rc`);
  }
  return match.slice(1, 5).join('.');
};

describe('engineReportsStatus', () => {
  it.each([
    ['1.1.0.0', true],
    ['1.1', true],
    ['1.2.0.0', true],
    ['1.10.0.0', true],
    ['2.0.0.0', true],
    // Every engine built before status files carried 1.0.0.0.
    ['1.0.0.0', false],
    ['0.9.0.0', false],
    ['', false],
    [undefined, false],
    ['1.1-beta', false],
    ['one.one', false],
  ])('%s → %s', (version, expected) => {
    expect(engineReportsStatus(version)).toBe(expected);
  });
});

describe('the engine this tree builds', () => {
  it('carries a version the app trusts to report', () => {
    expect(engineReportsStatus(binaryVersion('FILEVERSION'))).toBe(true);
  });

  it('is not trusted a version early', () => {
    // Positive control for the one above: the version just below the
    // minimum is refused, so passing it means the minimum was checked.
    const [major, minor] = ENGINE_STATUS_SINCE;
    const below =
      minor > 0 ? `${major}.${minor - 1}.0.0` : `${major - 1}.99.0.0`;
    expect(engineReportsStatus(below)).toBe(false);
  });

  it('says the same version in both of its fields', () => {
    // The helper reads FILEVERSION; Explorer shows PRODUCTVERSION.
    expect(binaryVersion('PRODUCTVERSION')).toBe(binaryVersion('FILEVERSION'));
  });
});
