import { checkProjectParams } from 'common/memberScenes';
import { normalizeScenePack } from 'common/scenePacks';
import {
  assembleFragmentSource,
  SCENE_CONTRACT_VERSION,
} from 'common/sceneUniformContract';

// The controls beside a slider (contract 9): a palette, apart from the eight,
// and a choice, a slider's uniform with named options. A scene from before
// either is read exactly as it was, and a kind this version has not got is
// left out rather than read as a slider that moves nothing.

const daylight = {
  id: 'daylight',
  names: { en: 'Daylight' },
  min: 0,
  max: 100,
  value: 100,
};
const slider = (id: string) => ({
  id,
  names: { en: id },
  min: 0,
  max: 1,
  value: 0.5,
});
const palette = (id = 'colours', stops: unknown = ['#ff3030', '#6b4cff']) => ({
  id,
  type: 'palette',
  names: { en: 'Colours' },
  stops,
});
const choice = (over: Record<string, unknown> = {}) => ({
  id: 'style',
  type: 'choice',
  names: { en: 'Style' },
  min: 0,
  max: 2,
  value: 1,
  options: [
    { names: { en: 'Bars' } },
    { names: { en: 'Rings' } },
    { names: { en: 'Both' } },
  ],
  ...over,
});
const pack = (params: unknown[]) =>
  normalizeScenePack({
    schema: 1,
    id: 'controls',
    version: 1,
    contract: 9,
    names: { en: 'Controls' },
    fallbackStyle: 'skyline',
    swatch: ['#000000', '#ffffff'],
    source: 'vec4 sceneColour(vec2 uv) { return vec4(uv, 0.0, 1.0); }',
    params,
  });

it('speaks contract 9', () => {
  expect(SCENE_CONTRACT_VERSION).toBe(9);
});

describe('reading', () => {
  it('reads a scene with neither exactly as before', () => {
    const read = pack([daylight]);
    expect(read?.params).toEqual([daylight]);
    expect(read).not.toHaveProperty('palettes');
  });

  it('keeps palettes apart from the eight sliders, two at most', () => {
    const eight = Array.from({ length: 8 }, (_, i) => slider(`s${i}`));
    const read = pack([...eight, palette('a'), palette('b'), palette('c')]);
    expect(read?.params).toHaveLength(8);
    expect(read?.palettes?.map((each) => each.id)).toEqual(['a', 'b']);
  });

  it('drops a palette that takes a slider id', () => {
    expect(pack([slider('glow'), palette('glow')])?.palettes).toBeUndefined();
  });

  it('leaves out a kind of control it has not got', () => {
    const read = pack([
      daylight,
      { id: 'knob', type: 'knob', names: { en: 'K' }, min: 0, max: 1 },
    ]);
    expect(read?.params.map((param) => param.id)).toEqual(['daylight']);
  });

  it('reads a choice as its options on a slider across their numbers', () => {
    const [read] = pack([choice({ value: 1.6, min: 3, max: 9 })])?.params ?? [];
    expect(read).toMatchObject({ id: 'style', min: 0, max: 2, value: 2 });
    expect(read.options?.map((option) => option.en)).toEqual([
      'Bars',
      'Rings',
      'Both',
    ]);
  });

  it('declares a palette as a texture and a choice as a slider', () => {
    const read = pack([palette(), choice()]);
    const { source } = assembleFragmentSource(read ?? ({} as never));
    expect(source).toContain('uniform sampler2D uPalette_colours;');
    expect(source).toContain('uniform float uParam_style;');
  });

  it('reads a world colour from a palette the scene has, and only from one', () => {
    const read = normalizeScenePack({
      ...pack([palette()]),
      params: [palette()],
      world: {
        materials: {
          paint: { kind: 'basic', colour: { palette: 'colours', at: 'level' } },
          lost: { kind: 'basic', colour: { palette: 'nowhere', at: 0.5 } },
        },
        nodes: [{ type: 'mesh', geometry: { kind: 'box' }, material: 'paint' }],
      },
    });
    expect(read?.world?.materials.paint.colour).toEqual({
      palette: 'colours',
      at: 'level',
    });
    expect(read?.world?.materials.lost.colour).toEqual({ hex: '#ffffff' });
  });
});

describe("the author's check", () => {
  it('passes whole palettes and choices, beside the eight sliders', () => {
    const seven = Array.from({ length: 7 }, (_, i) => slider(`s${i}`));
    expect(
      checkProjectParams([daylight, ...seven, palette('a'), palette('b')]),
    ).toEqual([]);
    expect(checkProjectParams([daylight, choice()])).toEqual([]);
  });

  it('names a bad palette, a third palette and a bad choice', () => {
    expect(checkProjectParams([daylight, palette('a', ['#ff0000'])])).toEqual([
      'bad-palette',
    ]);
    expect(
      checkProjectParams([daylight, palette('a', ['#ff0000', 'red'])]),
    ).toEqual(['bad-palette']);
    expect(
      checkProjectParams([daylight, palette('a'), palette('b'), palette('c')]),
    ).toEqual(['too-many-palettes']);
    expect(checkProjectParams([daylight, choice({ max: 5 })])).toEqual([
      'bad-choice',
    ]);
    expect(
      checkProjectParams([
        daylight,
        choice({ options: [{ names: { en: 'Only' } }] }),
      ]),
    ).toEqual(['bad-choice']);
  });

  it('counts a choice among the eight controls', () => {
    const eight = Array.from({ length: 7 }, (_, i) => slider(`s${i}`));
    expect(checkProjectParams([daylight, ...eight, choice()])).toEqual([
      'too-many-params',
    ]);
  });
});
