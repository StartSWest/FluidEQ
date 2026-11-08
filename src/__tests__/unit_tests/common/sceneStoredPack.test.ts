import { createHash } from 'crypto';
import { normalizeScenePack } from 'common/scenePacks';
import { canonicalPreviewPayload } from 'common/scenePreviewMedia';
import storedScenePack from 'common/sceneStoredPack';
import { previewPackSha256 } from '../../../main/plus/scenePreviewApi';

// A scene as it is stored and as the signing service reads it: every control
// an entry of `params` - sliders and choices in order, then palettes, then
// single colours - which is what the service hands back after its checks.
const stored = {
  schema: 1,
  id: 'chrome',
  version: 23,
  contract: 9,
  names: { en: 'Chrome' },
  fallbackStyle: 'skyline',
  swatch: ['#050a1a', '#00e5cf'],
  source: 'vec4 sceneColour(vec2 uv) { return vec4(uParam_gloss); }\n',
  params: [
    { id: 'gloss', names: { en: 'Gloss' }, min: 0, max: 1, value: 0.85 },
    {
      type: 'choice',
      id: 'style',
      names: { en: 'Colour mode' },
      min: 0,
      max: 1,
      value: 1,
      options: [{ names: { en: 'One colour' } }, { names: { en: 'Palette' } }],
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
};

const built = () => {
  const pack = normalizeScenePack(stored);
  if (!pack) {
    throw new Error('the fixture is not a scene');
  }
  return pack;
};

it('reads the built palette, colour and choice apart from the sliders', () => {
  const pack = built();
  expect(pack.params.map((param) => param.id)).toEqual(['gloss', 'style']);
  expect(pack.palettes?.map((palette) => palette.id)).toEqual(['colours']);
  expect(pack.colours?.map((colour) => colour.id)).toEqual(['single']);
});

it('puts every control back into params, in the order the service signs it', () => {
  const back = storedScenePack(built());
  expect('palettes' in back).toBe(false);
  expect('colours' in back).toBe(false);
  expect(
    (back.params as { id: string; type?: string }[]).map(
      ({ id, type }) => `${id}:${type ?? 'slider'}`,
    ),
  ).toEqual([
    'gloss:slider',
    'style:choice',
    'colours:palette',
    'single:colour',
  ]);
});

it('reads back as the very scene it was written from', () => {
  const pack = built();
  expect(normalizeScenePack(storedScenePack(pack))).toEqual(pack);
});

// The clip's stamp: main and the window take it over this layout, and the
// service takes it over what its checks return, which is this layout. Over
// the built layout the two never met, and Chrome was refused at every press.
it('stamps a clip over the scene as the service rebuilds it', () => {
  const pack = built();
  const expected = createHash('sha256')
    .update(canonicalPreviewPayload(normalizeStored(stored)))
    .digest('hex');
  expect(previewPackSha256(pack)).toBe(expected);
  expect(previewPackSha256(pack)).not.toBe(
    createHash('sha256').update(canonicalPreviewPayload(pack)).digest('hex'),
  );
});

it('leaves a scene with none of the three as it was', () => {
  const plain = builtFrom({ ...stored, params: [stored.params[0]] });
  expect(canonicalPreviewPayload(storedScenePack(plain))).toBe(
    canonicalPreviewPayload(plain),
  );
});

/** A stored scene as the reader settles it. */
function builtFrom(value: unknown) {
  const pack = normalizeScenePack(value);
  if (!pack) {
    throw new Error('the fixture is not a scene');
  }
  return pack;
}

/** The stored fixture as the reader settles it, written back. */
function normalizeStored(value: unknown) {
  return storedScenePack(builtFrom(value));
}
