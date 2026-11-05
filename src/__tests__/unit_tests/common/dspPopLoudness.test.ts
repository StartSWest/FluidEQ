/* FluidEQ — GPL-3.0-or-later */
import { DSP_DEFAULTS } from '../../../common/dsp/chain';
import { GENRE_RACKS, genreChainId } from '../../../common/dsp/genres';
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

  it('feeds the same song at one level regardless of its file volume', () => {
    const settings = pop();
    const levels = [0, -12, -18].map((offsetDb) => {
      const analysis = {
        version: 2 as const,
        integratedLufs: -7.724464443981443 + offsetDb,
        truePeakDbtp: 1.0001233328098738 + offsetDb,
      };
      const gain = normalizerGainDb(settings.normalizer, analysis);
      // Gain alone brings the whole song to one level; its crest factor is
      // unchanged and its peaks leave room for Pop's processing.
      expect(analysis.truePeakDbtp + gain).toBeLessThan(-3);
      const withoutNormalization = normalizerGainDb(
        { ...settings.normalizer, mode: 'off' },
        analysis,
      );
      expect(withoutNormalization).toBe(0);
      return {
        normalized: analysis.integratedLufs + gain,
        untouched: analysis.integratedLufs + withoutNormalization,
      };
    });
    levels.forEach((level) => expect(level.normalized).toBeCloseTo(-18, 8));
    // The former unnormalised inputs differ by eighteen LU.
    const untouched = levels.map((level) => level.untouched);
    expect(Math.max(...untouched) - Math.min(...untouched)).toBeCloseTo(18, 8);
  });

  it('raises the common input towards Pop level with one final ceiling', () => {
    const settings = pop();
    expect(settings.normalizer.mode).toBe('loudness');
    expect(settings.normalizer.targetLufs + settings.maximizer.driveDb).toBe(
      -11,
    );
    expect(settings.maximizer.enabled).toBe(true);
    expect(settings.maximizer.ceilingDb).toBe(-1);
    expect(settings.master.enabled).toBe(false);
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

  it('uses each genre’s own input level instead of inheriting Pop normalization', () => {
    const previous = pop();
    GENRE_RACKS.filter((rack) => rack.id !== 'pop').forEach((rack) => {
      const next = dspPresetSettings(genreChainId(rack), previous);
      expect({ id: rack.id, mode: next?.normalizer.mode }).toEqual({
        id: rack.id,
        mode: rack.normalizer?.mode ?? 'off',
      });
      expect(next?.normalizer).toEqual(
        rack.normalizer ?? { ...DSP_DEFAULTS.normalizer, mode: 'off' },
      );
    });
    expect(dspPresetSettings('empty', previous)?.normalizer.mode).toBe('off');
  });
});
