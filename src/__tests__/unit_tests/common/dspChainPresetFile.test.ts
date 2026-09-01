/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import {
  DSP_DEFAULTS,
  IDspSettings,
  clampDspSettings,
} from '../../../common/dsp/chain';
import {
  fromDspChainPresetFile,
  toDspChainPresetFile,
} from '../../../common/dsp/dspChainPresetFile';

const fullChain = (): IDspSettings =>
  clampDspSettings({
    ...DSP_DEFAULTS,
    enabled: false,
    presetId: 'hand-tuned',
    normalizer: { ...DSP_DEFAULTS.normalizer, targetLufs: -16 },
    denoise: { ...DSP_DEFAULTS.denoise, enabled: true, isolate: true },
    eq: { ...DSP_DEFAULTS.eq, enabled: true, isolate: true, model: 'wide' },
    exciter: { ...DSP_DEFAULTS.exciter, enabled: true, isolate: true },
    bassForge: { ...DSP_DEFAULTS.bassForge, enabled: true, isolate: true },
    bassPunch: { ...DSP_DEFAULTS.bassPunch, enabled: true, isolate: true },
    dimension: { ...DSP_DEFAULTS.dimension, enabled: true, highWidth: 1.2 },
    compressor: { ...DSP_DEFAULTS.compressor, enabled: true },
    maximizer: { ...DSP_DEFAULTS.maximizer, enabled: true, ceilingDb: -1.2 },
    master: {
      ...DSP_DEFAULTS.master,
      enabled: true,
      matchedBypass: true,
    },
    crossfade: {
      ...DSP_DEFAULTS.crossfade,
      enabled: true,
      durationMs: 7_500,
    },
  });

describe('the shareable complete DSP chain file', () => {
  it('round-trips every filter and its enabled state', () => {
    const read = fromDspChainPresetFile(
      toDspChainPresetFile('My full chain', fullChain()),
    );
    if (!read) {
      throw new Error('a chain file this module wrote was not readable');
    }
    expect(read.name).toBe('My full chain');
    expect(read.settings.normalizer.targetLufs).toBe(-16);
    expect(read.settings.denoise.enabled).toBe(true);
    expect(read.settings.eq.model).toBe('wide');
    expect(read.settings.exciter.enabled).toBe(true);
    expect(read.settings.bassForge.enabled).toBe(true);
    expect(read.settings.bassPunch.enabled).toBe(true);
    expect(read.settings.dimension.highWidth).toBe(1.2);
    expect(read.settings.compressor.enabled).toBe(true);
    expect(read.settings.maximizer.ceilingDb).toBe(-1.2);
    expect(read.settings.master.matchedBypass).toBe(true);
  });

  it('leaves Crossfade and temporary monitor state out', () => {
    const read = fromDspChainPresetFile(
      toDspChainPresetFile('Portable', fullChain()),
    );
    expect(read?.settings.enabled).toBe(true);
    expect(read?.settings.presetId).toBe('');
    expect(read?.settings.crossfade).toEqual(DSP_DEFAULTS.crossfade);
    expect(read?.settings.denoise.isolate).toBe(false);
    expect(read?.settings.eq.isolate).toBe(false);
    expect(read?.settings.exciter.isolate).toBe(false);
    expect(read?.settings.bassForge.isolate).toBe(false);
    expect(read?.settings.bassPunch.isolate).toBe(false);
  });

  it('clamps hand-edited values before they reach audio', () => {
    const read = fromDspChainPresetFile(
      JSON.stringify({
        format: 'fluideq-dsp-chain',
        version: 1,
        name: 'Wild',
        dsp: {
          ...DSP_DEFAULTS,
          maximizer: { ...DSP_DEFAULTS.maximizer, ceilingDb: 50 },
          dimension: { ...DSP_DEFAULTS.dimension, highWidth: 90 },
        },
      }),
    );
    expect(read?.settings.maximizer.ceilingDb).toBeLessThan(50);
    expect(read?.settings.dimension.highWidth).toBeLessThan(90);
  });

  it('quietly rejects unrelated or incomplete JSON', () => {
    expect(fromDspChainPresetFile('')).toBe(undefined);
    expect(fromDspChainPresetFile('{ nope')).toBe(undefined);
    expect(fromDspChainPresetFile('{"format":"fluideq-preset"}')).toBe(
      undefined,
    );
    expect(
      fromDspChainPresetFile(
        '{"format":"fluideq-dsp-chain","version":1,"name":""}',
      ),
    ).toBe(undefined);
  });
});
