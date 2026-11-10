/* FluidEQ — GPL-3.0-or-later */
import path from 'path';
import recorded from '../../../../docs/dsp/music-reference-audit.json';
import {
  musicConfigurationSha256,
  musicProcessingSources,
} from '../../../../.erb/scripts/music-dsp-evidence';
import { DSP_DEFAULTS } from '../../../common/dsp/chain';
import { DE_ESSER_PRESETS } from '../../../common/dsp/deEsserPresets';
import { DE_ESSER_CATALOGUE } from '../../../common/dsp/stageCatalogues';
import { GENRE_RACKS, genreChainId } from '../../../common/dsp/genres';
import { inGenreChain } from '../../../common/dsp/genreRack';
import { DSP_PRESETS, dspPresetSettings } from '../../../common/dsp/presets';
import { genreNotesFor } from '../../../renderer/dsp/genreNotesModel';

describe('transparent Pop playback', () => {
  it('selects its named de-esser, with a restrained cut and no monitor inheritance', () => {
    const previous = {
      ...DSP_DEFAULTS,
      deEsser: {
        ...DSP_DEFAULTS.deEsser,
        enabled: true,
        isolate: true,
        rangeDb: 18,
        mode: 'whole' as const,
      },
    };
    const pop = dspPresetSettings('pop', previous);
    expect(pop?.deEsser).toMatchObject({
      enabled: true,
      presetId: 'pop',
      isolate: false,
      mode: 'spectral',
      centreOnly: true,
    });
    expect(pop?.deEsser.rangeDb).toBeLessThanOrEqual(1.5);
    expect(pop?.deEsser.sensitivity).toBeLessThanOrEqual(0.15);
    expect(DE_ESSER_CATALOGUE.settings('pop', true)).toEqual(pop?.deEsser);
    expect(genreNotesFor('pop')?.stagesOn).toContain('deEsser');
  });

  it('retains the approved body while leaving treble excitation and Dynamics off', () => {
    const pop = dspPresetSettings('pop');
    expect(pop?.exciter.enabled).toBe(true);
    expect(pop?.exciter.bands[2].enabled).toBe(false);
    expect(pop?.bassForge.enabled).toBe(false);
    expect(pop?.dynamics.enabled).toBe(false);
    expect(pop?.master.enabled).toBe(false);
    expect(pop?.maximizer.ceilingDb).toBe(-1);
    expect(genreNotesFor('pop')?.stagesOn).toContain('exciter');
  });

  it('keeps its measured body return gentle and within the approved reference sound', () => {
    const preset = DSP_PRESETS.find((one) => one.id === 'pop');
    const measured = recorded.genres.find((one) => one.id === 'pop');
    if (!preset || !measured) {
      throw new Error('Pop and its native reference measurements are required');
    }
    // The old 12% return covered a wider input band. A raw mix limit cannot
    // compare that with the corrected filter's narrower band. Hold the actual
    // effect instead, and reject evidence for different code or configuration.
    expect(recorded.processingSources).toEqual(
      musicProcessingSources(path.resolve(__dirname, '../../../..')),
    );
    expect(measured.configurationSha256).toBe(musicConfigurationSha256(preset));
    const exciter = measured.stageEffects.find(
      (one) => one.stage === 'exciter',
    );
    if (!exciter) {
      throw new Error('Pop requires an independently rendered Exciter bypass');
    }
    expect(exciter.loudnessDeltaLu).toHaveLength(2);
    expect(exciter.foregroundDeltaLu).toHaveLength(2);
    [...exciter.loudnessDeltaLu, ...exciter.foregroundDeltaLu].forEach(
      (delta) => {
        // A muted return must fail too: both recordings retain a small effect.
        expect(delta).toBeGreaterThan(0.005);
        expect(delta).toBeLessThanOrEqual(0.1);
      },
    );

    const comparison = recorded.approvalComparison;
    expect(comparison.approvedCheckpoint).toBe(
      '130b69ff78ab813759594829fa06f859fd2f94a2',
    );
    expect(comparison.curvesUnchanged).toBe(true);
    expect(preset.curve?.bands.map((one) => one.gainDb)).toEqual([
      1, 0.8, 1, 0.4, -0.6, -1.3, -0.8, -0.2, 0, 0.2, 0.5, 0.5, 0.4, 0.3, 0.1,
    ]);
    const controls = comparison.controls.filter((one) => one.genre === 'pop');
    expect(measured.references.map((one) => one.reference)).toEqual([
      'Blinding Lights — The Weeknd',
      'Levitating — Dua Lipa',
    ]);
    expect(controls.map((one) => one.reference)).toEqual(
      measured.references.map((one) => one.reference),
    );
    controls.forEach((control, index) => {
      expect(control.rawRevised.integratedLufs).toBeCloseTo(
        measured.references[index].outputLufs,
        7,
      );
      expect(control.rawRevised.truePeakDbtp).toBeCloseTo(
        measured.references[index].outputTruePeakDbtp,
        7,
      );
      // The original-level pass has different gain. Preserve the body's
      // spectrum and dynamics after compensating that level difference.
      expect(control.loudnessDeltaLu).toBeCloseTo(
        control.rawRevised.integratedLufs - control.rawApproved.integratedLufs,
        7,
      );
      expect(control.loudnessDeltaLu).toBeGreaterThanOrEqual(-0.5);
      Object.values(control.levelMatchedSpectrumDeltaDb).forEach((delta) =>
        expect(Math.abs(delta)).toBeLessThanOrEqual(0.75),
      );
      expect(Math.abs(control.crestDeltaDb)).toBeLessThanOrEqual(0.75);
      expect(control.phraseContrastDeltaDb).toBeGreaterThanOrEqual(-0.25);
    });
  });

  it('selects another genre’s own de-esser instead of carrying Pop into it', () => {
    const previous = dspPresetSettings('pop');
    GENRE_RACKS.filter((rack) => rack.id !== 'pop').forEach((rack) => {
      expect(
        dspPresetSettings(genreChainId(rack), previous)?.deEsser.enabled,
      ).toBe(inGenreChain(rack, 'deEsser'));
      expect(dspPresetSettings(genreChainId(rack), previous)?.deEsser).toEqual(
        inGenreChain(rack, 'deEsser')
          ? DE_ESSER_CATALOGUE.settings(rack.id, true)
          : { ...DSP_DEFAULTS.deEsser, enabled: false },
      );
    });
    expect(dspPresetSettings('empty', previous)?.deEsser.enabled).toBe(false);
  });

  it('caps the music root profiles while keeping their frequency-selective processing', () => {
    DE_ESSER_PRESETS.filter((preset) => preset.group === 'music').forEach(
      (preset) => {
        expect(preset.settings.rangeDb).toBeLessThanOrEqual(3);
        expect(preset.settings.sensitivity).toBeLessThanOrEqual(0.35);
        expect(preset.settings.mode).toBe('spectral');
        expect(preset.settings.keepCymbals).toBeGreaterThanOrEqual(0.85);
      },
    );
  });
});
