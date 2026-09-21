/* FluidEQ — GPL-3.0-or-later */
import { DSP_DEFAULTS } from './chain';
import type { IEqPreset } from './eqPresets';

/**
 * Listening starting points, not genre standards or mastering corrections.
 *
 * Six broad gain anchors keep every curve modest; interpolation produces the
 * same canonical fifteen-band curve for EQ, DSP and APO.
 *
 * Each row is a SHAPE that has had its own level taken out of it, and that is
 * why so many of them dip below zero: a curve which lifts the middle by a
 * decibel and a half is a decibel and a half louder, and louder wins every
 * comparison it is in before anybody has heard what it did to the tone.
 * Sixty-three of these each a little hot is how a catalogue quietly becomes a
 * loudness contest — measured through the engine, the worst were arriving two
 * and a half decibels over DSP Off, and they felt like the best presets in
 * the list.
 *
 * The numbers are not round because they are not guesses: each style's whole
 * chain (`genreChains.ts`) was rendered against DSP Off and the row shifted
 * until the result landed within about a decibel of it. Re-tune a row by its
 * shape and re-measure the chain; do not hand-adjust the level here.
 */
const ANCHORS = [25, 80, 250, 1000, 4000, 16000];
const STYLES: readonly (readonly [string, readonly number[]])[] = [
  ['modernCountry', [0.8, 1.8, -0.7, 0.3, 1.3, 0.8]],
  ['folk', [-0.4, 0.1, -0.4, 0.6, 0.6, 0.1]],
  ['bluegrass', [-0.5, 0, 0, 0.5, 1.5, 1]],
  ['americana', [0.3, 0.8, -0.2, 0.8, 0.3, -0.2]],
  ['singerSongwriter', [-0.8, -0.3, -0.8, 1.2, 0.7, 0.2]],
  ['classicRock', [0.4, 0.9, -1.1, -0.1, 0.9, -0.1]],
  ['alternativeRock', [0.7, 0.7, -1.3, 0.7, 0.7, -0.3]],
  ['indieRock', [-0.9, 0.1, -0.9, 0.1, -0.4, -0.4]],
  ['progressiveRock', [0.1, 0.6, -0.9, 0.1, 0.6, 0.6]],
  ['hardRock', [0.7, 1.7, -1.3, 0.2, 0.7, -0.8]],
  ['popPunk', [0, 1, -1.5, 0.5, 1, -0.5]],
  ['grunge', [0.6, 1.1, 0.1, -0.4, -0.9, -1.4]],
  ['indiePop', [0.1, 0.6, -0.9, 0.6, 0.6, 0.6]],
  ['synthPop', [1.3, 1.8, -0.7, 0.3, 0.8, 1.3]],
  ['kPop', [1.2, 1.7, -1.3, 0.2, 1.2, 0.7]],
  ['jPop', [0.4, 0.9, -1.1, 0.4, 0.9, -0.1]],
  ['cPop', [0, 0.5, -1, 1, 0.5, 0]],
  ['rnb', [0.9, 1.9, -0.1, -0.1, -0.1, 0.4]],
  ['soul', [-0.3, 0.7, -0.3, 0.2, -0.3, -0.8]],
  ['neoSoul', [0, 1, -0.5, 0, -1, -1.5]],
  ['funk', [-0.2, 1.3, -1.2, -0.2, 0.8, 0.3]],
  ['disco', [0.9, 1.4, -1.1, -0.6, 0.9, 0.9]],
  ['gospel', [-0.9, -0.4, -1.4, 0.6, 0.1, -0.4]],
  ['latin', [0.3, 1.3, -0.7, 0.3, 1.3, 0.8]],
  ['reggaeton', [2.1, 3.1, -0.9, 0.1, 1.1, 0.6]],
  ['salsa', [-0.3, 0.7, -0.8, 0.7, 1.2, 0.7]],
  ['bachata', [0.2, 1.2, -0.8, 1.2, 0.7, 0.2]],
  ['merengue', [0.4, 0.9, -1.1, 0.4, 1.9, 0.9]],
  ['cumbia', [0.7, 1.7, -0.3, 0.2, 0.7, -0.3]],
  ['bossaNova', [-1, 0, 0, 0.5, 0, -0.5]],
  ['samba', [-0.3, 1.2, -0.8, 0.2, 1.7, 0.7]],
  ['flamenco', [-0.9, -0.4, -0.9, 1.1, 1.1, 0.1]],
  ['latinPop', [0.5, 1.5, -1, 0.5, 1, 0.5]],
  ['regionalMexican', [-0.4, 1.1, -0.4, 1.1, 0.1, -0.4]],
  ['corridos', [0.6, 1.6, -0.4, 0.6, 0.1, -0.9]],
  ['afrobeats', [1.2, 2.2, -0.8, 0.2, 1.2, 0.7]],
  ['afrobeat', [-0.2, 0.8, -0.7, -0.2, 0.3, 0.8]],
  ['amapiano', [0.4, 2.1, -0.6, -0.1, 0.9, 0.4]],
  ['highlife', [-0.5, 0.5, -0.5, 0.5, 1, 0]],
  ['dancehall', [2.1, 2.6, -0.4, 0.6, 1.1, 0.6]],
  ['ska', [-0.4, 1.1, -0.9, 0.6, 1.1, -0.4]],
  ['dub', [2.5, 3, 0.5, -0.5, 0, -1]],
  ['house', [2, 2.5, -1, 0, 1.5, 1]],
  ['techno', [2.3, 3.3, -1.2, -0.2, 1.3, 1.3]],
  ['trance', [1.3, 1.8, -1.2, 0.3, 1.3, 1.8]],
  ['dubstep', [0.4, 2, -0.8, 0.2, 1.2, 0.7]],
  ['rap', [1.4, 1.9, -1.1, 0.9, 0.4, -0.1]],
  ['edm', [1.8, 2.3, -1.2, 0.3, 1.3, 1.3]],
  ['downtempo', [0.5, 1, -0.5, 0, -0.5, -1]],
  ['chillout', [0, 0.5, -0.5, 0, 0, -0.5]],
  ['bollywood', [0.3, 0.8, -1.2, 0.8, 0.3, 0.3]],
  ['bhangra', [0.6, 1.6, -0.4, 0.1, 1.1, 0.1]],
  ['indianClassical', [-0.7, -0.2, 0.3, 0.8, 0.8, 0.3]],
  ['arabicPop', [-0.3, 0.7, -0.8, 0.7, 0.2, -0.3]],
  ['turkishPop', [0.5, 1, -1, 0.5, 1, 0]],
  ['world', [-0.1, 0.4, -0.1, 0.4, 0.9, 0.4]],
  ['opera', [-0.8, -0.3, -0.3, 1.2, 0.7, -0.3]],
  ['newAge', [0.1, 0.1, -0.4, 0.1, 0.1, 1.1]],
  ['christian', [-0.4, 0.1, -1.4, 0.6, 0.1, -0.4]],
  ['newWave', [0.6, 1.1, -0.9, 0.1, 1.1, 0.6]],
  ['fusion', [0.4, 0.9, -0.6, 0.4, 1.4, 0.9]],
  ['smoothJazz', [0.2, 0.7, 0.2, 0.2, 0.2, -0.3]],
];
const gainsFor = (gains: readonly number[]) =>
  DSP_DEFAULTS.eq.bands.map(({ frequency }) => {
    const right = ANCHORS.findIndex((hz) => hz >= frequency);
    if (right === 0) {
      return gains[0];
    }
    if (right < 0) {
      return gains[gains.length - 1];
    }
    const fraction =
      Math.log(frequency / ANCHORS[right - 1]) /
      Math.log(ANCHORS[right] / ANCHORS[right - 1]);
    return (
      Math.round(
        (gains[right - 1] + fraction * (gains[right] - gains[right - 1])) * 100,
      ) / 100
    );
  });
export const WORLD_GENRE_EQ_PRESETS: readonly IEqPreset[] = STYLES.map(
  ([id, gains]) => ({
    id,
    labelKey: `dsp.eqPreset.${id}`,
    group: 'genre',
    gains: gainsFor(gains),
    setup: { subsonicHz: 20, monoBelowHz: 0, phase: 'minimum' },
  }),
);
