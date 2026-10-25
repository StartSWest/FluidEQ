import { SCENE_DAYLIGHT_CONTROL } from '../../common/sceneDaylight';
import { SCENE_CONTRACT_VERSION } from '../../common/sceneUniformContract';

export { default as STARTER_SOURCE } from '../../common/studioStarterSource';

/**
 * What "New project" writes: a scene that already moves with the music, so
 * the stage has something alive on it before anybody has asked an AI for
 * anything, and a working example of the music's channels, of the scene's
 * own dials, of a response and of the ambient layer for the AI to build on.
 *
 * Pulse (`common/studioStarterSource.ts`): an orb that swells with the bass,
 * a ring that is the spectrum, a sky the mids warm, sparks the treble lights
 * and a floor a ripple crosses on every beat. Each dial is named for the one
 * part it changes, so moving one teaches what a dial is.
 *
 * The scene keeps the member rules (`memberSceneRules.ts`) and this manifest
 * passes the project check (`readProject`). A test holds both.
 */

/** The scene's own dials, each named in every language the app speaks. */
const STARTER_PARAMS = [
  {
    id: 'glow',
    names: {
      en: 'Orb glow',
      es: 'Brillo del orbe',
      pt: 'Brilho do orbe',
      fr: "Halo de l'orbe",
      de: 'Leuchten der Kugel',
      it: "Bagliore dell'orbe",
      ru: 'Сияние шара',
      zh: '光球的光晕',
      ja: '光球の輝き',
      hi: 'गोले की चमक',
    },
    min: 0,
    max: 1,
    value: 0.6,
  },
  {
    id: 'ring',
    names: {
      en: 'Ring height',
      es: 'Altura del anillo',
      pt: 'Altura do anel',
      fr: "Hauteur de l'anneau",
      de: 'Höhe des Rings',
      it: "Altezza dell'anello",
      ru: 'Высота кольца',
      zh: '光环的高度',
      ja: 'リングの高さ',
      hi: 'छल्ले की ऊँचाई',
    },
    min: 0,
    max: 1,
    value: 0.65,
  },
  {
    id: 'sparks',
    names: {
      en: 'Sparks',
      es: 'Chispas',
      pt: 'Faíscas',
      fr: 'Étincelles',
      de: 'Funken',
      it: 'Scintille',
      ru: 'Искры',
      zh: '火花',
      ja: '火の粉',
      hi: 'चिंगारियाँ',
    },
    min: 0,
    max: 1,
    value: 0.5,
  },
  {
    id: 'ripples',
    names: {
      en: 'Floor ripples',
      es: 'Ondas en el suelo',
      pt: 'Ondas no chão',
      fr: 'Ondes au sol',
      de: 'Wellen am Boden',
      it: 'Onde sul pavimento',
      ru: 'Волны на полу',
      zh: '地面的涟漪',
      ja: '床の波紋',
      hi: 'फ़र्श पर लहरें',
    },
    min: 0,
    max: 1,
    value: 0.7,
  },
];

/**
 * Falls eased over a quarter of a second: the analyser moves in 30 Hz steps,
 * and a light dropping to each one flickers.
 */
const STARTER_RESPONSE = {
  sensitivity: 1,
  threshold: 0.04,
  attack: 20,
  release: 260,
};

/**
 * Sparks rising round the window in Ambient mode, and a few soft lights that
 * pulse on the beat. The sparks follow the level, because the treble a
 * song's hats leave in the bands sits near nothing and moved neither.
 */
const STARTER_AMBIENT = {
  elements: [
    {
      id: 'sparks',
      shape: 'spark',
      colours: ['#ffd7ec', '#ff9cc8', '#9fe6ff'],
      count: 12,
      size: [14, 24],
      opacity: 0.95,
      motion: 'rise',
      speed: 0.22,
      area: 'all',
      flap: 0.3,
      turn: 0.4,
      music: 'level',
      react: 0.4,
    },
    {
      id: 'lights',
      shape: 'bokeh',
      colours: ['#ff5c9d', '#ffb347'],
      count: 5,
      size: [44, 64],
      opacity: 0.6,
      motion: 'twinkle',
      speed: 0.05,
      area: 'edges',
      flap: 0.3,
      turn: 0.3,
      music: 'beat',
      react: 0.5,
    },
  ],
  params: [
    {
      id: 'spark_count',
      names: {
        en: 'Sparks around the app',
        es: 'Chispas alrededor de la app',
        pt: 'Faíscas ao redor do app',
        fr: "Étincelles autour de l'appli",
        de: 'Funken rund um die App',
        it: "Scintille intorno all'app",
        ru: 'Искры вокруг приложения',
        zh: '应用周围的火花',
        ja: 'アプリのまわりの火の粉',
        hi: 'ऐप के आसपास चिंगारियाँ',
      },
      value: 0.6,
      targets: [
        { element: 'sparks', field: 'count', min: 4, max: 16 },
        { element: 'lights', field: 'count', min: 1, max: 7 },
      ],
    },
  ],
};

/** The starter's `pack.json`, named for the project it starts. */
export const starterManifest = (name: string, id: string) =>
  `${JSON.stringify(
    {
      id,
      version: 1,
      contract: SCENE_CONTRACT_VERSION,
      names: { en: name },
      fallbackStyle: 'dots',
      swatch: ['#0a0c22', '#ff5c9d', '#9fe6ff'],
      sourceFile: 'scene.frag',
      // The time of day first, as the Studio asks of every scene
      // (`sceneDaylight.ts`): the shader draws night at 0 and day at 100.
      params: [SCENE_DAYLIGHT_CONTROL, ...STARTER_PARAMS],
      response: STARTER_RESPONSE,
      ambient: STARTER_AMBIENT,
    },
    null,
    2,
  )}\n`;
