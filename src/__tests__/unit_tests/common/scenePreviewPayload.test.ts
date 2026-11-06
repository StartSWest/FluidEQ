import {
  canonicalPreviewPayload,
  stripPublishedGlslComments,
} from '../../../common/scenePreviewPayload';

const pack = {
  schema: 1,
  id: 'lake',
  version: 4,
  contract: 8,
  names: { en: 'Lake' },
  fallbackStyle: 'skyline',
  swatch: ['#112233', '#334455'],
  params: [],
  source:
    '// The maker’s scene\nvec4 sceneColour(vec2 uv) {\n  /* light */ return vec4(uv, 0.0, 1.0); // rgba\n}\n',
};

it('hashes the commented local scene exactly as the signing transformation does', () => {
  const published = {
    ...pack,
    source: stripPublishedGlslComments(pack.source),
  };
  expect(canonicalPreviewPayload(pack)).toBe(
    canonicalPreviewPayload(published),
  );
  expect(
    canonicalPreviewPayload({
      ...pack,
      source: pack.source.replace('0.0', '0.5'),
    }),
  ).not.toBe(canonicalPreviewPayload(pack));
});

it('keeps versions, settings, asset bytes and array ordering in the identity', () => {
  [
    { ...pack, version: 5 },
    { ...pack, params: [{ id: 'depth', value: 0.5 }] },
    { ...pack, artwork: { data: 'changed' } },
    { ...pack, swatch: [...pack.swatch].reverse() },
  ].forEach((changed) => {
    expect(canonicalPreviewPayload(changed)).not.toBe(
      canonicalPreviewPayload(pack),
    );
  });
  expect(
    canonicalPreviewPayload(Object.fromEntries(Object.entries(pack).reverse())),
  ).toBe(canonicalPreviewPayload(pack));
});

it('normalizes the world text removed by signing and preserves semantic hook edits', () => {
  const world = {
    materials: { light: { fragment: '// glow\nreturn vec3(1.0);\n' } },
    nodes: [{ name: 'Editor name', material: 'light', children: [] }],
  };
  const original = { ...pack, world };
  const published = {
    ...pack,
    world: {
      ...world,
      materials: {
        light: {
          fragment: stripPublishedGlslComments(world.materials.light.fragment),
        },
      },
      nodes: [{ material: 'light', children: [] }],
    },
  };
  expect(canonicalPreviewPayload(original)).toBe(
    canonicalPreviewPayload(published),
  );
  expect(
    canonicalPreviewPayload({
      ...original,
      world: {
        ...world,
        materials: { light: { fragment: 'return vec3(.5);' } },
      },
    }),
  ).not.toBe(canonicalPreviewPayload(original));
});

it('refuses unterminated comments instead of producing an identity for another program', () => {
  expect(() =>
    canonicalPreviewPayload({ ...pack, source: '/* never closes' }),
  ).toThrow('Unterminated');
});
