/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * The drums as the net hears them (`drumNet.ts`, `drumNetFeatures.ts`) and
 * as the kit shows them (`hearKitNet`). How well it finds real drums is
 * measured on real songs against their separated drum tracks, and written in
 * `drumNet.ts`; what is held here is what the code around the weights does:
 * the features it is shown, the rule that shows a drum, that the beat's own
 * detectors are left alone, and that Treble is weighed by the drums' share
 * of the top. Each case beside the one that must not pass.
 */

import {
  createDrumFeatureState,
  DRUM_HOP_FEATURES,
  hopFeatures,
} from '../../../common/drumNetFeatures';
import { createLevelState, followLevels } from '../../../common/energyLevels';
import { createDrumKit, hearKitNet } from '../../../common/rhythmKit';
import type { IRhythmSpectrum } from '../../../common/rhythmSpectrum';
import {
  createSoundCursor,
  createSoundHops,
  HOP_MS,
  soundHistorySamples,
  type ISoundHop,
} from '../../../common/soundHops';
import { createEnergyState, hearSound } from '../../../common/spectrumEnergy';

const RATE = 48_000;
const SECONDS = 16;
const BEAT_S = 0.5;
/** The clock and the kit are finding the song before this. */
const SETTLED_MS = 4_000;

/**
 * A made-up song: a bass line and a chord, and - with `drums` - a kick on
 * every beat (a thump sweeping down under a beater's click).
 */
const song = (drums: boolean) => {
  const out = new Float32Array(RATE * SECONDS);
  let seed = 4_321;
  for (let n = 0; n < out.length; n += 1) {
    const t = n / RATE;
    const beat = Math.floor(t / BEAT_S);
    const since = t - beat * BEAT_S;
    seed = (seed * 1_103_515_245 + 12_345) % 2_147_483_648;
    const white = seed / 1_073_741_824 - 1;
    const bassHz = [55, 55, 65.4, 49][Math.floor(beat / 4) % 4];
    let value =
      0.16 * Math.sin(2 * Math.PI * bassHz * t) +
      0.05 * Math.sin(2 * Math.PI * 2 * bassHz * t) +
      0.04 *
        (Math.sin(2 * Math.PI * 220 * t) +
          Math.sin(2 * Math.PI * 277.2 * t) +
          Math.sin(2 * Math.PI * 329.6 * t));
    if (drums) {
      value +=
        0.6 *
          Math.exp(-since * 16) *
          Math.sin(
            2 *
              Math.PI *
              (50 * since + (110 / 45) * (1 - Math.exp(-since * 45))),
          ) +
        0.15 * Math.exp(-since * 400) * white;
    }
    out[n] = value;
  }
  return out;
};

/** When the kick's lamp lit, in ms, once the song had settled. */
const kickLamps = (samples: Float32Array) => {
  const history = soundHistorySamples(RATE);
  const padded = new Float32Array(samples.length + history);
  padded.set(samples, history);
  const hops = createSoundHops(RATE);
  const cursor = createSoundCursor();
  const energy = createEnergyState();
  const lamps: number[] = [];
  let before = 0;
  const see = (hop: ISoundHop) => {
    const { kick } = hearSound(energy, [hop], 0).rhythm;
    if (kick > before + 0.5 && hop.atMs > SETTLED_MS) {
      lamps.push(hop.atMs);
    }
    before = kick;
  };
  for (let frame = 0; (frame * RATE) / 60 <= samples.length; frame += 1) {
    const end = Math.min(samples.length, Math.round((frame * RATE) / 60));
    const view = padded.subarray(end, end + history);
    hops.update(view, view, (end * 1_000) / RATE);
    hops.take(cursor).forEach(see);
  }
  return lamps;
};

describe('the kit, heard in the sound itself', () => {
  it('lights the kick on the beat of a song with kicks, and never on the same song without', () => {
    const lamps = kickLamps(song(true));
    // The net was taught real drums, and takes most of these made-up ones.
    expect(lamps.length).toBeGreaterThanOrEqual(8);
    lamps.forEach((atMs) => {
      const sinceBeat = atMs % (BEAT_S * 1_000);
      expect(sinceBeat).toBeGreaterThanOrEqual(0);
      expect(sinceBeat).toBeLessThanOrEqual(60);
    });
    // The control: the bass line and the chord alone light nothing.
    expect(kickLamps(song(false))).toEqual([]);
  });
});

describe('the rule that shows a drum', () => {
  const NOTHING = { kick: 0, snare: 0, hat: 0 };
  /** The kit stepped a hop at a time through what the net says of the kick. */
  const shownAt = (kicks: readonly number[]) => {
    const kit = createDrumKit();
    const shown: number[] = [];
    kicks.forEach((kick, hop) => {
      if (hearKitNet(kit, { ...NOTHING, kick }, hop * HOP_MS, HOP_MS).kick) {
        shown.push(hop);
      }
    });
    return { kit, shown };
  };
  /** `likely` at each of `hops`, nothing between. */
  const hits = (likely: number, ...hops: number[]) => {
    const out = new Array<number>(hops[hops.length - 1] + 1).fill(0);
    hops.forEach((hop) => {
      out[hop] = likely;
    });
    return out;
  };

  it('shows a drum only once the net has twice been all but certain of it', () => {
    // Likely enough to show (0.9), never all but certain (0.95): not shown.
    expect(shownAt(hits(0.9, 10, 60, 110, 160)).shown).toEqual([]);
    // Certain twice within eight seconds: shown from the second on.
    expect(shownAt(hits(0.97, 10, 60, 110)).shown).toEqual([60, 110]);
    // And then a merely likely hit is shown too, an unlikely one never.
    const likely = hits(0.97, 10, 60, 110, 160);
    likely[110] = 0.9;
    likely[160] = 0.8;
    expect(shownAt(likely).shown).toEqual([60, 110]);
  });

  it('forgets a certainty eight seconds old', () => {
    // Certain at 0.1 s and again at 9 s: nine seconds apart is not twice.
    expect(shownAt(hits(0.97, 10, 900)).shown).toEqual([]);
    // The control: 7 s apart is.
    expect(shownAt(hits(0.97, 10, 710)).shown).toEqual([710]);
  });

  it('shows no second hit inside the first one', () => {
    // 60 ms apart is one kick; 130 ms apart is two.
    expect(shownAt(hits(0.97, 10, 60, 66)).shown).toEqual([60]);
    expect(shownAt(hits(0.97, 10, 60, 73)).shown).toEqual([60, 73]);
  });

  it("lights the envelope at a hit and lets it fall, and leaves the beat's detectors alone", () => {
    const { kit } = shownAt(hits(0.97, 10, 60));
    expect(kit.kick.envelope).toBe(1);
    hearKitNet(kit, NOTHING, 61 * HOP_MS, HOP_MS);
    expect(kit.kick.envelope).toBeLessThan(1);
    expect(kit.kick.envelope).toBeGreaterThan(0.8);
    // The beat's grid reads the detector's own clock (`followHitHeight`):
    // after sixty hops and two hits shown it stands as a new kit's does.
    expect(kit.kick.detector).toEqual(createDrumKit().kick.detector);
  });
});

describe("the drums' share of the top, on its way to Treble", () => {
  /** The loudest Treble read over two seconds of hiss, the share held at `top` or left to the net. */
  const trebleOfHiss = (top: number | undefined) => {
    let seed = 99;
    const hiss = Float32Array.from({ length: RATE * 2 }, () => {
      seed = (seed * 1_103_515_245 + 12_345) % 2_147_483_648;
      return 0.2 * (seed / 1_073_741_824 - 1);
    });
    const history = soundHistorySamples(RATE);
    const padded = new Float32Array(hiss.length + history);
    padded.set(hiss, history);
    const hops = createSoundHops(RATE);
    const cursor = createSoundCursor();
    const energy = createEnergyState();
    let loudest = 0;
    const see = (hop: ISoundHop) => {
      if (top !== undefined) {
        energy.rhythm.drumsHeard.top = top;
      }
      loudest = Math.max(loudest, hearSound(energy, [hop], 0).treble);
    };
    for (let frame = 0; (frame * RATE) / 60 <= hiss.length; frame += 1) {
      const end = Math.min(hiss.length, Math.round((frame * RATE) / 60));
      const view = padded.subarray(end, end + history);
      hops.update(view, view, (end * 1_000) / RATE);
      hops.take(cursor).forEach(see);
    }
    return loudest;
  };

  it("reaches the levels: a top that is none of the drums' reads no Treble", () => {
    expect(trebleOfHiss(0)).toBe(0);
    // The control: the same hiss, all the drums', reads plenty.
    expect(trebleOfHiss(1)).toBeGreaterThan(0.5);
  });
});

describe('what the net is shown of a hop', () => {
  /** A hop whose every bin stands at `db`, but for `raised` Hz ranges. */
  const hop = (
    db: number,
    raised: readonly [number, number, number][] = [],
  ): IRhythmSpectrum => {
    const lowBinHz = RATE / 2_048;
    const highBinHz = RATE / 1_024;
    const fill = (count: number, binHz: number) =>
      Float32Array.from({ length: count }, (_, bin) => {
        const hz = bin * binHz;
        const lift = raised.find(([from, to]) => hz >= from && hz < to);
        return db + (lift ? lift[2] : 0);
      });
    return {
      low: fill(17, lowBinHz),
      lowBinHz,
      high: fill(342, highBinHz),
      highBinHz,
    };
  };
  const features = (hops: readonly IRhythmSpectrum[]) => {
    const state = createDrumFeatureState();
    const out = new Float32Array(DRUM_HOP_FEATURES);
    hops.forEach((spectrum) => hopFeatures(state, spectrum, HOP_MS, out, 0));
    return out;
  };
  // Six numbers a band; the bands in order, the hats' air (8-16 kHz) last.
  const AIR = 6 * 6;
  const CRACK = 4 * 6;

  it('says a band rose, how broadly and how far, against 30 ms before', () => {
    const still = hop(-40);
    const burst = hop(-40, [[8_000, 16_000, 12]]);
    const now = features([still, still, still, burst]);
    expect(now[AIR]).toBeCloseTo(12, 3); // every bin rose 12 dB
    expect(now[AIR + 1]).toBeCloseTo(1, 5); // all of them by 3 dB or more
    expect(now[AIR + 2]).toBeCloseTo(12, 3); // and so did the band's power
    // The control: a band nothing happened in says so.
    expect(now[CRACK]).toBe(0);
    expect(now[CRACK + 1]).toBe(0);
    expect(now[CRACK + 2]).toBeCloseTo(0, 5);
  });

  it('counts no rise where a band fell', () => {
    const still = hop(-40);
    const burst = hop(-40, [[8_000, 16_000, 12]]);
    const now = features([burst, burst, burst, still]);
    expect(now[AIR]).toBe(0);
    expect(now[AIR + 1]).toBe(0);
    // The band's own power did fall, as far as a fall is told.
    expect(now[AIR + 2]).toBeCloseTo(-6, 5);
  });

  it('keeps a rise for the 30 ms after it, and no longer', () => {
    const still = hop(-40);
    const burst = hop(-40, [[8_000, 16_000, 12]]);
    // The burst's third hop: 30 ms before it the band was still.
    const third = features([still, still, still, burst, burst, burst]);
    expect(third[AIR]).toBeCloseTo(12, 3);
    // Its fourth: 30 ms before it the burst had begun.
    const fourth = features([still, still, still, burst, burst, burst, burst]);
    expect(fourth[AIR]).toBe(0);
  });

  it('says the same of a song turned down 20 dB', () => {
    const loud = features([
      hop(-30),
      hop(-30),
      hop(-30),
      hop(-30, [[8_000, 16_000, 12]]),
    ]);
    const quiet = features([
      hop(-50),
      hop(-50),
      hop(-50),
      hop(-50, [[8_000, 16_000, 12]]),
    ]);
    loud.forEach((value, at) => expect(quiet[at]).toBeCloseTo(value, 3));
  });

  it('measures what follows a gap from its own first hop', () => {
    const state = createDrumFeatureState();
    const out = new Float32Array(DRUM_HOP_FEATURES);
    hopFeatures(state, hop(-70), HOP_MS, out, 0);
    // Half a second lost, then a loud hop: nothing in it "rose".
    hopFeatures(state, hop(-30), 500, out, 0);
    expect(out[AIR]).toBe(0);
    // The control: 10 ms after the quiet hop, the same hop is a 40 dB rise.
    const told = features([hop(-70), hop(-30)]);
    expect(told[AIR]).toBeCloseTo(40, 3);
  });
});

describe("Treble, weighed by the drums' share of the top", () => {
  /** Treble after a second of the same bright sound, the drums' share `top`. */
  const trebleAt = (top: number | undefined) => {
    const state = createLevelState();
    const lowBinHz = RATE / 2_048;
    const highBinHz = RATE / 1_024;
    const spectrum: IRhythmSpectrum = {
      low: new Float32Array(17).fill(-40),
      lowBinHz,
      high: new Float32Array(342).fill(-40),
      highBinHz,
    };
    const bands = new Array<number>(24).fill(0.6);
    let loudest = 0;
    for (let step = 0; step < 100; step += 1) {
      followLevels(state, bands, spectrum, HOP_MS, top);
      loudest = Math.max(loudest, state.treble);
    }
    return loudest;
  };

  it("reads the top in full where it is all the drums', and not at all where none of it is", () => {
    expect(trebleAt(1)).toBeGreaterThan(0.5);
    expect(trebleAt(0)).toBe(0);
    // Where nothing says whose the top is, it is read as it always was.
    expect(trebleAt(undefined)).toBe(trebleAt(1));
  });
});
