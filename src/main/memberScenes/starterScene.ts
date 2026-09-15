import { SCENE_CONTRACT_VERSION } from '../../common/sceneUniformContract';

export { default as STARTER_SOURCE } from './starterSceneSource';

/**
 * What "New project" writes: a scene that already moves with the music, so
 * the stage has something alive on it before anybody has asked an AI for
 * anything, and a working example of every channel, of the scene's own
 * sliders, of a response and of the ambient layer for the AI to build on.
 *
 * A spring night under cherry blossom (`starterSceneSource.ts`). The lanterns
 * are the spectrum, each read against where real songs sit at its frequency;
 * the moon's halo is the bass, the blossom's warmth the mids, stars and petals
 * the treble, the candles the beat, a shooting star the rare accent, and the
 * pond the waveform. Played through the app's own pipeline on seven songs, no
 * lantern-sized patch jumped more than a tenth of full brightness in a frame,
 * and at 2560x1440 it draws in the time Aurora does.
 *
 * The scene keeps the member rules (`memberSceneRules.ts`) and this manifest
 * passes the project check (`readProject`). A test holds both.
 */

/** The scene's own sliders, each named in every language the app speaks. */
const STARTER_PARAMS = [
  {
    id: 'glow',
    names: {
      en: 'Lantern light',
      es: 'Luz de los farolillos',
      pt: 'Luz das lanternas',
      fr: 'Lumière des lanternes',
      de: 'Laternenlicht',
      it: 'Luce delle lanterne',
      ru: 'Свет фонариков',
      zh: '灯笼的光',
      ja: '提灯の明かり',
      hi: 'लालटेन की रोशनी',
    },
    min: 0,
    max: 1,
    value: 0.6,
  },
  {
    id: 'petals',
    names: {
      en: 'Falling petals',
      es: 'Pétalos que caen',
      pt: 'Pétalas caindo',
      fr: 'Pétales qui tombent',
      de: 'Fallende Blüten',
      it: 'Petali che cadono',
      ru: 'Падающие лепестки',
      zh: '飘落的花瓣',
      ja: '舞い散る花びら',
      hi: 'गिरती पंखुड़ियाँ',
    },
    min: 0,
    max: 1,
    value: 0.5,
  },
  {
    id: 'breeze',
    names: {
      en: 'Breeze',
      es: 'Brisa',
      pt: 'Brisa',
      fr: 'Brise',
      de: 'Brise',
      it: 'Brezza',
      ru: 'Ветерок',
      zh: '微风',
      ja: 'そよ風',
      hi: 'मंद हवा',
    },
    min: 0,
    max: 1,
    value: 0.4,
  },
  {
    id: 'moon',
    names: {
      en: 'Moonlight',
      es: 'Luz de luna',
      pt: 'Luar',
      fr: 'Clair de lune',
      de: 'Mondlicht',
      it: 'Chiaro di luna',
      ru: 'Лунный свет',
      zh: '月光',
      ja: '月明かり',
      hi: 'चाँदनी',
    },
    min: 0,
    max: 1,
    value: 0.6,
  },
  {
    id: 'blossom',
    names: {
      en: 'Blossom colour',
      es: 'Color de las flores',
      pt: 'Cor das flores',
      fr: 'Couleur des fleurs',
      de: 'Blütenfarbe',
      it: 'Colore dei fiori',
      ru: 'Оттенок цветов',
      zh: '花的颜色',
      ja: '花の色',
      hi: 'फूलों का रंग',
    },
    min: 0,
    max: 1,
    value: 0.45,
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
 * Petals, blossoms and lantern glows around the window in Ambient mode. Sized
 * and coloured to be seen over the app's dark panes: at 10-18 px and pale
 * pink, on a window 2560 px wide, they could not be found. The petals follow
 * the level and the lantern glows the beat, because the treble a song's hats
 * leave in the bands sits near nothing and moved neither.
 */
const STARTER_AMBIENT = {
  elements: [
    {
      id: 'petals',
      shape: 'petal',
      colours: ['#ffa8cc', '#ffc2dc', '#ff8fbd'],
      count: 14,
      size: [18, 30],
      opacity: 1,
      motion: 'fall',
      speed: 0.24,
      area: 'all',
      flap: 0.6,
      turn: 0.8,
      music: 'level',
      react: 0.35,
    },
    {
      id: 'blossoms',
      shape: 'blossom',
      colours: ['#ff9ec4', '#ffb3d1'],
      count: 5,
      size: [28, 42],
      opacity: 0.9,
      motion: 'drift',
      speed: 0.18,
      area: 'top',
      flap: 0.25,
      turn: 0.55,
      music: 'mid',
      react: 0.35,
    },
    {
      id: 'lanterns',
      shape: 'bokeh',
      colours: ['#ff8a3d', '#ff6a3d'],
      count: 6,
      size: [44, 64],
      opacity: 0.65,
      motion: 'twinkle',
      speed: 0.05,
      area: 'edges',
      flap: 0.35,
      turn: 0.3,
      music: 'beat',
      react: 0.5,
    },
  ],
  params: [
    {
      id: 'petal_count',
      names: {
        en: 'Petals around the app',
        es: 'Pétalos alrededor de la app',
        pt: 'Pétalas ao redor do app',
        fr: "Pétales autour de l'appli",
        de: 'Blüten rund um die App',
        it: "Petali intorno all'app",
        ru: 'Лепестки вокруг приложения',
        zh: '应用周围的花瓣',
        ja: 'アプリのまわりの花びら',
        hi: 'ऐप के आसपास पंखुड़ियाँ',
      },
      value: 0.6,
      targets: [
        { element: 'petals', field: 'count', min: 4, max: 16 },
        { element: 'blossoms', field: 'count', min: 1, max: 7 },
      ],
    },
    {
      id: 'petal_speed',
      names: {
        en: 'Petal speed',
        es: 'Velocidad de los pétalos',
        pt: 'Velocidade das pétalas',
        fr: 'Vitesse des pétales',
        de: 'Tempo der Blüten',
        it: 'Velocità dei petali',
        ru: 'Скорость лепестков',
        zh: '花瓣的速度',
        ja: '花びらの速さ',
        hi: 'पंखुड़ियों की गति',
      },
      value: 0.4,
      targets: [
        { element: 'petals', field: 'speed', min: 0.08, max: 0.6 },
        { element: 'blossoms', field: 'speed', min: 0.05, max: 0.45 },
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
      swatch: ['#0d0b26', '#ff8a4c', '#ffc2d9'],
      sourceFile: 'scene.frag',
      params: STARTER_PARAMS,
      response: STARTER_RESPONSE,
      ambient: STARTER_AMBIENT,
    },
    null,
    2,
  )}\n`;
