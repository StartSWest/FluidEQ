/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import {
  InstancedMesh,
  Matrix4,
  Mesh,
  PerspectiveCamera,
  Points,
  type BufferAttribute,
  type Object3D,
} from 'three';
import type { IScenePack } from '../../../common/scenePacks';
import normalizeSceneWorld from '../../../common/sceneWorldRead';
import type { ISceneFrame } from '../../../renderer/graph/sceneGl';
import { createWorldInputs } from '../../../renderer/graph/world/worldInputs';
import { buildWorldNodes } from '../../../renderer/graph/world/worldNodes';

// Models are not built here; their loader's add-ons are ES modules Jest
// does not transform.
jest.mock('three/examples/jsm/utils/SkeletonUtils.js', () => ({
  clone: jest.fn(),
}));

/**
 * A node hidden by its own `visible` does no work while it is hidden — a
 * ribbon's samples and a set of copies' live formulas used to be worked out
 * and sent up every frame, drawn or not — and is worked out in the very
 * frame it shows, never drawn from its last showing. Where something in it
 * remembers (`smooth`, `decay`, `integrate`), it keeps being worked out, or
 * that memory would stand still while hidden. Each rule stands beside its
 * control: the same node always shown, or the same node forgetting.
 */

const frameAt = (timeSeconds: number, beat: number): ISceneFrame => ({
  timeSeconds,
  deltaMs: 1000 / 30,
  level: 0.5,
  beat,
  bands: [0.2, 0.2, 0.2],
  musicAccent: [0, 0],
  musicRun: [0, 0],
  accent: [1, 1, 1],
  fade: 1,
  spectrum: new Uint8Array(512),
  waveform: new Uint8Array(128),
  params: {},
});

/** A world of `nodes`, built and ready to be stepped a frame at a time. */
const buildWorld = (
  nodes: unknown[],
  materials: Record<string, unknown> = {},
) => {
  const world = normalizeSceneWorld({ materials, nodes }, []);
  if (!world) {
    throw new Error('the world did not read');
  }
  const pack = { params: [], world } as unknown as IScenePack;
  const inputs = createWorldInputs(pack, null);
  const build = buildWorldNodes(
    world,
    inputs,
    {
      inputs,
      declarations: '',
      atlas: null,
      fogToBackdrop: false,
      mirror: null,
    },
    {},
    new PerspectiveCamera(),
  );
  const step = (time: number, beat: number) => {
    inputs.update(frameAt(time, beat), 640, 360);
    build.update(1 / 30);
  };
  return { first: build.root.children[0], step };
};

const positionsOf = (object: Object3D | undefined): BufferAttribute => {
  if (!(object instanceof Mesh) && !(object instanceof Points)) {
    throw new Error('not a mesh or points');
  }
  return object.geometry.getAttribute('position') as BufferAttribute;
};

/**
 * A version counter read after a first frame shown (time 0), three hidden
 * (beat 0 at times 1 to 3) and one shown again (time 4).
 */
const hiddenThenShown = (
  step: (time: number, beat: number) => void,
  version: () => number,
) => {
  step(0, 1);
  const before = version();
  [1, 2, 3].forEach((time) => step(time, 0));
  const hidden = version();
  step(4, 1);
  return { before, hidden, shown: version() };
};

describe('a ribbon hidden by its own visible', () => {
  const ribbon = (overrides: Record<string, unknown>) => ({
    type: 'ribbon',
    segments: 4,
    point: ['u * 10', 'time', 0],
    width: 0.5,
    ...overrides,
  });

  it('is not worked out while hidden, and is worked out in the frame it shows', () => {
    const { first, step } = buildWorld([ribbon({ visible: 'beat > 0.5' })]);
    const positions = positionsOf(first);
    const { before, hidden, shown } = hiddenThenShown(
      step,
      () => positions.version,
    );
    expect(hidden).toBe(before);
    expect(shown).toBeGreaterThan(hidden);
    // The shown frame's own geometry: `time` is 4, not the 0 it last
    // showed with.
    expect(positions.getY(0)).toBeCloseTo(4);
    expect(first?.visible).toBe(true);
  });

  it('is worked out every frame when it always shows', () => {
    const { first, step } = buildWorld([ribbon({})]);
    const positions = positionsOf(first);
    const { before, hidden } = hiddenThenShown(step, () => positions.version);
    expect(hidden).toBeGreaterThan(before);
  });

  it('keeps being worked out while hidden when its points remember', () => {
    const { first, step } = buildWorld([
      ribbon({ visible: 'beat > 0.5', point: ['u', 'smooth(time, 0.5)', 0] }),
    ]);
    const positions = positionsOf(first);
    const { before, hidden } = hiddenThenShown(step, () => positions.version);
    expect(hidden).toBeGreaterThan(before);
  });

  it('keeps being worked out while hidden when its material remembers', () => {
    const nodes = [ribbon({ visible: 'beat > 0.5', material: 'tint' })];
    const tinted = (red: string) => ({
      tint: { kind: 'glow', colour: { rgb: [red, 1, 1] } },
    });
    const remembering = buildWorld(nodes, tinted('decay(beat, 0.3)'));
    const kept = positionsOf(remembering.first);
    const works = hiddenThenShown(remembering.step, () => kept.version);
    expect(works.hidden).toBeGreaterThan(works.before);

    const forgetting = buildWorld(nodes, tinted('beat'));
    const rested = positionsOf(forgetting.first);
    const rests = hiddenThenShown(forgetting.step, () => rested.version);
    expect(rests.hidden).toBe(rests.before);
  });

  it('is never worked out when it is hidden for good', () => {
    const { first, step } = buildWorld([ribbon({ visible: 0 })]);
    const positions = positionsOf(first);
    const unbuilt = positions.version;
    [0, 1, 2].forEach((time) => step(time, 1));
    expect(positions.version).toBe(unbuilt);
    expect(first?.visible).toBe(false);
  });
});

describe('copies hidden by their own visible', () => {
  const copies = (type: string, overrides: Record<string, unknown>) => ({
    type,
    geometry: { kind: 'box' },
    layout: { kind: 'line', count: 3 },
    instance: { position: ['x', 'time', 'z'] },
    ...overrides,
  });

  const instancesOf = (object: Object3D | undefined): InstancedMesh => {
    if (!(object instanceof InstancedMesh)) {
      throw new Error('not instances');
    }
    return object;
  };

  it('are not worked out while hidden, and are in the frame they show', () => {
    const { first, step } = buildWorld([
      copies('instances', { visible: 'beat > 0.5' }),
    ]);
    const mesh = instancesOf(first);
    const { before, hidden, shown } = hiddenThenShown(
      step,
      () => mesh.instanceMatrix.version,
    );
    expect(hidden).toBe(before);
    expect(shown).toBeGreaterThan(hidden);
    const matrix = new Matrix4();
    mesh.getMatrixAt(0, matrix);
    expect(matrix.elements[13]).toBeCloseTo(4);
  });

  it('are worked out every frame when they always show', () => {
    const { first, step } = buildWorld([copies('instances', {})]);
    const mesh = instancesOf(first);
    const { before, hidden } = hiddenThenShown(
      step,
      () => mesh.instanceMatrix.version,
    );
    expect(hidden).toBeGreaterThan(before);
  });

  it('keep being worked out while hidden when a live formula remembers', () => {
    const { first, step } = buildWorld([
      copies('instances', {
        visible: 'beat > 0.5',
        instance: { position: ['x', 'integrate(1)', 'z'] },
      }),
    ]);
    const mesh = instancesOf(first);
    const { before, hidden } = hiddenThenShown(
      step,
      () => mesh.instanceMatrix.version,
    );
    expect(hidden).toBeGreaterThan(before);
  });

  it('as points, are not worked out while hidden and are in the frame they show', () => {
    const { first, step } = buildWorld([
      copies('points', { visible: 'beat > 0.5' }),
    ]);
    const positions = positionsOf(first);
    const { before, hidden, shown } = hiddenThenShown(
      step,
      () => positions.version,
    );
    expect(hidden).toBe(before);
    expect(shown).toBeGreaterThan(hidden);
    expect(positions.getY(0)).toBeCloseTo(4);
  });

  it('as points, keep being worked out while hidden when their size remembers', () => {
    const { first, step } = buildWorld([
      copies('points', { visible: 'beat > 0.5', size: 'smooth(level, 1)' }),
    ]);
    const positions = positionsOf(first);
    const { before, hidden } = hiddenThenShown(step, () => positions.version);
    expect(hidden).toBeGreaterThan(before);
  });
});
