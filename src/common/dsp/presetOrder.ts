/* FluidEQ — GPL-3.0-or-later */

// Stable across translations and shared by complete DSP presets and the EQ
// stage's own picker. New styles belong beside their relatives, not at the end
// simply because their recipe was added later.
const STYLE_FAMILIES = [
  ['pop', 'indiePop', 'synthPop', 'newWave', 'kPop', 'jPop', 'cPop'],
  [
    'rock',
    'classicRock',
    'alternativeRock',
    'indieRock',
    'progressiveRock',
    'hardRock',
    'metal',
    'punk',
    'popPunk',
    'grunge',
  ],
  [
    'country',
    'modernCountry',
    'americana',
    'bluegrass',
    'folk',
    'acoustic',
    'singerSongwriter',
  ],
  ['hiphop', 'rap', 'trap', 'rnb', 'soul', 'neoSoul', 'funk', 'disco'],
  ['jazz', 'smoothJazz', 'fusion', 'blues'],
  ['classical', 'orchestra', 'opera', 'piano', 'strings'],
  [
    'electronic',
    'edm',
    'house',
    'techno',
    'trance',
    'drumBass',
    'dubstep',
    'downtempo',
    'chillout',
    'lofi',
    'ambient',
    'newAge',
  ],
  ['reggae', 'dub', 'dancehall', 'ska'],
  [
    'latin',
    'latinPop',
    'reggaeton',
    'salsa',
    'bachata',
    'merengue',
    'cumbia',
    'bossaNova',
    'samba',
    'flamenco',
    'regionalMexican',
    'corridos',
  ],
  ['afrobeat', 'afrobeats', 'amapiano', 'highlife'],
  [
    'world',
    'bollywood',
    'bhangra',
    'indianClassical',
    'arabicPop',
    'turkishPop',
  ],
  ['gospel', 'christian'],
] as const;

const styleRank = new Map<string, number>(
  STYLE_FAMILIES.flat().map((style, rank) => [`dsp.eqPreset.${style}`, rank]),
);

interface IStylePreset {
  group: string;
  labelKey: string;
}

export default function orderRelatedStyles<T extends IStylePreset>(
  presets: readonly T[],
): T[] {
  const genres = presets
    .filter((preset) => preset.group === 'genre')
    .sort(
      (a, b) =>
        (styleRank.get(a.labelKey) ?? Number.MAX_SAFE_INTEGER) -
        (styleRank.get(b.labelKey) ?? Number.MAX_SAFE_INTEGER),
    );
  let genre = 0;
  return presets.map((preset) => {
    if (preset.group !== 'genre') {
      return preset;
    }
    const next = genres[genre];
    genre += 1;
    return next;
  });
}
