/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * A genre's notes say what its preset does, so they are held to the preset.
 *
 * The first notes were written by hand from the research, and on 2026-09-24
 * Ivan asked whether the DSP really honoured them. It did not: seventeen said
 * "mono under 150 Hz" where the rack only narrowed the side to half, Trap's
 * research forbids lifting 30-60 Hz and its curve lifted 50 Hz by 1.5 dB,
 * Metal's pin said "nothing boosted under 75 Hz" over +0.7 dB at 63, two
 * ceilings called slow let go within a sixteenth, and "the widest in the
 * catalogue" was fourth. Each of these is a claim a listener reads beside the
 * preset; these hold every one of them to the numbers it names, with the
 * pins read the way the notes draw them (`curveGainDb`).
 */
import en from '../../../common/i18n/en';
import { DSP_PRESETS } from '../../../common/dsp/presets';
import { GENRE_NOTES } from '../../../common/dsp/genreNotes';
import { GENRE_MEASURED } from '../../../common/dsp/genreEvidence';
import {
  GENRE_STAGES,
  IGenreRack,
  inGenreChain,
} from '../../../common/dsp/genreRack';
import { GENRE_RACKS, genreChainId } from '../../../common/dsp/genres';
import ELECTRONIC_RACKS from '../../../common/dsp/genres/electronic';
import ROCK_RACKS from '../../../common/dsp/genres/rock';
import type { IEqSettings } from '../../../common/dsp/chain';
import { curveGainDb } from '../../../renderer/dsp/genreNotesModel';

const text = en as Record<string, string>;
const key = (id: string, part: string) => `genre.${id}.${part}`;
const presetOf = (rack: IGenreRack) => {
  const preset = DSP_PRESETS.find((one) => one.id === genreChainId(rack));
  if (!preset) {
    throw new Error(`no chain for ${rack.id}`);
  }
  return preset;
};
const rackOf = (id: string) => {
  const rack = GENRE_RACKS.find((one) => one.id === id);
  if (!rack) {
    throw new Error(`no rack ${id}`);
  }
  return rack;
};

/** The loudest the curve plays anywhere in [from, to], on a 1/48-octave grid. */
const loudestIn = (curve: IEqSettings, from: number, to: number) => {
  let loudest = -Infinity;
  for (let hz = from; hz <= to; hz *= 2 ** (1 / 48)) {
    loudest = Math.max(loudest, curveGainDb(curve, hz));
  }
  return loudest;
};
/** The deepest the curve plays anywhere, 20 Hz to 20 kHz. */
const deepest = (curve: IEqSettings) => {
  let low = Infinity;
  for (let hz = 20; hz <= 20_000; hz *= 2 ** (1 / 24)) {
    low = Math.min(low, curveGainDb(curve, hz));
  }
  return low;
};

/**
 * Where a genre's research, quoted by its notes, forbids a lift: nothing
 * above 0 dB there, as the pins read it (a twentieth of a decibel is the
 * rounding of a pin's tenth).
 */
const NEVER_LIFTED: Readonly<Record<string, readonly [number, number]>> = {
  metal: [20, 75],
  edm: [20, 60],
  techno: [20, 60],
  drumBass: [20, 60],
  trap: [20, 60],
  kPop: [20, 50],
  orchestra: [20, 250],
  opera: [20, 250],
  bhangra: [40, 120],
  bachata: [3_000, 8_000],
};

/** Where a genre's notes say its bass is mono, the corner that makes it so. */
const MONO_UNDER: Readonly<Record<string, number>> = {
  pop: 140,
  electronic: 150,
  edm: 150,
  house: 150,
  techno: 150,
  trance: 120,
  dubstep: 120,
  drumBass: 90,
  trap: 120,
  hiphop: 120,
  lofi: 120,
  reggae: 80,
  dub: 150,
  dancehall: 120,
  latinPop: 150,
  reggaeton: 150,
  corridos: 120,
  afrobeats: 150,
  amapiano: 120,
};

describe('a genre’s notes', () => {
  it('has every part in English, and a stage line only for a stage it plays', () => {
    GENRE_RACKS.forEach((rack) => {
      const note = GENRE_NOTES[rack.id];
      expect(note).toBeDefined();
      expect(GENRE_MEASURED[rack.id]).toBeDefined();
      ['hook', 'story', 'off'].forEach((part) => {
        expect(text[key(rack.id, part)]).toBeTruthy();
      });
      // Low to high, each once, inside the plot.
      expect([...new Set(note.pins)].sort((a, b) => a - b)).toEqual(note.pins);
      note.pins.forEach((hz) => {
        expect(hz).toBeGreaterThanOrEqual(20);
        expect(hz).toBeLessThanOrEqual(20_000);
        expect(text[key(rack.id, `pin.${hz}`)]).toBeTruthy();
        expect(text[key(rack.id, `pin.${hz}.why`)]).toBeTruthy();
      });
      GENRE_STAGES.forEach((stage) => {
        expect(
          `${rack.id} ${stage} ${Boolean(text[key(rack.id, `stage.${stage}`)])}`,
        ).toBe(`${rack.id} ${stage} ${inGenreChain(rack, stage)}`);
      });
    });
  });

  it('never lifts where the research it quotes forbids a lift', () => {
    Object.entries(NEVER_LIFTED).forEach(([id, [from, to]]) => {
      const { curve } = presetOf(rackOf(id));
      if (!curve) {
        throw new Error(`no curve for ${id}`);
      }
      expect(
        `${id} ${Math.max(0, loudestIn(curve, from, to)).toFixed(1)}`,
      ).toBe(`${id} 0.0`);
    });
  });

  it('would notice a lift there (control)', () => {
    // The same reading on Metal's curve with its 50 Hz band put back to the
    // +2 dB it had: a check that could not see that proves nothing.
    const { curve } = presetOf(rackOf('metal'));
    if (!curve) {
      throw new Error('no curve for metal');
    }
    const lifted = {
      ...curve,
      bands: curve.bands.map((band) =>
        band.frequency === 50 ? { ...band, gainDb: 2 } : band,
      ),
    };
    expect(loudestIn(lifted, 20, 75)).toBeGreaterThan(1);
  });

  it('is mono under the corner it names', () => {
    Object.entries(MONO_UNDER).forEach(([id, hz]) => {
      const { eq } = presetOf(rackOf(id)).settings;
      expect(`${id} ${eq.enabled ? eq.monoBelowHz : 0}`).toBe(`${id} ${hz}`);
    });
    // And no genre is made mono above the 40 Hz protection without a note
    // that says so.
    GENRE_RACKS.filter((rack) => !(rack.id in MONO_UNDER)).forEach((rack) => {
      const { eq } = presetOf(rack).settings;
      expect(`${rack.id} ${eq.enabled ? eq.monoBelowHz : 0}`).toMatch(
        new RegExp(`^${rack.id} (0|40)$`),
      );
    });
  });

  it('leaves the kick’s attack alone where it says never lifted', () => {
    ['metal', 'drumBass'].forEach((id) => {
      expect(`${id} ${rackOf(id).bassPunch?.attack}`).toBe(`${id} 0`);
    });
  });

  it('calls a ceiling slow only when it lets go over a whole beat', () => {
    const calledSlow = GENRE_RACKS.filter((rack) =>
      /\bslow\b/i.test(text[key(rack.id, 'stage.maximizer')] ?? ''),
    );
    // The control: the word is in use, so an empty answer below is not a
    // search that found nothing.
    expect(calledSlow.length).toBeGreaterThan(10);
    expect(
      calledSlow
        .filter((rack) => rack.maximizer.releaseMs < 250)
        .map((rack) => rack.id),
    ).toEqual([]);
  });

  it('keeps every “most of any” it claims', () => {
    const presets = GENRE_RACKS.map((rack) => ({
      rack,
      preset: presetOf(rack),
    }));
    // Ambient: "the widest of any genre".
    const widest = Math.max(
      ...GENRE_RACKS.map((rack) => rack.dimension?.highWidth ?? 0),
    );
    expect(rackOf('ambient').dimension?.highWidth).toBe(widest);
    // Metal: "the deepest cut of any genre".
    const cuts = presets.map(({ rack, preset }) => ({
      id: rack.id,
      low: preset.curve ? deepest(preset.curve) : 0,
    }));
    const deepestCut = Math.min(...cuts.map((one) => one.low));
    expect(cuts.find((one) => one.id === 'metal')?.low).toBe(deepestCut);
    // Classical and Orchestra: "the longest look-ahead and release of any genre".
    const longestLook = Math.max(
      ...GENRE_RACKS.map((rack) => rack.maximizer.lookAheadMs),
    );
    const longestRelease = Math.max(
      ...GENRE_RACKS.map((rack) => rack.maximizer.releaseMs),
    );
    ['classical', 'orchestra'].forEach((id) => {
      expect(rackOf(id).maximizer.lookAheadMs).toBe(longestLook);
      expect(rackOf(id).maximizer.releaseMs).toBe(longestRelease);
    });
    // Progressive rock: "the longest look-ahead in the rock family".
    expect(rackOf('progressiveRock').maximizer.lookAheadMs).toBe(
      Math.max(...ROCK_RACKS.map((rack) => rack.maximizer.lookAheadMs)),
    );
    // Pop punk: "the lightest ceiling in the rock family".
    expect(rackOf('popPunk').maximizer.driveDb).toBe(
      Math.min(...ROCK_RACKS.map((rack) => rack.maximizer.driveDb)),
    );
    // Lo-fi: "a little more drive than its siblings".
    expect(rackOf('lofi').maximizer.driveDb).toBe(
      Math.max(...ELECTRONIC_RACKS.map((rack) => rack.maximizer.driveDb)),
    );
  });
});
