/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { WORLD_LIMITS } from '../../../common/sceneWorld';
import isSelfContainedModel, {
  readModelCost,
  type IModelCost,
} from '../../../common/worldModelCheck';
import {
  EMPTY_MODEL,
  GLB_BIN_CHUNK,
  GLB_JSON_CHUNK,
  glb,
  glbChunk,
  glbFile,
  jsonChunkBody,
  meshModel,
  pngHeader,
  type IGltfParts,
  type IMeshModelOptions,
} from '../../utils/glbFixture';

/**
 * A model a world carries is somebody else's file, and every listener's
 * machine hands it to three's loader. So it is read against what that loader
 * does — which chunk it keeps, which extensions it acts on, what it allocates
 * from a count alone — and every refusal here sits beside a control the same
 * but for the one thing refused, or "refused" could not be told from "refuses
 * everything".
 */

const FREE: IModelCost = {
  triangles: 0,
  vertices: 0,
  pixels: 0,
  channels: 0,
  transmission: false,
};

const ONE_TRIANGLE: IModelCost = { ...FREE, triangles: 1, vertices: 3 };

const costOf = (model: IGltfParts) => readModelCost(glb(model));

/** `model` with some of its table of contents replaced. */
const patched = (
  model: IGltfParts,
  json: Record<string, unknown>,
): IGltfParts => ({ ...model, json: { ...model.json, ...json } });

/** The triangle, its one primitive given `extra` besides what it has. */
const withPrimitive = (
  extra: Record<string, unknown>,
  options: IMeshModelOptions = {},
): IGltfParts =>
  patched(meshModel(options), {
    meshes: [
      { primitives: [{ attributes: { POSITION: 0 }, indices: 1, ...extra }] },
    ],
  });

const TRIANGLE = meshModel();
const jsonChunk = (json: unknown) =>
  glbChunk(GLB_JSON_CHUNK, jsonChunkBody(json));
const binChunk = (bin: Uint8Array) => glbChunk(GLB_BIN_CHUNK, bin);

describe('what a model costs', () => {
  it('is nothing for an empty scene, which is a model the check accepts', () => {
    expect(costOf(EMPTY_MODEL)).toEqual(FREE);
    expect(isSelfContainedModel(glb(EMPTY_MODEL))).toBe(true);
  });

  it('is one triangle and its three vertices for one indexed triangle on one node', () => {
    expect(costOf(TRIANGLE)).toEqual(ONE_TRIANGLE);
  });

  it('counts the mesh again for every node it is placed on', () => {
    expect(costOf(meshModel({ placements: 3 }))).toEqual({
      ...FREE,
      triangles: 3,
      vertices: 9,
    });
  });

  it('counts every morph target as the mesh’s vertices again, and refuses one past the bound', () => {
    const targets = (count: number) =>
      withPrimitive({
        targets: Array.from({ length: count }, () => ({ POSITION: 0 })),
      });
    expect(costOf(targets(2))).toEqual({ ...ONE_TRIANGLE, vertices: 9 });
    expect(costOf(targets(WORLD_LIMITS.modelMorphTargets))).toEqual({
      ...ONE_TRIANGLE,
      vertices: 3 * (1 + WORLD_LIMITS.modelMorphTargets),
    });
    expect(costOf(targets(WORLD_LIMITS.modelMorphTargets + 1))).toBeNull();
  });

  it('refuses a model past the triangles every model together may have', () => {
    // A thousand triangles a mesh, placed on enough nodes to reach the bound
    // exactly, and on one node more.
    const perMesh = 1000;
    const atBound = WORLD_LIMITS.modelTriangles / perMesh;
    expect(Number.isInteger(atBound)).toBe(true);
    expect(atBound + 1).toBeLessThanOrEqual(WORLD_LIMITS.modelNodes);
    const placed = (placements: number) =>
      costOf(meshModel({ indices: perMesh * 3, placements }));
    expect(placed(atBound)?.triangles).toBe(WORLD_LIMITS.modelTriangles);
    expect(placed(atBound + 1)).toBeNull();
  });
});

describe('the container, read as three reads it', () => {
  it('refuses a second JSON chunk, the table of contents three would keep instead of the first', () => {
    const harmless = EMPTY_MODEL.json;
    const fetching = {
      ...EMPTY_MODEL.json,
      buffers: [{ uri: 'https://example.invalid/model.bin', byteLength: 4 }],
    };
    expect(readModelCost(glbFile([jsonChunk(harmless)]))).toEqual(FREE);
    expect(
      readModelCost(glbFile([jsonChunk(harmless), jsonChunk(fetching)])),
    ).toBeNull();
    expect(
      readModelCost(glbFile([jsonChunk(harmless), jsonChunk(harmless)])),
    ).toBeNull();
  });

  it('refuses bytes after the chunks, a chunk after the binary one, and a binary chunk of another type', () => {
    const json = jsonChunk(TRIANGLE.json);
    expect(readModelCost(glbFile([json, binChunk(TRIANGLE.bin)]))).toEqual(
      ONE_TRIANGLE,
    );
    expect(
      readModelCost(glbFile([json, binChunk(TRIANGLE.bin), new Uint8Array(4)])),
    ).toBeNull();
    expect(
      readModelCost(glbFile([jsonChunk(EMPTY_MODEL.json), new Uint8Array(4)])),
    ).toBeNull();
    expect(
      readModelCost(
        glbFile([json, binChunk(TRIANGLE.bin), binChunk(new Uint8Array(4))]),
      ),
    ).toBeNull();
    expect(
      readModelCost(glbFile([json, glbChunk(0x12345678, TRIANGLE.bin)])),
    ).toBeNull();
  });

  it('refuses a file whose first chunk is not its table of contents', () => {
    expect(
      readModelCost(
        glbFile([binChunk(TRIANGLE.bin), jsonChunk(TRIANGLE.json)]),
      ),
    ).toBeNull();
  });

  it('refuses a header whose length is not the file’s', () => {
    const chunks = [jsonChunk(TRIANGLE.json), binChunk(TRIANGLE.bin)];
    const length = glbFile(chunks).byteLength;
    expect(readModelCost(glbFile(chunks, length))).toEqual(ONE_TRIANGLE);
    expect(readModelCost(glbFile(chunks, length + 4))).toBeNull();
    expect(readModelCost(glbFile(chunks, length - 4))).toBeNull();
  });
});

describe('what a model may name', () => {
  const [buffer] = TRIANGLE.json.buffers as { byteLength: number }[];
  const painted = meshModel({
    images: [{ bytes: pngHeader(2, 2), mimeType: 'image/png' }],
  });
  /** A `uri` field when one is given, and nothing otherwise. */
  const naming = (uri?: string) => (uri === undefined ? {} : { uri });

  // Each model reads whole without its uri, so the uri alone is refused.
  it.each<[string, IGltfParts, (uri?: string) => Record<string, unknown>]>([
    [
      'a buffer the file carries',
      TRIANGLE,
      (uri) => ({ buffers: [{ ...buffer, ...naming(uri) }] }),
    ],
    [
      'an image the file carries',
      painted,
      (uri) => ({
        images: [{ bufferView: 2, mimeType: 'image/png', ...naming(uri) }],
      }),
    ],
    [
      'a node’s extras',
      TRIANGLE,
      (uri) => ({ nodes: [{ mesh: 0, extras: { ...naming(uri) } }] }),
    ],
    [
      'a list deep in the asset’s extras',
      TRIANGLE,
      (uri) => ({ asset: { version: '2.0', extras: { deep: [naming(uri)] } } }),
    ],
  ])('refuses a uri in %s, whatever it points at', (_where, model, fields) => {
    expect(costOf(patched(model, fields()))).not.toBeNull();
    expect(
      costOf(patched(model, fields('https://example.invalid/model.bin'))),
    ).toBeNull();
    expect(costOf(patched(model, fields('')))).toBeNull();
  });

  it('refuses an extension a node acts on without the file declaring it', () => {
    const instanced = patched(TRIANGLE, {
      nodes: [
        {
          mesh: 0,
          extensions: {
            EXT_mesh_gpu_instancing: { attributes: { TRANSLATION: 0 } },
          },
        },
      ],
    });
    expect(instanced.json.extensionsUsed).toBeUndefined();
    expect(costOf(instanced)).toBeNull();
    expect(
      costOf(patched(TRIANGLE, { nodes: [{ mesh: 0, extensions: 'on' }] })),
    ).toBeNull();
  });

  it('refuses a model that brings lights of its own, declared or not', () => {
    const lit = {
      nodes: [{ mesh: 0, extensions: { KHR_lights_punctual: { light: 0 } } }],
    };
    expect(costOf(patched(TRIANGLE, lit))).toBeNull();
    expect(
      costOf(
        patched(TRIANGLE, {
          ...lit,
          extensionsUsed: ['KHR_lights_punctual'],
          extensions: { KHR_lights_punctual: { lights: [{ type: 'point' }] } },
        }),
      ),
    ).toBeNull();
  });

  it('reads a material extension the engine was built for', () => {
    const unlit = patched(TRIANGLE, {
      extensionsUsed: ['KHR_materials_unlit'],
      extensionsRequired: ['KHR_materials_unlit'],
      materials: [{ extensions: { KHR_materials_unlit: {} } }],
      meshes: [
        {
          primitives: [
            { attributes: { POSITION: 0 }, indices: 1, material: 0 },
          ],
        },
      ],
    });
    expect(costOf(unlit)).toEqual(ONE_TRIANGLE);
  });

  it.each([
    ['extensionsUsed', ['KHR_draco_mesh_compression']],
    ['extensionsRequired', ['KHR_texture_basisu']],
    ['extensionsUsed', ['KHR_materials_unlit', 7]],
  ])('refuses %s naming %j, used anywhere or not', (key, names) => {
    expect(costOf(patched(TRIANGLE, { [key]: names }))).toBeNull();
  });
});

describe('what a model allocates', () => {
  const accessor = (extra: Record<string, unknown>) =>
    patched(TRIANGLE, {
      accessors: [
        { componentType: 5126, count: 3, type: 'VEC3', ...extra },
        { bufferView: 1, componentType: 5123, count: 3, type: 'SCALAR' },
      ],
    });

  it('refuses an accessor with no buffer view, which three fills from its count alone', () => {
    expect(costOf(accessor({ bufferView: 0 }))).toEqual(ONE_TRIANGLE);
    expect(costOf(accessor({}))).toBeNull();
  });

  it('refuses an accessor that runs past the end of its view', () => {
    // The positions' view is 36 bytes: three VEC3s of floats exactly.
    expect(costOf(accessor({ bufferView: 0, count: 4 }))).toBeNull();
    expect(costOf(accessor({ bufferView: 0, byteOffset: 4 }))).toBeNull();
    const strided = (byteStride: number) => {
      const model = accessor({ bufferView: 0 });
      const views = model.json.bufferViews as Record<string, unknown>[];
      return patched(model, {
        bufferViews: [{ ...views[0], byteStride }, views[1]],
      });
    };
    expect(costOf(strided(12))).toEqual(ONE_TRIANGLE);
    // Sixteen bytes a vertex: the third starts at 32 and ends at 44.
    expect(costOf(strided(16))).toBeNull();
  });

  it('refuses a sparse accessor', () => {
    expect(
      costOf(
        accessor({
          bufferView: 0,
          sparse: {
            count: 1,
            indices: { bufferView: 1, componentType: 5123 },
            values: { bufferView: 0 },
          },
        }),
      ),
    ).toBeNull();
  });

  it('refuses a view past its buffer, a buffer past the binary chunk, and a second buffer', () => {
    const views = TRIANGLE.json.bufferViews as Record<string, unknown>[];
    const [buffer] = TRIANGLE.json.buffers as { byteLength: number }[];
    expect(
      costOf(
        patched(TRIANGLE, {
          bufferViews: [views[0], { ...views[1], byteLength: 16 }],
        }),
      ),
    ).toBeNull();
    expect(
      costOf(
        patched(TRIANGLE, {
          buffers: [{ byteLength: buffer.byteLength + 4 }],
        }),
      ),
    ).toBeNull();
    // Four bytes carried, and the buffers naming them: no view reads either.
    const buffers = (count: number) =>
      costOf({
        json: {
          ...EMPTY_MODEL.json,
          buffers: Array.from({ length: count }, () => ({ byteLength: 4 })),
        },
        bin: new Uint8Array(4),
      });
    expect(buffers(1)).toEqual(FREE);
    expect(buffers(2)).toBeNull();
  });
});

describe('what a model draws', () => {
  it.each([
    [0, 'points'],
    [1, 'lines'],
    [2, 'a line loop'],
    [3, 'a line strip'],
  ])('refuses a primitive of mode %d, %s', (mode) => {
    expect(costOf(withPrimitive({ mode }))).toBeNull();
  });

  it.each([
    [4, 'triangles', 1],
    [5, 'a strip', 3],
    [6, 'a fan', 3],
  ])(
    'counts five indices of mode %d, %s, as %d triangles',
    (mode, _kind, triangles) => {
      expect(costOf(withPrimitive({ mode }, { indices: 5 }))).toEqual({
        ...ONE_TRIANGLE,
        triangles,
      });
    },
  );
});

describe('the tree three builds', () => {
  const tree = (nodes: unknown[], roots: number[] = [0]) =>
    costOf(patched(TRIANGLE, { nodes, scenes: [{ nodes: roots }] }));

  it('builds a tree of nodes once each', () => {
    expect(tree([{ children: [1] }, { mesh: 0 }])).toEqual(ONE_TRIANGLE);
  });

  it('refuses a node that is its own ancestor', () => {
    expect(tree([{ children: [1] }, { mesh: 0, children: [0] }])).toBeNull();
    expect(tree([{ mesh: 0, children: [0] }])).toBeNull();
  });

  it('refuses a node with two parents, which three would build twice', () => {
    expect(
      tree([{ children: [2] }, { children: [2] }, { mesh: 0 }], [0, 1]),
    ).toBeNull();
    expect(tree([{ mesh: 0 }], [0, 0])).toBeNull();
  });

  it('refuses a root that is another node’s child, which three builds under its parent and again in the scene', () => {
    // Cloned into the scene subtree and all, so a chain of such roots grows
    // as the square of its length.
    expect(tree([{ children: [1] }, { mesh: 0 }], [0])).toEqual(ONE_TRIANGLE);
    expect(tree([{ children: [1] }, { mesh: 0 }], [0, 1])).toBeNull();
    // Nor is a child alone a root: the format asks every root to be one.
    expect(tree([{ children: [1] }, { mesh: 0 }], [1])).toBeNull();
  });

  it('refuses two scenes, and a default scene other than its one', () => {
    expect(costOf(patched(TRIANGLE, { scene: 0 }))).toEqual(ONE_TRIANGLE);
    expect(costOf(patched(TRIANGLE, { scene: 1 }))).toBeNull();
    expect(
      costOf(patched(TRIANGLE, { scenes: [{ nodes: [0] }, { nodes: [0] }] })),
    ).toBeNull();
  });

  it('refuses a file that is not glTF 2', () => {
    expect(costOf(patched(TRIANGLE, { asset: { version: '2.1' } }))).toEqual(
      ONE_TRIANGLE,
    );
    expect(costOf(patched(TRIANGLE, { asset: { version: '1.0' } }))).toBeNull();
    expect(costOf(patched(TRIANGLE, { asset: {} }))).toBeNull();
  });
});

describe('what a model moves and how it is lit', () => {
  const clip = (channels: number) =>
    patched(TRIANGLE, {
      animations: [
        {
          samplers: [{ input: 0, output: 0 }],
          channels: Array.from({ length: channels }, () => ({
            sampler: 0,
            target: { node: 0, path: 'translation' },
          })),
        },
      ],
    });

  it('counts its busiest clip’s channels and refuses a clip past the bound', () => {
    expect(costOf(clip(WORLD_LIMITS.modelChannels))).toEqual({
      ...ONE_TRIANGLE,
      channels: WORLD_LIMITS.modelChannels,
    });
    expect(costOf(clip(WORLD_LIMITS.modelChannels + 1))).toBeNull();
  });

  it('says a model with a transmissive material has three draw the world again behind it', () => {
    const material = (extensions: Record<string, unknown>) =>
      costOf(
        patched(TRIANGLE, {
          extensionsUsed: Object.keys(extensions),
          materials: [{ extensions }],
        }),
      );
    expect(material({})?.transmission).toBe(false);
    expect(
      material({ KHR_materials_transmission: { transmissionFactor: 1 } }),
    ).toEqual({ ...ONE_TRIANGLE, transmission: true });
  });
});
