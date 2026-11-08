import { checkProjectParams } from 'common/memberScenes';
import { readChoiceLook } from 'common/sceneChoice';
import { colourLinear } from 'common/sceneColourControl';
import { normalizeScenePack } from 'common/scenePacks';
import { isShownBy, readShowWhen } from 'common/sceneShowWhen';
import { assembleFragmentSource } from 'common/sceneUniformContract';

// A scene's single colours (`"type": "colour"`, `uColour_<id>` in linear
// light), the icon or chip on a choice's options, and `showWhen`, which shows
// a control in the Studio only while a choice has one of the listed options.

const daylight = {
  id: 'daylight',
  names: { en: 'Daylight' },
  min: 0,
  max: 100,
  value: 100,
};
const slider = (id: string, over: Record<string, unknown> = {}) => ({
  id,
  names: { en: id },
  min: 0,
  max: 1,
  value: 0.5,
  ...over,
});
const colour = (id = 'tint', over: Record<string, unknown> = {}) => ({
  id,
  type: 'colour',
  names: { en: 'Tint' },
  value: '#00B3A4',
  ...over,
});
const choice = (over: Record<string, unknown> = {}) => ({
  id: 'mode',
  type: 'choice',
  names: { en: 'Mode' },
  min: 0,
  max: 2,
  value: 0,
  options: [
    { names: { en: 'One' }, icon: 'drop' },
    { names: { en: 'Gradient' }, swatch: ['#FF3030', '#6b4cff'] },
    { names: { en: 'Rainbow' } },
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

describe('single colours', () => {
  it('are read apart from the sliders, lower-cased, four at most', () => {
    const eight = Array.from({ length: 8 }, (_, i) => slider(`s${i}`));
    const five = Array.from({ length: 5 }, (_, i) => colour(`c${i}`));
    const read = pack([...eight, ...five]);
    expect(read?.params).toHaveLength(8);
    expect(read?.colours?.map((each) => each.id)).toEqual([
      'c0',
      'c1',
      'c2',
      'c3',
    ]);
    expect(read?.colours?.[0]).toEqual({
      id: 'c0',
      names: { en: 'Tint' },
      value: '#00b3a4',
    });
  });

  it('drop one with a bad value, or one that takes another control id', () => {
    expect(pack([colour('tint', { value: 'teal' })])?.colours).toBeUndefined();
    expect(pack([slider('tint'), colour()])?.colours).toBeUndefined();
    // The positive control: the same colour alone is read.
    expect(pack([colour()])?.colours).toHaveLength(1);
  });

  it('are declared to the shader as a vec3', () => {
    const { source } = assembleFragmentSource(
      pack([colour()]) ?? ({} as never),
    );
    expect(source).toContain('uniform vec3 uColour_tint;');
  });

  it('reach the shader in linear light', () => {
    expect(colourLinear('#ffffff')).toEqual([1, 1, 1]);
    expect(colourLinear('#000000')).toEqual([0, 0, 0]);
    const [grey] = colourLinear('#808080');
    expect(grey).toBeCloseTo(0.2158605, 6);
    const [r, g, b] = colourLinear('#ff0080');
    expect([r, g]).toEqual([1, 0]);
    expect(b).toBeCloseTo(0.2158605, 6);
  });
});

describe("a choice's option looks", () => {
  it('keep an icon FluidEQ draws and a chip of one to four colours', () => {
    const [read] = pack([choice()])?.params ?? [];
    expect(read.options).toEqual([
      { names: { en: 'One' }, icon: 'drop' },
      { names: { en: 'Gradient' }, swatch: ['#ff3030', '#6b4cff'] },
      { names: { en: 'Rainbow' } },
    ]);
  });

  it('leave out what they cannot draw', () => {
    expect(readChoiceLook({ icon: 'rocket', swatch: ['red'] })).toEqual({});
    expect(
      readChoiceLook({
        swatch: ['#111111', '#222222', '#333333', '#444444', '#555555'],
      }),
    ).toEqual({ swatch: ['#111111', '#222222', '#333333', '#444444'] });
    expect(readChoiceLook(null)).toEqual({});
  });
});

describe('showWhen', () => {
  it('is read on every kind of control, and absent where none is given', () => {
    const read = pack([
      choice(),
      slider('glow', { showWhen: { mode: [2, 0, 2] } }),
      colour('tint', { showWhen: { mode: [0] } }),
      {
        id: 'colours',
        type: 'palette',
        names: { en: 'Colours' },
        stops: ['#ff3030', '#6b4cff'],
        showWhen: { mode: [1, 2] },
      },
    ]);
    expect(read?.params[0]).not.toHaveProperty('showWhen');
    expect(read?.params[1].showWhen).toEqual({ mode: [0, 2] });
    expect(read?.colours?.[0].showWhen).toEqual({ mode: [0] });
    expect(read?.palettes?.[0].showWhen).toEqual({ mode: [1, 2] });
  });

  it('keeps what it can read of a rule and nothing else', () => {
    expect(readShowWhen({ mode: [0, 9, 1.5, 1] })).toEqual({ mode: [0, 1] });
    expect(readShowWhen({ Mode: [0] })).toBeUndefined();
    expect(readShowWhen([0])).toBeUndefined();
    expect(readShowWhen({ a: [0], b: [1], c: [2] })).toEqual({
      a: [0],
      b: [1],
    });
  });

  it('shows a control only while every choice it names has a listed option', () => {
    const ids = new Set(['mode', 'style']);
    const rule = { mode: [0, 2], style: [1] };
    expect(isShownBy(rule, { mode: 2, style: 1 }, ids)).toBe(true);
    expect(isShownBy(rule, { mode: 1, style: 1 }, ids)).toBe(false);
    expect(isShownBy(rule, { mode: 0, style: 0 }, ids)).toBe(false);
    // A choice not yet moved sits at its first option.
    expect(isShownBy({ mode: [0] }, {}, ids)).toBe(true);
    expect(isShownBy({ mode: [1] }, {}, ids)).toBe(false);
    // A value between options is the nearest one.
    expect(isShownBy({ mode: [2] }, { mode: 1.6 }, ids)).toBe(true);
    expect(isShownBy(undefined, { mode: 1 }, ids)).toBe(true);
  });

  it('hides nothing for a choice the scene has not got', () => {
    expect(isShownBy({ gone: [3] }, {}, new Set(['mode']))).toBe(true);
  });
});

describe("the author's check", () => {
  it('passes whole colours, which do not count among the eight controls', () => {
    const seven = Array.from({ length: 7 }, (_, i) => slider(`s${i}`));
    const four = Array.from({ length: 4 }, (_, i) => colour(`c${i}`));
    expect(checkProjectParams([daylight, ...seven, ...four])).toEqual([]);
    expect(checkProjectParams([daylight, choice(), colour()])).toEqual([]);
    // The ninth control is still one too many, colours or not.
    expect(
      checkProjectParams([daylight, ...seven, ...four, slider('x')]),
    ).toEqual(['too-many-params']);
  });

  it('names a bad colour, a fifth colour, a bad look and a bad rule', () => {
    expect(
      checkProjectParams([daylight, colour('tint', { value: '#fff' })]),
    ).toEqual(['bad-colour']);
    const five = Array.from({ length: 5 }, (_, i) => colour(`c${i}`));
    expect(checkProjectParams([daylight, ...five])).toEqual(['bad-colour']);
    expect(
      checkProjectParams([
        daylight,
        choice({
          options: [
            { names: { en: 'A' }, icon: 'rocket' },
            { names: { en: 'B' } },
          ],
        }),
      ]),
    ).toEqual(['bad-choice']);
    [{ mode: [] }, { mode: [8] }, [0], { M: [0] }].forEach((showWhen) => {
      expect(
        checkProjectParams([daylight, slider('glow', { showWhen })]),
      ).toEqual(['bad-show-when']);
    });
    // The positive control: the same slider with a whole rule passes.
    expect(
      checkProjectParams([
        daylight,
        slider('glow', { showWhen: { mode: [1] } }),
      ]),
    ).toEqual([]);
  });
});
