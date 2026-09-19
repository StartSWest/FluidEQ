/* FluidEQ — GPL-3.0-or-later */
import { DSP_DEFAULTS } from './chain';
import type { IEqPreset } from './eqPresets';

/** Listening starting points, not genre standards or mastering corrections.
 * Six broad gain anchors keep every curve modest (at most 3 dB); interpolation
 * produces the same canonical fifteen-band curve for EQ, DSP and APO. */
const ANCHORS = [25, 80, 250, 1000, 4000, 16000];
const STYLES: readonly (readonly [string, readonly number[]])[] = [
  ['modernCountry', [1, 2, -0.5, 0.5, 1.5, 1]],
  ['folk', [0, 0.5, 0, 1, 1, 0.5]],
  ['bluegrass', [-0.5, 0, 0, 0.5, 1.5, 1]],
  ['americana', [0.5, 1, 0, 1, 0.5, 0]],
  ['singerSongwriter', [-0.5, 0, -0.5, 1.5, 1, 0.5]],
  ['classicRock', [1, 1.5, -0.5, 0.5, 1.5, 0.5]],
  ['alternativeRock', [1, 1, -1, 1, 1, 0]],
  ['indieRock', [0, 1, 0, 1, 0.5, 0.5]],
  ['progressiveRock', [0.5, 1, -0.5, 0.5, 1, 1]],
  ['hardRock', [1, 2, -1, 0.5, 1, -0.5]],
  ['popPunk', [0.5, 1.5, -1, 1, 1.5, 0]],
  ['grunge', [1, 1.5, 0.5, 0, -0.5, -1]],
  ['indiePop', [0.5, 1, -0.5, 1, 1, 1]],
  ['synthPop', [1.5, 2, -0.5, 0.5, 1, 1.5]],
  ['kPop', [1.5, 2, -1, 0.5, 1.5, 1]],
  ['jPop', [1, 1.5, -0.5, 1, 1.5, 0.5]],
  ['cPop', [0.5, 1, -0.5, 1.5, 1, 0.5]],
  ['rnb', [1.5, 2.5, 0.5, 0.5, 0.5, 1]],
  ['soul', [0.5, 1.5, 0.5, 1, 0.5, 0]],
  ['neoSoul', [1, 2, 0.5, 1, 0, -0.5]],
  ['funk', [0.5, 2, -0.5, 0.5, 1.5, 1]],
  ['disco', [1.5, 2, -0.5, 0, 1.5, 1.5]],
  ['gospel', [0, 0.5, -0.5, 1.5, 1, 0.5]],
  ['latin', [0.5, 1.5, -0.5, 0.5, 1.5, 1]],
  ['reggaeton', [2, 3, -1, 0, 1, 0.5]],
  ['salsa', [0, 1, -0.5, 1, 1.5, 1]],
  ['bachata', [0.5, 1.5, -0.5, 1.5, 1, 0.5]],
  ['merengue', [0.5, 1, -1, 0.5, 2, 1]],
  ['cumbia', [1, 2, 0, 0.5, 1, 0]],
  ['bossaNova', [-0.5, 0.5, 0.5, 1, 0.5, 0]],
  ['samba', [0, 1.5, -0.5, 0.5, 2, 1]],
  ['flamenco', [-0.5, 0, -0.5, 1.5, 1.5, 0.5]],
  ['latinPop', [1, 2, -0.5, 1, 1.5, 1]],
  ['regionalMexican', [0, 1.5, 0, 1.5, 0.5, 0]],
  ['corridos', [1, 2, 0, 1, 0.5, -0.5]],
  ['afrobeats', [1.5, 2.5, -0.5, 0.5, 1.5, 1]],
  ['afrobeat', [0.5, 1.5, 0, 0.5, 1, 1.5]],
  ['amapiano', [2.5, 3, -0.5, 0, 1, 0.5]],
  ['highlife', [0, 1, 0, 1, 1.5, 0.5]],
  ['dancehall', [2, 2.5, -0.5, 0.5, 1, 0.5]],
  ['ska', [0, 1.5, -0.5, 1, 1.5, 0]],
  ['dub', [2.5, 3, 0.5, -0.5, 0, -1]],
  ['house', [2, 2.5, -1, 0, 1.5, 1]],
  ['techno', [2, 3, -1.5, -0.5, 1, 1]],
  ['trance', [1.5, 2, -1, 0.5, 1.5, 2]],
  ['dubstep', [3, 2.5, -1, 0, 1, 0.5]],
  ['rap', [2, 2.5, -0.5, 1.5, 1, 0.5]],
  ['edm', [2, 2.5, -1, 0.5, 1.5, 1.5]],
  ['downtempo', [1, 1.5, 0, 0.5, 0, -0.5]],
  ['chillout', [0.5, 1, 0, 0.5, 0.5, 0]],
  ['bollywood', [1, 1.5, -0.5, 1.5, 1, 1]],
  ['bhangra', [1, 2, 0, 0.5, 1.5, 0.5]],
  ['indianClassical', [-0.5, 0, 0.5, 1, 1, 0.5]],
  ['arabicPop', [0.5, 1.5, 0, 1.5, 1, 0.5]],
  ['turkishPop', [1, 1.5, -0.5, 1, 1.5, 0.5]],
  ['world', [0, 0.5, 0, 0.5, 1, 0.5]],
  ['opera', [-0.5, 0, 0, 1.5, 1, 0]],
  ['newAge', [0.5, 0.5, 0, 0.5, 0.5, 1.5]],
  ['christian', [0.5, 1, -0.5, 1.5, 1, 0.5]],
  ['newWave', [1, 1.5, -0.5, 0.5, 1.5, 1]],
  ['fusion', [0.5, 1, -0.5, 0.5, 1.5, 1]],
  ['smoothJazz', [0.5, 1, 0.5, 0.5, 0.5, 0]],
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
