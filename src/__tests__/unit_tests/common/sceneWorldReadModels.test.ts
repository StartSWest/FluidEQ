/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { WORLD_LIMITS } from '../../../common/sceneWorld';
import normalizeSceneWorld from '../../../common/sceneWorldRead';
import {
  glb,
  meshModel,
  modelData,
  pngHeader,
  type IGltfParts,
} from '../../utils/glbFixture';

/**
 * The models a world keeps: only those the model check reads
 * (`worldModelCheck.ts`), and of those only what fits beside the ones before
 * it — triangles and decoded image pixels across every model together. A
 * model past a total is left out and the models after it still read, so the
 * totals are running ones and not a verdict on the world.
 */

const BOX = { type: 'mesh', geometry: { kind: 'box' } };

const dataOf = (model: IGltfParts) => modelData(glb(model));

const kept = (models: Record<string, string>, nodes: unknown[] = [BOX]) =>
  normalizeSceneWorld(
    {
      models: Object.fromEntries(
        Object.entries(models).map(([id, data]) => [id, { data }]),
      ),
      nodes,
    },
    [],
  );

const TRIANGLE = dataOf(meshModel());

describe('the models of a world', () => {
  it('keeps a model the check reads and leaves out one it refuses, with every placement of it', () => {
    const fetching = meshModel();
    const world = kept(
      {
        ship: TRIANGLE,
        probe: dataOf({
          ...fetching,
          json: {
            ...fetching.json,
            buffers: [{ uri: 'https://example.invalid/', byteLength: 44 }],
          },
        }),
        text: 'not a model',
      },
      [
        { type: 'model', model: 'ship', name: 'ship' },
        { type: 'model', model: 'probe', name: 'probe' },
        { type: 'model', model: 'text', name: 'text' },
      ],
    );
    expect(Object.keys(world?.models ?? {})).toEqual(['ship']);
    expect(world?.models.ship).toEqual({ data: TRIANGLE });
    expect((world?.nodes ?? []).map((node) => node.name)).toEqual(['ship']);
  });

  it('leaves out a model past the triangles every model may have together, and reads the smaller one after it', () => {
    // A thousand triangles a node, on just over half the bound's nodes: two
    // of them are past it, and one of them and a triangle are not.
    const placements = Math.floor(WORLD_LIMITS.modelTriangles / 2 / 1000) + 1;
    const big = dataOf(meshModel({ indices: 3000, placements }));
    expect(Object.keys(kept({ a: big })?.models ?? {})).toEqual(['a']);
    expect(
      Object.keys(kept({ a: big, b: big, c: TRIANGLE })?.models ?? {}),
    ).toEqual(['a', 'c']);
  });

  it('leaves out a model past the image pixels every model may decode to together, and reads one with none after it', () => {
    const side = WORLD_LIMITS.modelImageSide;
    const painted = (width: number, height: number) =>
      dataOf(
        meshModel({
          images: [{ bytes: pngHeader(width, height), mimeType: 'image/png' }],
        }),
      );
    const full = painted(side, WORLD_LIMITS.modelImagePixels / side);
    expect(
      Object.keys(
        kept({ a: full, b: painted(1, 1), c: TRIANGLE })?.models ?? {},
      ),
    ).toEqual(['a', 'c']);
    expect(
      Object.keys(kept({ b: painted(1, 1), c: TRIANGLE })?.models ?? {}),
    ).toEqual(['b', 'c']);
  });
});
