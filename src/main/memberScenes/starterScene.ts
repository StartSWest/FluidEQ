import { SCENE_DAYLIGHT_CONTROL } from '../../common/sceneDaylight';
import { SCENE_CONTRACT_VERSION } from '../../common/sceneUniformContract';

export { default as STARTER_SOURCE } from '../../common/studioStarterSource';

/**
 * The starter's one image (`assets/studio/starter`, described in its
 * LICENSES.md): the orb's picture place on top, holding a moon until the
 * member chooses a photo, and the swallow's sheet under it, which the scene
 * plays in the sky. So a first open already has something in the Pictures
 * tab and in the Animations tab, and the AI finds a working example of each
 * in the folder (Ivan, 2026-11-09: "the start scene start with someting on
 * both so the agent knows there exist and the user too"). `scene.frag`
 * (`studioStarterSource.ts`) samples these same numbers.
 */
export const STARTER_ARTWORK = {
  file: 'artwork.webp',
  width: 512,
  height: 776,
} as const;

const ORB_PICTURE = { x: 0, y: 0, width: 512, height: 512 } as const;

const SWALLOW_REGION = {
  id: 'swallow',
  x: 0,
  y: 520,
  width: 424,
  height: 256,
  rotated: false,
} as const;

/**
 * The swallow as the Studio's Animations tab reads it (`studioAnimation.ts`).
 * A PNG, not a WebP: the animator looks at it with look_at_animation, which
 * decodes in main, and Electron's decoder there reads PNG and JPEG only - as
 * a WebP the first animation every member meets was one their animator
 * could not see. The window's tour draws this same file.
 */
export const STARTER_ANIMATION_NAME = 'swallow-flight';

export const STARTER_ANIMATION = {
  sheet: 'art/swallow-flight.png',
  count: 8,
  columns: 4,
  fps: 10,
  loop: true,
  ground: 'sky',
} as const;

/** The artwork's swallow, packed from the swallow animation's own sheet. */
export const STARTER_ARTWORK_SOURCES = {
  [SWALLOW_REGION.id]: STARTER_ANIMATION.sheet,
} as const;

/** The files copied as they are, by their place in a new project. */
export const STARTER_ART_FILES = [
  STARTER_ARTWORK.file,
  STARTER_ANIMATION.sheet,
] as const;

/**
 * What "New project" writes: a scene that already moves with the music, so
 * the stage has something alive on it before anybody has asked an AI for
 * anything, and a working example of the music's channels, of the scene's
 * own dials, of a response and of the ambient layer for the AI to build on.
 *
 * Pulse (`common/studioStarterSource.ts`): an orb that swells with the bass,
 * a ring that is the spectrum, a sky the mids warm, sparks the treble lights
 * and a floor a ripple crosses on every beat; a picture in the orb and a
 * swallow flying over it, one of each of the Studio's other two kinds of
 * thing. Each dial is named for the one part it changes, so moving one
 * teaches what a dial is.
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
      'zh-Hant': '光球光暈',
      ko: '구체의 빛',
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
      'zh-Hant': '光環高度',
      ko: '고리 높이',
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
      'zh-Hant': '火花',
      ko: '불꽃',
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
      'zh-Hant': '地面漣漪',
      ko: '바닥 잔물결',
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
        'zh-Hant': '視窗周圍的火花',
        ko: '앱 주변의 불꽃',
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

/** The orb's picture place, named in every language the app speaks. */
const STARTER_PICTURES = [
  {
    id: 'orb',
    names: {
      en: 'Picture in the orb',
      es: 'Imagen en el orbe',
      pt: 'Imagem no orbe',
      fr: "Image dans l'orbe",
      de: 'Bild in der Kugel',
      it: "Immagine nell'orbe",
      ru: 'Изображение в шаре',
      zh: '光球里的图片',
      'zh-Hant': '光球裡的圖片',
      ko: '구체 속 사진',
      ja: '光球の中の画像',
      hi: 'गोले में चित्र',
    },
    ...ORB_PICTURE,
    fit: 'cover',
    focus: [0.5, 0.5],
  },
];

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
      artworkFile: STARTER_ARTWORK.file,
      artworkWidth: STARTER_ARTWORK.width,
      artworkHeight: STARTER_ARTWORK.height,
      pictures: STARTER_PICTURES,
      artworkRegions: [SWALLOW_REGION],
    },
    null,
    2,
  )}\n`;
