/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { Mesh, MeshStandardMaterial, PerspectiveCamera, Texture } from 'three';
import type { IScenePack } from '../../../common/scenePacks';
import normalizeSceneWorld from '../../../common/sceneWorldRead';
import type { ISceneFrame } from '../../../renderer/graph/sceneGl';
import { createWorldInputs } from '../../../renderer/graph/world/worldInputs';
import { buildWorldNodes } from '../../../renderer/graph/world/worldNodes';

jest.mock('three/examples/jsm/utils/SkeletonUtils.js', () => ({
  clone: jest.fn(),
}));

/**
 * A material plays its map's region as an animation's sheet of frames
 * (`frames`, Ivan 2026-11-09: "put the wolf and other animal on
 * animation"): one cell of the sheet shows at a time, the one its formula
 * names, wrapped round the cycle. Beside each, the control: the same map
 * with no frames keeps showing its whole region.
 */

// A 2048 x 1024 artwork; the sheet is its lower half, eight 256 x 256
// frames, four to a row.
const ARTWORK = { width: 2048, height: 1024 };
const SHEET = [0, 512, 1024, 512];

const frameAt = (timeSeconds: number): ISceneFrame => ({
  timeSeconds,
  deltaMs: 1000 / 30,
  level: 0.5,
  beat: 0,
  bands: [0.2, 0.2, 0.2],
  musicAccent: [0, 0],
  musicRun: [0, 0],
  accent: [1, 1, 1],
  fade: 1,
  spectrum: new Uint8Array(512),
  waveform: new Uint8Array(128),
  params: {},
});

const buildWalker = (material: Record<string, unknown>) => {
  const world = normalizeSceneWorld(
    {
      materials: { walker: material },
      nodes: [
        { type: 'mesh', geometry: { kind: 'plane' }, material: 'walker' },
      ],
    },
    [],
    ARTWORK,
  );
  if (!world) {
    throw new Error('the world did not read');
  }
  const atlas = new Texture({ width: ARTWORK.width, height: ARTWORK.height });
  const pack = { params: [], world } as unknown as IScenePack;
  const inputs = createWorldInputs(pack, atlas);
  const build = buildWorldNodes(
    world,
    inputs,
    { inputs, declarations: '', atlas, fogToBackdrop: false, mirror: null },
    {},
    new PerspectiveCamera(),
  );
  const mesh = build.root.children[0];
  if (
    !(mesh instanceof Mesh) ||
    !(mesh.material instanceof MeshStandardMaterial)
  ) {
    throw new Error('not a lit mesh');
  }
  const { map } = mesh.material;
  if (!map) {
    throw new Error('no map');
  }
  return {
    world,
    map,
    at: (time: number) => {
      inputs.update(frameAt(time), 640, 360);
      build.update(1 / 30);
      return [map.offset.x, map.offset.y];
    },
  };
};

describe('a material playing its map as frames', () => {
  it('shows one frame of the sheet at a time, in order, and wraps', () => {
    const walker = buildWalker({
      map: SHEET,
      frames: { count: 8, columns: 4, frame: 'time * 8' },
    });
    // One cell: 256 of 2048 across, 256 of 1024 down.
    expect([walker.map.repeat.x, walker.map.repeat.y]).toEqual([0.125, 0.25]);
    // Frame 0, top left of the sheet (the artwork is decoded flipped).
    expect(walker.at(0)).toEqual([0, 0.25]);
    // Frame 5: second row, second column.
    expect(walker.at(5 / 8)).toEqual([0.125, 0]);
    // Frame 8 is frame 0 again.
    expect(walker.at(1)).toEqual([0, 0.25]);
  });

  it('plays backwards when its formula counts down', () => {
    const walker = buildWalker({
      map: SHEET,
      frames: { count: 8, columns: 4, frame: '-1' },
    });
    // Frame -1 is the last one: second row, fourth column.
    expect(walker.at(0)).toEqual([0.375, 0]);
  });

  it('leaves a map without frames showing its whole region', () => {
    const still = buildWalker({ map: SHEET });
    expect([still.map.repeat.x, still.map.repeat.y]).toEqual([0.5, 0.5]);
    const first = still.at(0);
    expect(still.at(5 / 8)).toEqual(first);
  });
});

describe('a sheet of frames as the reader takes it', () => {
  const framesOf = (material: Record<string, unknown>) =>
    normalizeSceneWorld(
      {
        materials: { walker: material },
        nodes: [
          { type: 'mesh', geometry: { kind: 'plane' }, material: 'walker' },
        ],
      },
      [],
      ARTWORK,
    )?.materials.walker.frames;

  it('plays eight a second and lays every frame in one row when unsaid', () => {
    expect(framesOf({ map: SHEET, frames: { count: 6 } })).toEqual({
      count: 6,
      columns: 6,
      frame: 'time * 8',
    });
  });

  it('is kept inside its bounds', () => {
    expect(
      framesOf({ map: SHEET, frames: { count: 9000, columns: 9000 } }),
    ).toMatchObject({ count: 256, columns: 256 });
    expect(
      framesOf({ map: SHEET, frames: { count: 0, columns: -3 } }),
    ).toMatchObject({ count: 1, columns: 1 });
  });

  it('takes the default for a formula it cannot run', () => {
    expect(
      framesOf({ map: SHEET, frames: { count: 4, frame: 'fetch(1)' } }),
    ).toMatchObject({ frame: 'time * 8' });
  });

  it('is dropped where there is no map to cut frames from', () => {
    expect(framesOf({ frames: { count: 4 } })).toBeUndefined();
  });
});
