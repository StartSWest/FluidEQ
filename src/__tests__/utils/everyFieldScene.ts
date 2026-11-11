/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import {
  normalizeSceneAmbient,
  type ISceneAmbient,
} from '../../common/sceneAmbient';
import { normalizeScenePack, type IScenePack } from '../../common/scenePacks';
import storedScenePack from '../../common/sceneStoredPack';
import type { ISceneWorld } from '../../common/sceneWorld';
import normalizeSceneWorld from '../../common/sceneWorldRead';
import { daylightControl, memberPack } from './memberSceneFixtures';

/**
 * A scene that carries EVERY field a pack can carry, for the tests that walk
 * a scene through each way it is written down and read again
 * (`sceneEveryField.test.ts`). `EVERY_PACK_FIELD` names each field of
 * `IScenePack`, and the compiler refuses this file when the type gains one
 * that is not named here; the test then fails until the scene below carries
 * it. That is how a field added later is covered without anyone remembering.
 */
export const EVERY_PACK_FIELD: Record<keyof IScenePack, true> = {
  schema: true,
  id: true,
  version: true,
  contract: true,
  names: true,
  fallbackStyle: true,
  swatch: true,
  source: true,
  params: true,
  palettes: true,
  colours: true,
  artwork: true,
  spectrumRange: true,
  response: true,
  wave: true,
  ambient: true,
  world: true,
  camera: true,
  framing: true,
  pointer: true,
};

/**
 * The smallest WebP the pack checks accept: a lossless header naming its own
 * size. The checks read the container, never decode it, so no pixels follow.
 */
const webp = (width: number, height: number) => {
  const bytes = Buffer.alloc(30);
  bytes.write('RIFF', 0, 'ascii');
  bytes.writeUInt32LE(bytes.length - 8, 4);
  bytes.write('WEBP', 8, 'ascii');
  bytes.write('VP8L', 12, 'ascii');
  bytes.writeUInt32LE(bytes.length - 20, 16);
  bytes[20] = 0x2f;
  bytes.writeUInt32LE(width - 1 + (height - 1) * 16384, 21);
  return bytes;
};

const PICTURE = webp(4, 2);

/**
 * The flying things, as the app keeps them. Normalized here rather than
 * written by hand so the round trip below compares a pack against itself:
 * what it proves is the manifest carrying the field, not the shape.
 */
const ambient = () =>
  normalizeSceneAmbient({
    elements: [
      {
        id: 'gulls',
        shape: 'bird',
        colours: ['#dfe9ff'],
        count: 6,
        size: [14, 24],
        opacity: 0.7,
        motion: 'fly',
        speed: 0.35,
        area: 'top',
        flap: 0.7,
        turn: 0.3,
        music: 'mid',
        react: 0.3,
      },
    ],
    params: [
      {
        id: 'ambient_amount',
        names: { en: 'Birds', es: 'Aves' },
        value: 0.6,
        targets: [{ element: 'gulls', field: 'count', min: 2, max: 10 }],
      },
    ],
  }) as ISceneAmbient;

/**
 * The smallest binary glTF the model check accepts: its header and a JSON
 * chunk naming the format and its one scene, padded to four bytes as the
 * format requires. Without the scene three builds no model at all.
 */
const glb = () => {
  const json = Buffer.from(
    '{"asset":{"version":"2.0"},"scenes":[{"nodes":[]}]} ',
    'utf8',
  );
  const bytes = Buffer.alloc(20 + json.length);
  bytes.write('glTF', 0, 'ascii');
  bytes.writeUInt32LE(2, 4);
  bytes.writeUInt32LE(bytes.length, 8);
  bytes.writeUInt32LE(json.length, 12);
  bytes.write('JSON', 16, 'ascii');
  json.copy(bytes, 20);
  return bytes;
};

const MODEL = glb();

/**
 * A 3D world with both kinds of GLSL and a model, the three things a
 * restored project keeps in files of their own. Normalized for the same
 * reason as the flying things.
 */
const world = () =>
  normalizeSceneWorld(
    {
      materials: {
        core: {
          kind: 'physical',
          colour: '#11111a',
          vertex:
            'vec3 worldDisplace(vec3 p, vec3 n, WorldVertex v) {\n  return p + n * uBands.x * 0.2;\n}\n',
          fragment:
            'void worldSurface(inout vec4 colour, inout vec3 emissive, WorldSurface s) {\n  emissive += colour.rgb * uLevel;\n}\n',
        },
      },
      models: { ship: { data: MODEL.toString('base64') } },
      nodes: [
        {
          type: 'mesh',
          geometry: { kind: 'icosahedron', radius: 2 },
          material: 'core',
        },
        { type: 'model', model: 'ship' },
      ],
    },
    ['glow'],
  ) as ISceneWorld;

/**
 * A pack using every part the manifest has to carry. Every optional field
 * belongs here: a manifest that quietly dropped one still built a pack, and
 * the round trip below could only see the fields this fixture has — which is
 * how the wave and the flying things were lost without a test noticing.
 */
const fullPack = (): IScenePack =>
  memberPack({
    wave: { height: 0.4, position: 0.3 },
    ambient: ambient(),
    version: 3,
    names: { en: 'Neon City', es: 'Ciudad de neón' },
    swatch: ['#050a1a', '#00e5cf', '#ff3d7f'],
    params: [
      daylightControl(),
      {
        id: 'glow',
        names: { en: 'Glow', es: 'Brillo' },
        min: 0,
        max: 2,
        value: 0.75,
      },
    ],
    artwork: {
      mime: 'image/webp',
      width: 4,
      height: 2,
      data: PICTURE.toString('base64'),
    },
    spectrumRange: [0.1, 0.85],
    response: { sensitivity: 1.5, threshold: 0.1, attack: 40, release: 600 },
    world: world(),
    framing: { focus: [0.8, 0.45], narrowest: 1.7778, widest: 3 },
    // As the pack's reader leaves it: one emitter throws the scene's own
    // element, so the element has to come back with it.
    pointer: {
      emitters: [
        {
          on: 'move',
          element: 'gulls',
          colours: [],
          amount: 3,
          size: [10, 18],
          life: 1.6,
          speed: 0.3,
          spread: 0.6,
          gravity: 0.35,
          spin: 0.6,
        },
        {
          on: 'tap',
          shape: 'spark',
          colours: ['#ffd27a', '#ff8a4c'],
          amount: 14,
          size: [6, 12],
          life: 0.9,
          speed: 0.7,
          spread: 1,
          gravity: 0.2,
          spin: 0.2,
        },
      ],
    },
  });

/**
 * The scene with every field: `fullPack` with a choice, a palette, a single
 * colour and a camera, read once through the pack's own reader so it is
 * exactly what the app holds for it.
 */
export const everyFieldPack = (): IScenePack => {
  const base = fullPack();
  const pack = normalizeScenePack({
    ...storedScenePack(base),
    contract: 9,
    source: [
      'vec4 sceneColour(vec2 uv) {',
      '  vec3 tint = texture(uPalette_colours, vec2(uv.x, 0.5)).rgb;',
      '  return vec4(tint * uParam_glow, 1.0);',
      '}',
      '',
    ].join('\n'),
    params: [
      ...base.params,
      {
        type: 'choice',
        id: 'style',
        names: { en: 'Colour mode', es: 'Modo de color' },
        min: 0,
        max: 1,
        value: 1,
        options: [
          { names: { en: 'One colour' } },
          { names: { en: 'Palette' } },
        ],
      },
      {
        type: 'palette',
        id: 'colours',
        names: { en: 'Colours' },
        stops: ['#46327e', '#277f8e', '#4ac16d'],
        showWhen: { style: [1] },
      },
      {
        type: 'colour',
        id: 'single',
        names: { en: 'Colour' },
        value: '#00b3a4',
        showWhen: { style: [0] },
      },
    ],
    camera: { yaw: [-0.6, 0.6], pitch: [-0.2, 0.4], zoom: [0.8, 1.6] },
  });
  if (!pack) {
    throw new Error('the every-field scene is not a scene');
  }
  return pack;
};

export { PICTURE as EVERY_FIELD_PICTURE };
