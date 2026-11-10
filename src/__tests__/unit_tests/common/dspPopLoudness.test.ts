/* FluidEQ — GPL-3.0-or-later */
import { DSP_DEFAULTS } from '../../../common/dsp/chain';
import { GENRE_RACKS } from '../../../common/dsp/genres';
import { genreMeasuredSongs } from '../../../common/dsp/genreEvidence';
import { GENRE_NOTES } from '../../../common/dsp/genreNotes';
import { DSP_PRESETS, dspPresetSettings } from '../../../common/dsp/presets';
import { curveGainDb } from '../../../renderer/dsp/genreNotesModel';
import { normalizerGainDb } from '../../../renderer/dsp/inputNormalizer';

const pop = () => {
  const settings = dspPresetSettings('pop');
  if (!settings) {
    throw new Error('Pop preset is missing');
  }
  return settings;
};

describe('Pop source loudness', () => {
  it('names the reference recordings and reports their own measurement count', () => {
    expect(GENRE_NOTES.pop.listen).toEqual([
      'Blinding Lights — The Weeknd',
      'Levitating — Dua Lipa',
    ]);
    expect(genreMeasuredSongs('pop')).toBe(GENRE_NOTES.pop.listen.length);
    GENRE_RACKS.forEach((rack) => {
      expect({
        id: rack.id,
        hasReference: GENRE_NOTES[rack.id]?.listen.length > 0,
      }).toEqual({ id: rack.id, hasReference: true });
    });
  });

  it('uses the original file level and still allows deliberate normalization', () => {
    const settings = pop();
    [0, -12, -18].forEach((offsetDb) => {
      const analysis = {
        version: 3 as const,
        integratedLufs: -7.724464443981443 + offsetDb,
        maxShortTermLufs: -6.5 + offsetDb,
        truePeakDbtp: 1.0001233328098738 + offsetDb,
      };
      expect(normalizerGainDb(settings.normalizer, analysis)).toBe(0);
      const manualGain = normalizerGainDb(
        { ...settings.normalizer, mode: 'loudness', truePeakDbtp: -10 },
        analysis,
      );
      expect(manualGain).not.toBe(0);
      expect(analysis.truePeakDbtp + manualGain).toBeLessThan(-10);
    });
  });

  it('uses a fixed final drive and a single peak ceiling', () => {
    const settings = pop();
    expect(settings.normalizer.mode).toBe('off');
    expect(settings.maximizer.driveDb).toBeLessThan(0);
    expect(settings.maximizer.enabled).toBe(true);
    expect(settings.maximizer.ceilingDb).toBe(-1);
    expect(settings.master.enabled).toBe(false);
    expect(settings.dynamics.enabled).toBe(false);
  });

  it('keeps vocal body and uses a small presence lift without treble excitation', () => {
    const curve = DSP_PRESETS.find((preset) => preset.id === 'pop')?.curve;
    if (!curve) {
      throw new Error('Pop curve is missing');
    }
    expect(curveGainDb(curve, 315)).toBeGreaterThan(-2);
    expect(curveGainDb(curve, 500)).toBeGreaterThan(-1.5);
    [3150, 5000, 8000].forEach((frequency) => {
      expect(curveGainDb(curve, frequency)).toBeGreaterThan(0);
      expect(curveGainDb(curve, frequency)).toBeLessThan(1);
    });
    const settings = pop();
    expect(settings.exciter.bands[2].enabled).toBe(false);
    expect(settings.dimension.decorrelation).toBe(0);
  });

  it('resets both adaptive level stages on every factory selection', () => {
    const previous = {
      ...pop(),
      normalizer: { ...DSP_DEFAULTS.normalizer, mode: 'loudness' as const },
      master: { ...DSP_DEFAULTS.master, enabled: true, loudnessMaximize: true },
    };
    expect(DSP_PRESETS).toHaveLength(118);
    DSP_PRESETS.forEach(({ id, settings }) => {
      const next = dspPresetSettings(id, previous);
      expect(next?.normalizer).toEqual(DSP_DEFAULTS.normalizer);
      expect(next?.master.enabled).toBe(false);
      expect(next?.maximizer).toEqual(settings.maximizer);
    });
  });
});
