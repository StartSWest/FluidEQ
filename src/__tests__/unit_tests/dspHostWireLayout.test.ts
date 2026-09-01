/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { readFileSync } from 'fs';
import { join } from 'path';
import {
  ANALYSIS_BASS_FORGE_BANDS,
  ANALYSIS_BINS,
  ANALYSIS_HEADER_BYTES,
  ANALYSIS_MAX_BANDS,
  ANALYSIS_SCOPE_PAIRS,
  ANALYSIS_STAGES,
} from '../../common/dsp/analysisWire';
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

/**
 * The analysis frame's TAIL, which the sizes above deliberately cannot see.
 *
 * `FeqWireAnalysisFrame` is a fixed header followed by a variable payload:
 * spectra, then the scope window, then the per-band runs. The `static_assert`
 * covers the header alone, so moving any constant that sizes the TAIL leaves
 * `sizeof` exactly where it was — the guard above passes, the handshake accepts
 * the host, and the reader desynchronises on the first analysis frame.
 *
 * That failure has a known shape and it is not a readable one. `wire.h` names
 * it: "reported as diagnostic 3005 with magic 0, which names the symptom and
 * nothing about the cause." And `pnpm dev` does not rebuild the native host, so
 * a pull across such a change is exactly when it lands.
 *
 * These five numbers are written twice — once as a `#define` in the C++, once
 * as an exported constant in `analysisWire.ts` — and until now nothing compared
 * them. This is the other half of the compiler the suite does not have.
 */
const CORE_HEADERS: Record<string, string> = {
  meters: join(__dirname, '../../../native/dsp-core/include/fluideq/meters.h'),
  bassForge: join(
    __dirname,
    '../../../native/dsp-core/include/fluideq/bass_forge.h',
  ),
};

const defineOf = (header: keyof typeof CORE_HEADERS, name: string): number => {
  const source = readFileSync(CORE_HEADERS[header], 'utf8');
  const declared = new RegExp(`#define\\s+${name}\\s+(\\d+)\\b`).exec(source);
  if (!declared) {
    throw new Error(`no #define for ${name} in ${header}.h`);
  }
  return Number(declared[1]);
};

/**
 * `FEQ_METER_STAGE_COUNT` is the one that is not a `#define`.
 *
 * It is the final member of an anonymous enum, which is how the stage taps are
 * numbered — so it is read as an enumerator rather than a macro. Kept separate
 * rather than made general: a regex loose enough to match both forms would
 * match a great deal else besides, and a drift guard that matches the wrong
 * line is worse than none.
 */
const enumeratorOf = (name: string): number => {
  const source = readFileSync(CORE_HEADERS.meters, 'utf8');
  const declared = new RegExp(`${name}\\s*=\\s*(\\d+)`).exec(source);
  if (!declared) {
    throw new Error(`no enumerator ${name} in meters.h`);
  }
  return Number(declared[1]);
};

describe('the analysis payload constants both sides hard-code', () => {
  const cases: readonly [string, keyof typeof CORE_HEADERS, number][] = [
    ['FEQ_METER_BINS', 'meters', ANALYSIS_BINS],
    ['FEQ_METER_SCOPE_PAIRS', 'meters', ANALYSIS_SCOPE_PAIRS],
    ['FEQ_METER_MAX_BANDS', 'meters', ANALYSIS_MAX_BANDS],
    ['FEQ_BASS_FORGE_BANDS', 'bassForge', ANALYSIS_BASS_FORGE_BANDS],
  ];

  it.each(cases)(
    '%s is the value TypeScript expects',
    (name, header, expected) => {
      expect(defineOf(header, name)).toBe(expected);
    },
  );

  /**
   * The stage list's LENGTH is the constant, not any value in it.
   *
   * `ANALYSIS_STAGES` is a tuple whose order is the bit order of `stage_mask`,
   * so appending a stage in C++ without appending it here feeds every graph its
   * neighbour's spectrum rather than failing.
   */
  it('FEQ_METER_STAGE_COUNT matches the number of stages TypeScript names', () => {
    expect(enumeratorOf('FEQ_METER_STAGE_COUNT')).toBe(ANALYSIS_STAGES.length);
  });

  /**
   * The positive controls, one per reader.
   *
   * Without these the five above prove nothing: a regex that quietly matched
   * nothing would report five passes against a header the test never opened.
   * This is the same null-test trap the packing bug fell into, so both readers
   * are made to fail on a name that is not there.
   */
  it('fails loudly when a define it names is absent', () => {
    expect(() => defineOf('meters', 'FEQ_METER_NO_SUCH_THING')).toThrow(
      'no #define for FEQ_METER_NO_SUCH_THING in meters.h',
    );
  });

  it('fails loudly when an enumerator it names is absent', () => {
    expect(() => enumeratorOf('FEQ_METER_NO_SUCH_COUNT')).toThrow(
      'no enumerator FEQ_METER_NO_SUCH_COUNT in meters.h',
    );
  });
});
