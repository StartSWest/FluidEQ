/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { readFileSync } from 'fs';
import { join } from 'path';
import { ANALYSIS_HEADER_BYTES } from '../../common/dsp/analysisWire';
import {
  ACK_BYTES,
  COMMAND_BYTES,
  HANDSHAKE_BYTES,
  TELEMETRY_BYTES,
} from '../../main/dspHost/wire';

/**
 * Every frame size TypeScript states twice, read back out of the C++.
 *
 * `wire.ts` says it plainly: these are "the same numbers written a second
 * time, because a TypeScript decoder cannot ask a C compiler what `sizeof`
 * returned". The C++ side pins each one with a `static_assert`, so a struct
 * that grows fails to compile — but nothing failed when the TYPESCRIPT copy
 * was the one left behind, which is how `CHAIN_PARAM_LEAD` sat at 69 through
 * two bumps to 77.
 *
 * A wrong size here does not throw. The decoders read at fixed byte offsets,
 * so a frame that grew on one side only is decoded into the previous layout
 * and hands the panel whatever float now sits where the old field was — a
 * number that is wrong and entirely plausible. The analysis frame is the worst
 * of them: its only length checks are floors, with nothing upstream checking
 * it exactly the way `isChainWirePayload` covers the chain.
 *
 * This is a compiler the test suite does not have, spelled as a regex.
 */
const WIRE_HEADER = join(__dirname, '../../../native/dsp-host/src/wire.h');

const sizeOf = (struct: string): number => {
  const source = readFileSync(WIRE_HEADER, 'utf8');
  const declared = new RegExp(
    `static_assert\\(sizeof\\(${struct}\\)\\s*==\\s*(\\d+)`,
  ).exec(source);
  if (!declared) {
    throw new Error(`no size assertion for ${struct} in wire.h`);
  }
  return Number(declared[1]);
};

describe('the frame sizes both sides hard-code', () => {
  it.each([
    ['FeqWireHandshake', () => HANDSHAKE_BYTES],
    ['FeqWireCommandFrame', () => COMMAND_BYTES],
    ['FeqWireAckFrame', () => ACK_BYTES],
    ['FeqWireTelemetryFrame', () => TELEMETRY_BYTES],
    ['FeqWireAnalysisFrame', () => ANALYSIS_HEADER_BYTES],
  ])('%s is the size TypeScript expects', (struct, expected) => {
    expect(sizeOf(struct)).toBe(expected());
  });

  /**
   * The positive control, without which the five above prove nothing.
   *
   * A regex that quietly matched nothing would report five passes for a header
   * this test never read — the same shape of null result as a parity suite that
   * skips what it cannot check.
   */
  it('fails loudly when a struct it names is not asserted', () => {
    expect(() => sizeOf('FeqWireNoSuchFrame')).toThrow(
      'no size assertion for FeqWireNoSuchFrame',
    );
  });
});
