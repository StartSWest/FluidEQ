/* FluidEQ — GPL-3.0-or-later */
import { DSP_DEFAULTS } from '../../../common/dsp/chain';
import { DSP_PRESETS, dspPresetSettings } from '../../../common/dsp/presets';
import { DE_ESSER_CATALOGUE } from '../../../common/dsp/stageCatalogues';
import { normalizerGainDb } from '../../../renderer/dsp/inputNormalizer';
import {
  curveGainDb,
  genreNotesFor,
} from '../../../renderer/dsp/genreNotesModel';

const kpop = () => {
  const preset = DSP_PRESETS.find(({ id }) => id === 'kPop');
  if (!preset?.curve) {
    throw new Error('K-pop factory curve is missing');
  }
  return { settings: preset.settings, curve: preset.curve };
};

describe('K-pop reference playback', () => {
  it('feeds the creative stages at the original level of each recording', () => {
    const { settings } = kpop();
    const inputLevels = [-28, -18, -8];
    inputLevels.forEach((maxShortTermLufs) => {
      const gain = normalizerGainDb(settings.normalizer, {
        version: 3,
        integratedLufs: maxShortTermLufs - 2,
        maxShortTermLufs,
        truePeakDbtp: maxShortTermLufs + 6,
      });
      expect(gain).toBe(0);
    });
    expect(settings.normalizer.mode).toBe('off');
    expect(settings.maximizer.enabled).toBe(true);
    expect(settings.maximizer.ceilingDb).toBe(-1);
    expect(settings.master.enabled).toBe(false);
    expect(settings.dynamics.enabled).toBe(false);
  });

  it('keeps audible kick weight without hollowing the voice or boosting its sharp range', () => {
    const { curve, settings } = kpop();
    expect(curveGainDb(curve, 80)).toBeGreaterThan(1.5);
    expect(curveGainDb(curve, 315)).toBeGreaterThan(-1.6);
    expect(curveGainDb(curve, 500)).toBeGreaterThan(-1.3);
    [3150, 5000, 8000].forEach((hz) => {
      expect(curveGainDb(curve, hz)).toBeLessThan(0.2);
    });
    expect(settings.exciter.bands.every(({ enabled }) => !enabled)).toBe(true);
    expect(settings.dimension.midWidth).toBe(1);
    expect(settings.dimension.decorrelation).toBe(0);
    expect(settings.bassForge.enabled).toBe(false);
  });

  it('replaces an aggressive previous de-esser with its own gentle full-mix profile', () => {
    const settings = dspPresetSettings('kPop', {
      ...DSP_DEFAULTS,
      deEsser: {
        ...DSP_DEFAULTS.deEsser,
        enabled: true,
        isolate: true,
        mode: 'whole',
        rangeDb: 18,
      },
    });
    expect(settings?.deEsser).toEqual(
      DE_ESSER_CATALOGUE.settings('kPop', true),
    );
    expect(settings?.deEsser).toMatchObject({
      enabled: true,
      presetId: 'kPop',
      isolate: false,
      mode: 'spectral',
      centreOnly: true,
    });
    expect(settings?.deEsser.rangeDb).toBeLessThanOrEqual(1.5);
    expect(settings?.deEsser.sensitivity).toBeLessThanOrEqual(0.15);
    expect(genreNotesFor('kPop')?.stagesOn).toContain('deEsser');
    const none = dspPresetSettings('empty', settings);
    expect(none?.normalizer.mode).toBe('off');
    expect(none?.deEsser.enabled).toBe(false);
  });
});
