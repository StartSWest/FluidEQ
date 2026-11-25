/* FluidEQ — GPL-3.0-or-later */
/**
 * Dance-pop (Ivan, 2026-11-25: "There is a new genre, dance pop ... Demi
 * Lovato, for example, is that genre"). Its own rack and curve, held to the
 * research its notes quote and kept audibly apart from Pop and EDM, the two
 * chains it sits between.
 */
import type { IEqSettings } from '../../../common/dsp/chain';
import { GENRE_RACKS } from '../../../common/dsp/genres';
import { inGenreChain } from '../../../common/dsp/genreRack';
import { GENRE_NOTES } from '../../../common/dsp/genreNotes';
import { DSP_PRESETS } from '../../../common/dsp/presets';
import { curveGainDb } from '../../../renderer/dsp/genreNotesModel';
import musicAudit from '../../../../docs/dsp/music-reference-audit.json';

const chainOf = (id: string) => {
  const chain = DSP_PRESETS.find((preset) => preset.id === id);
  if (!chain?.curve) {
    throw new Error(`no chain with a curve for ${id}`);
  }
  return { settings: chain.settings, curve: chain.curve };
};
const rack = GENRE_RACKS.find((one) => one.id === 'dancePop');
const dance = chainOf('dancePop');
const pop = chainOf('pop');
const edm = chainOf('edm');

/** Third-octave centres from the sub to the air, as the notes' pins read. */
const CENTRES = [
  32, 40, 50, 63, 80, 100, 125, 160, 200, 250, 315, 400, 500, 630, 800, 1000,
  1250, 1600, 2000, 2500, 3150, 4000, 5000, 6300, 8000, 10000, 12500, 16000,
];
const widestGap = (a: IEqSettings, b: IEqSettings) =>
  Math.max(
    ...CENTRES.map((hz) => Math.abs(curveGainDb(a, hz) - curveGainDb(b, hz))),
  );

describe('Dance-pop', () => {
  it('sits beside Pop and names two dance-pop records', () => {
    const genres = DSP_PRESETS.filter((one) => one.group === 'genre').map(
      (one) => one.id,
    );
    expect(genres.slice(0, 2)).toEqual(['pop', 'dancePop']);
    expect(GENRE_NOTES.dancePop.listen).toEqual([
      'Neon Lights — Demi Lovato',
      'Padam Padam — Kylie Minogue',
    ]);
  });

  it('generates nothing: no Bass Forge at all, and its Exciter only offered', () => {
    if (!rack) {
      throw new Error('no Dance-pop rack');
    }
    expect(rack.bassForge).toBeUndefined();
    expect(dance.settings.bassForge.enabled).toBe(false);
    expect(inGenreChain(rack, 'exciter')).toBe(false);
    expect(dance.settings.exciter.enabled).toBe(false);
    // What it offers is the air band alone, never low-band harmonics.
    expect(rack.exciter?.bands.map((band) => band.enabled)).toEqual([
      false,
      false,
      true,
    ]);
  });

  it('leaves the kick as mastered, the centre unwidened and the bass mono', () => {
    const { bassPunch, dimension, eq, maximizer } = dance.settings;
    expect(bassPunch.enabled).toBe(true);
    expect(bassPunch.attack).toBe(0);
    expect(bassPunch.bloomAmount).toBe(0);
    expect(bassPunch.sustain).toBeLessThan(0);
    expect(dimension.decorrelation).toBe(0);
    expect(dimension.midWidth).toBe(1);
    expect(dimension.highHz).toBeGreaterThanOrEqual(7_000);
    expect(dimension.highWidth).toBeGreaterThan(
      pop.settings.dimension.highWidth,
    );
    expect(eq.monoBelowHz).toBe(120);
    expect(maximizer.ceilingDb).toBe(-1);
    expect(maximizer.releaseMs).toBeLessThan(250);
  });

  it('leans the way dance-pop records do, against Pop', () => {
    const at = (curve: IEqSettings, hz: number) => curveGainDb(curve, hz);
    // The kick over a sub left as mastered, where Pop lifts its sub.
    expect(at(dance.curve, 80)).toBeGreaterThan(1.2);
    expect(at(dance.curve, 32)).toBeLessThan(at(pop.curve, 32) - 0.5);
    expect(at(dance.curve, 50)).toBeLessThan(0.5);
    // The low mids cleared for the kick and the voice.
    expect(at(dance.curve, 315)).toBeLessThan(-1);
    // A forward voice and an airy top, its sibilance never lifted.
    expect(at(dance.curve, 3_150)).toBeGreaterThan(at(pop.curve, 3_150) + 0.4);
    expect(at(dance.curve, 12_500)).toBeGreaterThan(
      at(pop.curve, 12_500) + 0.5,
    );
    expect(at(dance.curve, 8_000)).toBeLessThan(0);
  });

  it('is audibly neither Pop nor EDM, and the measure can say "the same"', () => {
    expect(widestGap(dance.curve, pop.curve)).toBeGreaterThan(1.2);
    expect(widestGap(dance.curve, edm.curve)).toBeGreaterThan(1.2);
    expect(widestGap(dance.curve, dance.curve)).toBe(0);
  });

  it('was measured on its own two records within the limiter budget', () => {
    const measured = musicAudit.genres.find((one) => one.id === 'dancePop');
    expect(measured?.maximizerDriveDb).toBe(dance.settings.maximizer.driveDb);
    expect(measured?.references.map((one) => one.reference)).toEqual(
      GENRE_NOTES.dancePop.listen,
    );
    measured?.references.forEach((reference) => {
      expect(reference.limiterLossLu).toBeLessThanOrEqual(0.686);
      expect(reference.outputTruePeakDbtp).toBeLessThanOrEqual(-0.99);
    });
  });
});
