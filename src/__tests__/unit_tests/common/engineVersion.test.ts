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
import {
  ENGINE_CARRIED_SINCE,
  ENGINE_STATUS_SINCE,
  engineReportsCarried,
  engineReportsStatus,
  engineSupportsGameMode,
} from 'common/engineHealth';
import {
  supportsCurveComparison,
  supportsEqPhase,
} from 'common/curveComparison';
import {
  ENGINE_MATCHED_DESIGN_SINCE,
  ENGINE_TREBLE_CHOICE_SINCE,
  enginePlaysMatched,
  engineTakesTrebleChoice,
  groupPlaysMatched,
} from 'common/filterDesign';
import {
  ENGINE_RACK_TREBLE_SINCE,
  engineTakesRackTreble,
} from 'common/dsp/rackTreble';

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

describe('groupPlaysMatched', () => {
  it.each([
    ['1.14.0.0', 'precise', true],
    ['1.14.0.0', 'classic', false],
    // An engine that reads no choice plays what it always did: matched on
    // 1.13, the cookbook before it, whatever the file says.
    ['1.13.0.0', 'classic', true],
    ['1.13.0.0', 'precise', true],
    ['1.12.0.0', 'precise', false],
    [undefined, 'precise', false],
  ] as const)('%s, %s → %s', (version, choice, expected) => {
    expect(groupPlaysMatched(version, choice)).toBe(expected);
  });
});

describe('the engine this tree builds', () => {
  it('supports Game mode while older and unknown engines do not', () => {
    expect(engineSupportsGameMode(binaryVersion('FILEVERSION'))).toBe(true);
    expect(engineSupportsGameMode('1.9.0.0')).toBe(false);
    expect(engineSupportsGameMode(undefined)).toBe(false);
  });

  it('supports both official phase controls, unlike the experimental engine', () => {
    expect(supportsCurveComparison(binaryVersion('FILEVERSION'))).toBe(true);
    expect(supportsEqPhase(binaryVersion('FILEVERSION'))).toBe(true);
    expect(supportsCurveComparison('1.5.0.0')).toBe(false);
    expect(supportsEqPhase('1.5.0.0')).toBe(false);
  });
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

  it('carries a version the app trusts to say when sound reaches it', () => {
    // The gate the bypassed-engine card stands on: without it a status with
    // no `carried` in it would be read as "no audio has come" on every
    // machine still running an older engine, and the card would accuse a
    // working one.
    expect(engineReportsCarried(binaryVersion('FILEVERSION'))).toBe(true);
    const [major, minor] = ENGINE_CARRIED_SINCE;
    const below =
      minor > 0 ? `${major}.${minor - 1}.0.0` : `${major - 1}.99.0.0`;
    expect(engineReportsCarried(below)).toBe(false);
  });

  it('builds the bands it is asked to build analog-matched', () => {
    // The graph draws a layer matched only from this version on
    // (`useMatchedDesign`); an engine.rc left behind the gate would have the
    // graph draw the cookbook over an engine playing the matched shape.
    expect(enginePlaysMatched(binaryVersion('FILEVERSION'))).toBe(true);
    const [major, minor] = ENGINE_MATCHED_DESIGN_SINCE;
    expect(enginePlaysMatched(`${major}.${minor - 1}.0.0`)).toBe(false);
  });

  it('reads the Treble choice, which an engine a version older ignores', () => {
    // The menu offers the choice and the graph draws Classic only from this
    // version on; an engine.rc left behind the gate would have the menu
    // offering a switch the engine never reads.
    expect(engineTakesTrebleChoice(binaryVersion('FILEVERSION'))).toBe(true);
    const [major, minor] = ENGINE_TREBLE_CHOICE_SINCE;
    expect(engineTakesTrebleChoice(`${major}.${minor - 1}.0.0`)).toBe(false);
  });

  it('plays the rack EQ’s Treble choice, which an engine a version older ignores', () => {
    // The DSP EQ page offers the choice, and its graph draws Precise, only
    // from this version on; an engine.rc left behind the gate would draw a
    // shape the rack in the engine does not play.
    expect(engineTakesRackTreble(binaryVersion('FILEVERSION'))).toBe(true);
    const [major, minor] = ENGINE_RACK_TREBLE_SINCE;
    expect(engineTakesRackTreble(`${major}.${minor - 1}.0.0`)).toBe(false);
  });

  it('says the same version in both of its fields', () => {
    // The helper reads FILEVERSION; Explorer shows PRODUCTVERSION.
    expect(binaryVersion('PRODUCTVERSION')).toBe(binaryVersion('FILEVERSION'));
  });
});
