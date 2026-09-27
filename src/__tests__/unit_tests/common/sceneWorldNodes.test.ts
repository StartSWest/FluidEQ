/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { WORLD_LIMITS, type TWorldNode } from '../../../common/sceneWorld';
import normalizeSceneWorld from '../../../common/sceneWorldRead';
import { glb, meshModel, modelData } from '../../utils/glbFixture';

/**
 * A world's nodes charged what they cost a frame as they are read: every
 * placement of a model its whole model again, every caster its vertices once
 * more for each shadow pass, and a point only what a point is drawn with.
 * Each case stands beside the same world without the thing charged, so a
 * node left out for its cost cannot be mistaken for a node never read.
 */

/** A model of 100 primitives over 1,000 vertices: 100,000 a placement. */
const PLACEMENT_VERTICES = 100_000;
const heavyModel = (materials: Record<string, unknown> = {}) => {
  const model = meshModel({ vertices: 1000, primitives: 100 });
  return modelData(glb({ ...model, json: { ...model.json, ...materials } }));
};

const placements = (count: number, model = 'ship') =>
  Array.from({ length: count }, (_, i) => ({
    type: 'model',
    model,
    name: `p${i}`,
  }));

const names = (nodes: readonly TWorldNode[] | undefined) =>
  (nodes ?? []).map((node) => node.name);

const firstNames = (count: number) =>
  Array.from({ length: count }, (_, i) => `p${i}`);

describe('a model placed in a world', () => {
  // The placements the frame's vertices hold, drawn once a frame.
  const fit = WORLD_LIMITS.frameVertices / PLACEMENT_VERTICES;

  const placed = (
    materials: Record<string, unknown> = {},
    model = heavyModel(),
  ) =>
    normalizeSceneWorld(
      {
        materials,
        models: { ship: { data: model } },
        nodes: placements(fit + 1),
      },
      [],
    );

  it('is charged the whole model for every placement, and the placements past the frame are left out', () => {
    expect(Number.isInteger(fit) && fit > 4).toBe(true);
    expect(names(placed()?.nodes)).toEqual(firstNames(fit));
  });

  it('is charged half its triangles where those outnumber its vertices, like any grid', () => {
    // Three vertices indexed into 200,000 triangles: 100,000 a placement, as
    // much as the model above, where its three vertices would fit them all.
    const indexed = (indices: number) =>
      modelData(glb(meshModel({ vertices: 3, indices })));
    expect(names(placed({}, indexed(600_000))?.nodes)).toEqual(firstNames(fit));
    expect(names(placed({}, indexed(3))?.nodes)).toEqual(firstNames(fit + 1));
  });

  it('fits half as often in a world drawn again for a mirror', () => {
    expect(
      names(placed({ wet: { kind: 'standard', mirror: 0.6 } })?.nodes),
    ).toEqual(firstNames(fit / 2));
    // A mirror on an unlit material reflects nothing, and costs nothing.
    expect(
      names(placed({ wet: { kind: 'glow', mirror: 0.6 } })?.nodes),
    ).toEqual(firstNames(fit));
  });

  it('fits half as often in a world drawn again behind glass', () => {
    expect(
      names(placed({ glass: { kind: 'physical', transmission: 0.8 } })?.nodes),
    ).toEqual(firstNames(fit / 2));
    expect(
      names(placed({ glass: { kind: 'physical', transmission: 0 } })?.nodes),
    ).toEqual(firstNames(fit));
    expect(
      names(placed({ glass: { kind: 'standard', transmission: 0.8 } })?.nodes),
    ).toEqual(firstNames(fit));
  });

  it('fits half as often when the glass is the model’s own', () => {
    const glassy = heavyModel({
      extensionsUsed: ['KHR_materials_transmission'],
      materials: [
        {
          extensions: { KHR_materials_transmission: { transmissionFactor: 1 } },
        },
      ],
    });
    expect(names(placed({}, glassy)?.nodes)).toEqual(firstNames(fit / 2));
  });

  it('fits a quarter as often with a mirror and glass both', () => {
    expect(
      names(
        placed({
          wet: { kind: 'standard', mirror: 0.6 },
          glass: { kind: 'physical', transmission: 0.8 },
        })?.nodes,
      ),
    ).toEqual(firstNames(fit / 4));
  });
});

describe('the shadows of a world', () => {
  // A plane of 200 by 250 vertices: 50,000.
  const PLANE_VERTICES = 50_000;
  const CASTERS = 10;
  const caster = (i: number) => ({
    type: 'mesh',
    name: `p${i}`,
    geometry: { kind: 'plane', segments: [199, 249] },
    castShadow: true,
  });
  const light = (kind: string) => ({
    type: 'light',
    name: kind,
    light: { kind, shadow: true },
  });
  const casting = (lights: unknown[]) => {
    const world = normalizeSceneWorld(
      {
        nodes: [
          ...Array.from({ length: CASTERS }, (_, i) => caster(i)),
          ...lights,
        ],
      },
      [],
    );
    return (world?.nodes ?? []).filter((node) => node.type === 'mesh');
  };
  /** The first casters whose shadows fit beside the drawn world, `passes` each. */
  const fitting = (passes: number) =>
    Math.floor(
      (WORLD_LIMITS.frameVertices - CASTERS * PLANE_VERTICES) /
        (PLANE_VERTICES * passes),
    );
  const castsShadow = (nodes: TWorldNode[]) =>
    nodes.map((node) => node.castShadow);

  it('keeps every caster casting when no light shadows', () => {
    const meshes = casting([{ type: 'light', light: { kind: 'point' } }]);
    expect(meshes).toHaveLength(CASTERS);
    expect(castsShadow(meshes)).toEqual(Array(CASTERS).fill(true));
  });

  it('counts a directional light’s shadow as one more pass of its casters', () => {
    expect(fitting(1)).toBeGreaterThanOrEqual(CASTERS);
    expect(castsShadow(casting([light('directional')]))).toEqual(
      Array(CASTERS).fill(true),
    );
  });

  it('counts a point light’s shadow as six, and stops the last casters casting rather than leaving anything out', () => {
    const kept = fitting(6);
    expect(kept > 0 && kept < CASTERS).toBe(true);
    const meshes = casting([light('point')]);
    expect(names(meshes)).toEqual(firstNames(CASTERS));
    expect(castsShadow(meshes)).toEqual([
      ...Array(kept).fill(true),
      ...Array(CASTERS - kept).fill(false),
    ]);
  });

  it('adds the passes of every light that shadows, read after the casters', () => {
    const kept = fitting(7);
    expect(kept).toBeLessThan(fitting(6));
    expect(
      castsShadow(casting([light('point'), light('directional')])),
    ).toEqual([
      ...Array(kept).fill(true),
      ...Array(CASTERS - kept).fill(false),
    ]);
  });
});

describe('the points of a world', () => {
  const MOTION = {
    position: ['x', 'y + bass', 'z'],
    rotation: ['bass', 'time', 'mid'],
    scale: ['2 + bass', 'treble', 2],
    colour: { rgb: ['u', 0.5, 0.5] },
  };
  const node = (type: string, count = 4) => ({
    type,
    geometry: { kind: 'box' },
    layout: { kind: 'line', count },
    instance: MOTION,
  });

  it('keep their places and colours, and never a turn or a size of their own', () => {
    const [points] =
      normalizeSceneWorld({ nodes: [node('points')] }, [])?.nodes ?? [];
    expect(points?.type === 'points' && points.instance).toEqual({
      position: MOTION.position,
      rotation: [0, 0, 0],
      scale: [1, 1, 1],
      colour: MOTION.colour,
    });
    const [copies] =
      normalizeSceneWorld({ nodes: [node('instances')] }, [])?.nodes ?? [];
    expect(copies?.type === 'instances' && copies.instance).toEqual(MOTION);
  });

  it('are never charged the formulas of a turn or a size they do not have', () => {
    // Six formulas reading the music besides the place: enough for the
    // frame's formulas to leave out copies that keep them, not points.
    const count = Math.ceil(WORLD_LIMITS.frameFormulas / 6) + 1;
    expect(count).toBeLessThanOrEqual(WORLD_LIMITS.instances);
    const kinds = (type: string) =>
      (
        normalizeSceneWorld(
          { nodes: [node(type, count), { type: 'group' }] },
          [],
        )?.nodes ?? []
      ).map((kept) => kept.type);
    expect(kinds('points')).toEqual(['points', 'group']);
    expect(kinds('instances')).toEqual(['group']);
  });
});
