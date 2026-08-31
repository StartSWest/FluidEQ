/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { readFileSync } from 'fs';
import { join } from 'path';
import { DSP_DEFAULTS, IEqSettings } from '../../common/dsp/chain';
import { FilterTypeEnum } from '../../common/constants';
import {
  CHAIN_BAND_PARAMS,
  CHAIN_PARAM_LEAD,
  chainWireLength,
  encodeChainSettings,
  isChainWirePayload,
} from '../../common/dsp/chainWire';

const withBands = (count: number) => ({
  ...DSP_DEFAULTS,
  eq: {
    ...DSP_DEFAULTS.eq,
    bands: Array.from({ length: count }, (_unused, index) => ({
      enabled: true,
      dynamic: false,
      thresholdDb: -24,
      type: FilterTypeEnum.PK,
      frequency: 100 * (index + 1),
      gainDb: index,
      quality: 1,
    })) as IEqSettings['bands'],
  },
});

describe('the chain wire layout', () => {
  /**
   * The one number both sides of the wire hard-code.
   *
   * `FEQ_CHAIN_PARAM_LEAD` in `fluideq/chain.h` holds it too, and neither side
   * can ask the other. The value itself is deliberately not written out here:
   * it said 69 while both sides had long since agreed on 77, which is a
   * comment that would have been believed by anybody checking the two numbers
   * matched. A scalar added to the encoder and forgotten in the C++ does not
   * crash — it shifts every EQ band along by one field, so a Q becomes a
   * threshold and a frequency becomes a gain, and the result decodes into a
   * chain that is wrong and plausible. This is the check that catches it before
   * the parity suite has to.
   */
  it('puts exactly the documented number of scalars before the bands', () => {
    const encoded = encodeChainSettings(withBands(0));

    expect(encoded).toHaveLength(CHAIN_PARAM_LEAD);
    expect(encoded[CHAIN_PARAM_LEAD - 1]).toBe(0);
  });

  /**
   * The header is the other half of the contract, so read it rather than trust
   * a comment about it.
   *
   * Nothing in TypeScript can fail when the C++ moves and this does not, which
   * is exactly how `src/main/dspHost/wire.ts` sat at 69 through two bumps: it
   * held a third copy of the number whose only check was weaker than one the
   * caller had already passed. That copy is gone — main imports the same
   * constant now — and this is what stops a fourth appearing.
   */
  it('agrees with FEQ_CHAIN_PARAM_LEAD in the C++ header', () => {
    const header = readFileSync(
      join(__dirname, '../../../native/dsp-core/include/fluideq/chain.h'),
      'utf8',
    );
    const declared = /#define\s+FEQ_CHAIN_PARAM_LEAD\s+(\d+)/.exec(header);

    expect(declared).not.toBeNull();
    expect(Number(declared?.[1])).toBe(CHAIN_PARAM_LEAD);
  });

  it('appends seven fields per band, and says how many there are', () => {
    const encoded = encodeChainSettings(withBands(5));

    expect(encoded[CHAIN_PARAM_LEAD - 1]).toBe(5);
    expect(encoded).toHaveLength(CHAIN_PARAM_LEAD + 5 * CHAIN_BAND_PARAMS);
    expect(encoded).toHaveLength(chainWireLength(5));
  });

  it('carries each band in the order the decoder reads it', () => {
    const encoded = encodeChainSettings(withBands(2));
    const second = encoded.slice(
      CHAIN_PARAM_LEAD + CHAIN_BAND_PARAMS,
      CHAIN_PARAM_LEAD + 2 * CHAIN_BAND_PARAMS,
    );

    // enabled, type index, frequency, gain, Q, dynamic, threshold.
    expect(second).toEqual([1, 0, 200, 1, 1, 0, -24]);
  });

  it('carries both bass stages in the lead', () => {
    const encoded = encodeChainSettings({
      ...DSP_DEFAULTS,
      bassForge: { ...DSP_DEFAULTS.bassForge, enabled: true, mix: 0.7 },
      bassPunch: { ...DSP_DEFAULTS.bassPunch, enabled: true, duck: 0.4 },
    });

    expect(encoded).toHaveLength(
      CHAIN_PARAM_LEAD + DSP_DEFAULTS.eq.bands.length * CHAIN_BAND_PARAMS,
    );
    // A length check alone passes whether or not the fourteen scalars are on
    // the wire at all, so read them where the decoder reads them: the last
    // fifteen lead slots are Forge's seven, Punch's seven, and the band count.
    expect(encoded.slice(CHAIN_PARAM_LEAD - 15, CHAIN_PARAM_LEAD - 1)).toEqual([
      1, 90, 0, 0, 0, 0.8, 0.7, 1, 110, 0, 0, 0, 120, 0.4,
    ]);
    // The band count stays in the last lead slot. If the new scalars were
    // appended after it instead of before, this reads 0.7 and every band that
    // follows is one slot out.
    expect(encoded[CHAIN_PARAM_LEAD - 1]).toBe(DSP_DEFAULTS.eq.bands.length);
    expect(isChainWirePayload(encoded)).toBe(true);
  });

  it('carries the maximum rack the app allows', () => {
    // Sixty-four bands is the reason this is not a flat scalar table. If the
    // encoder ever silently truncated, this is where it would show.
    const encoded = encodeChainSettings(withBands(64));

    expect(encoded[CHAIN_PARAM_LEAD - 1]).toBe(64);
    expect(isChainWirePayload(encoded)).toBe(true);
  });

  describe('what the IPC boundary refuses', () => {
    /**
     * Main validates even though the renderer built it.
     *
     * Not distrust of our own code: the renderer also loads remote content,
     * and the boundary is where "already checked" stops being a fact.
     */
    it('refuses a payload shorter than the lead', () => {
      expect(isChainWirePayload(new Array(CHAIN_PARAM_LEAD - 1).fill(0))).toBe(
        false,
      );
    });

    it('refuses a payload whose length contradicts its own band count', () => {
      const encoded = encodeChainSettings(withBands(3));
      // A message truncated in transit still declares three bands. Decoded
      // without this check it would be a rack of two and a half.
      expect(isChainWirePayload(encoded.slice(0, encoded.length - 1))).toBe(
        false,
      );
    });

    it('refuses a payload carrying anything that is not a finite number', () => {
      const encoded = encodeChainSettings(withBands(1));
      const withNan = [...encoded];
      withNan[10] = Number.NaN;

      expect(isChainWirePayload(withNan)).toBe(false);
      expect(isChainWirePayload([...encoded.slice(0, -1), '1'])).toBe(false);
    });

    it('refuses anything that is not an array at all', () => {
      expect(isChainWirePayload(undefined)).toBe(false);
      expect(isChainWirePayload({ length: 200 })).toBe(false);
    });
  });

  it('carries the output-safety A/B rather than leaving it to a build flag', () => {
    // The whole value of that switch is flipping it while the same audio
    // plays, which a compile-time flag cannot do.
    const on = encodeChainSettings(DSP_DEFAULTS);
    const off = encodeChainSettings(DSP_DEFAULTS, {
      outputSafetyEnabled: false,
    });

    expect(on[1]).toBe(1);
    expect(off[1]).toBe(0);
  });
});
