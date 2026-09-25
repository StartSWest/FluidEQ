/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import {
  WORLD_LIMITS,
  type IWorldGeometry,
  type IWorldInstanceMotion,
  type IWorldLayout,
  type IWorldLight,
  type IWorldMaterial,
  type IWorldModel,
  type TWorldGeometryKind,
  type TWorldLayoutKind,
  type TWorldLightKind,
  type TWorldNode,
  type TWorldVec3,
} from './sceneWorld';
import {
  isRecord,
  readBoolean,
  readChoice,
  readColour,
  readCount,
  readExpr,
  readNumber,
  readTriple,
  readVec3,
  type IWorldScopes,
} from './sceneWorldValues';

/**
 * A world's objects, read with every count bounded: the nodes in the whole
 * tree, how deep it goes, and the copies and points across all of it. A node
 * past a bound is dropped, not the world — the part of a scene that fits is
 * still the scene.
 */

const GEOMETRY_KINDS: readonly TWorldGeometryKind[] = [
  'box',
  'sphere',
  'icosahedron',
  'octahedron',
  'tetrahedron',
  'dodecahedron',
  'torus',
  'torusKnot',
  'cylinder',
  'cone',
  'plane',
  'ring',
  'capsule',
];

const LAYOUT_KINDS: readonly TWorldLayoutKind[] = [
  'grid',
  'ring',
  'spiral',
  'line',
  'scatter',
  'sphere',
];

const LIGHT_KINDS: readonly TWorldLightKind[] = [
  'ambient',
  'hemisphere',
  'directional',
  'point',
  'spot',
];

const EXTENT = WORLD_LIMITS.extent;
const SEGMENTS = WORLD_LIMITS.geometrySegments;

const readGeometry = (value: unknown): IWorldGeometry => {
  const raw = isRecord(value) ? value : {};
  const segments: [number, number] = Array.isArray(raw.segments)
    ? [
        readCount(raw.segments[0], 32, 1, SEGMENTS),
        readCount(raw.segments[1], 16, 1, SEGMENTS),
      ]
    : [
        readCount(raw.segments, 32, 1, SEGMENTS),
        readCount(raw.segments, 16, 1, SEGMENTS),
      ];
  const knot: [number, number] = Array.isArray(raw.knot)
    ? [readCount(raw.knot[0], 2, 1, 16), readCount(raw.knot[1], 3, 1, 16)]
    : [2, 3];
  const kind = readChoice(raw.kind, GEOMETRY_KINDS, 'box');
  const radius = readNumber(raw.radius, 0.5, 0.0001, EXTENT);
  // Unsaid, the second radius is the one that keeps the shape its name: a
  // cylinder as wide at the foot as at the top, a ring half its radius wide.
  let tube = radius * 0.4;
  if (kind === 'cylinder') {
    tube = radius;
  } else if (kind === 'ring') {
    tube = radius * 0.5;
  }
  return {
    kind,
    size: readTriple(raw.size, [1, 1, 1], 0.0001, EXTENT),
    radius,
    tube: readNumber(raw.tube, tube, 0, EXTENT),
    detail: readCount(raw.detail, 0, 0, 6),
    segments,
    knot,
    open: readBoolean(raw.open, false),
  };
};

const readLayout = (value: unknown, room: number): IWorldLayout => {
  const raw = isRecord(value) ? value : {};
  const kind = readChoice(raw.kind, LAYOUT_KINDS, 'line');
  let count: [number, number, number];
  if (kind === 'grid' && Array.isArray(raw.count)) {
    const nx = readCount(raw.count[0], 1, 1, room);
    const ny = readCount(raw.count[1], 1, 1, Math.max(1, room / nx));
    const nz = readCount(raw.count[2], 1, 1, Math.max(1, room / (nx * ny)));
    count = [nx, ny, nz];
  } else {
    // A count as written, or as this reader writes it: `[n, 1, 1]`.
    const written = Array.isArray(raw.count) ? raw.count[0] : raw.count;
    count = [readCount(written, 16, 1, Math.max(1, room)), 1, 1];
  }
  return {
    kind,
    count,
    spacing: readTriple(raw.spacing, [1, 1, 1], 0, EXTENT),
    radius: readNumber(raw.radius, 5, 0, EXTENT),
    arc: readNumber(raw.arc, Math.PI * 2, 0, Math.PI * 64),
    turns: readNumber(raw.turns, 3, 0, 256),
    height: readNumber(raw.height, 0, -EXTENT, EXTENT),
    from: readTriple(raw.from, [-5, 0, 0], -EXTENT, EXTENT),
    to: readTriple(raw.to, [5, 0, 0], -EXTENT, EXTENT),
    box: readTriple(raw.box, [10, 10, 10], 0, EXTENT),
    seed: readNumber(raw.seed, 1, -1e6, 1e6),
  };
};

/** Copies a layout makes: the product of a grid's axes, else its count. */
export const layoutCount = (layout: IWorldLayout): number =>
  layout.kind === 'grid'
    ? layout.count[0] * layout.count[1] * layout.count[2]
    : layout.count[0];

const PLACED: TWorldVec3 = ['x', 'y', 'z'];

const readMotion = (
  value: unknown,
  scopes: IWorldScopes,
): IWorldInstanceMotion => {
  const raw = isRecord(value) ? value : {};
  return {
    position: readVec3(raw.position, scopes.instance, PLACED),
    rotation: readVec3(raw.rotation, scopes.instance, [0, 0, 0]),
    scale: readVec3(raw.scale, scopes.instance, [1, 1, 1], true),
    ...(raw.colour === undefined
      ? {}
      : {
          colour: readColour(raw.colour, scopes.instance, { hex: '#ffffff' }),
        }),
  };
};

const readLight = (value: unknown, scopes: IWorldScopes): IWorldLight => {
  const raw = isRecord(value) ? value : {};
  return {
    kind: readChoice(raw.kind, LIGHT_KINDS, 'point'),
    colour: readColour(raw.colour, scopes.global, { hex: '#ffffff' }),
    groundColour: readColour(raw.groundColour, scopes.global, {
      hex: '#202020',
    }),
    intensity: readExpr(raw.intensity, scopes.global, 1),
    distance: readNumber(raw.distance, 0, 0, EXTENT),
    decay: readNumber(raw.decay, 2, 0, 4),
    angle: readNumber(raw.angle, Math.PI / 6, 0.01, Math.PI / 2),
    penumbra: readNumber(raw.penumbra, 0.3, 0, 1),
    target: readTriple(raw.target, [0, 0, 0], -EXTENT, EXTENT),
    shadow: readBoolean(raw.shadow, false),
  };
};

interface IReadState {
  nodes: number;
  instances: number;
  lights: number;
  shadows: number;
}

const materialId = (
  value: unknown,
  materials: Readonly<Record<string, IWorldMaterial>>,
): string =>
  typeof value === 'string' &&
  Object.prototype.hasOwnProperty.call(materials, value)
    ? value
    : '';

const readNode = (
  value: unknown,
  depth: number,
  state: IReadState,
  scopes: IWorldScopes,
  materials: Readonly<Record<string, IWorldMaterial>>,
  models: Readonly<Record<string, IWorldModel>>,
): TWorldNode | null => {
  if (!isRecord(value) || state.nodes >= WORLD_LIMITS.nodes) {
    return null;
  }
  const scope = scopes.global;
  const common = {
    ...(typeof value.name === 'string' && value.name.length <= 64
      ? { name: value.name }
      : {}),
    position: readVec3(value.position, scope, [0, 0, 0]),
    rotation: readVec3(value.rotation, scope, [0, 0, 0]),
    scale: readVec3(value.scale, scope, [1, 1, 1], true),
    visible: readExpr(value.visible, scope, 1),
    castShadow: readBoolean(value.castShadow, false),
    receiveShadow: readBoolean(value.receiveShadow, false),
    children: [] as TWorldNode[],
  };
  const room = WORLD_LIMITS.instances - state.instances;
  let node: TWorldNode | null = null;
  switch (value.type) {
    case 'group':
      node = { ...common, type: 'group' };
      break;
    case 'mesh':
      node = {
        ...common,
        type: 'mesh',
        geometry: readGeometry(value.geometry),
        material: materialId(value.material, materials),
      };
      break;
    case 'instances':
    case 'points': {
      if (room < 1) {
        return null;
      }
      const layout = readLayout(value.layout, room);
      state.instances += layoutCount(layout);
      const instance = readMotion(value.instance, scopes);
      node =
        value.type === 'instances'
          ? {
              ...common,
              type: 'instances',
              geometry: readGeometry(value.geometry),
              material: materialId(value.material, materials),
              layout,
              instance,
            }
          : {
              ...common,
              type: 'points',
              layout,
              instance,
              size: readExpr(value.size, scope, 0.05),
              colour: readColour(value.colour, scope, { hex: '#ffffff' }),
              opacity: readExpr(value.opacity, scope, 1),
              additive: readBoolean(value.additive, true),
            };
      break;
    }
    case 'ribbon':
      node = {
        ...common,
        type: 'ribbon',
        segments: readCount(
          value.segments,
          128,
          2,
          WORLD_LIMITS.ribbonSegments,
        ),
        point: readVec3(value.point, scopes.instance, ['u * 10 - 5', 0, 0]),
        width: readExpr(value.width, scopes.instance, 0.1),
        colour: readColour(value.colour, scopes.instance, { hex: '#ffffff' }),
        material: materialId(value.material, materials),
      };
      break;
    case 'terrain': {
      const size = Array.isArray(value.size) ? value.size : [];
      const segments = Array.isArray(value.segments) ? value.segments : [];
      const band = Array.isArray(value.band) ? value.band : [];
      const low = readNumber(band[0], 0.05, 0, 0.95);
      node = {
        ...common,
        type: 'terrain',
        size: [
          readNumber(size[0], 60, 0.01, EXTENT),
          readNumber(size[1], 80, 0.01, EXTENT),
        ],
        segments: [
          readCount(segments[0], 128, 2, WORLD_LIMITS.terrainSegments),
          readCount(segments[1], 128, 2, WORLD_LIMITS.terrainSegments),
        ],
        height: readExpr(value.height, scope, 6),
        rows: readCount(value.rows, 96, 2, WORLD_LIMITS.terrainRows),
        rate: readNumber(value.rate, 24, 1, 240),
        mirror: readBoolean(value.mirror, true),
        band: [low, readNumber(band[1], 0.85, low + 0.05, 1)],
        valley: readNumber(value.valley, 0, 0, 0.9),
        material: materialId(value.material, materials),
      };
      break;
    }
    case 'model':
      if (
        typeof value.model !== 'string' ||
        !Object.prototype.hasOwnProperty.call(models, value.model)
      ) {
        return null;
      }
      node = {
        ...common,
        type: 'model',
        model: value.model,
        ...(typeof value.clip === 'string' ||
        (typeof value.clip === 'number' && Number.isInteger(value.clip))
          ? { clip: value.clip }
          : {}),
        speed: readExpr(value.speed, scope, 1),
      };
      break;
    case 'light': {
      if (state.lights >= WORLD_LIMITS.lights) {
        return null;
      }
      const light = readLight(value.light, scopes);
      const castsShadow =
        light.shadow &&
        state.shadows < WORLD_LIMITS.shadowLights &&
        (light.kind === 'directional' ||
          light.kind === 'spot' ||
          light.kind === 'point');
      state.lights += 1;
      if (castsShadow) {
        state.shadows += 1;
      }
      node = {
        ...common,
        type: 'light',
        light: { ...light, shadow: castsShadow },
      };
      break;
    }
    default:
      // A kind of object a newer FluidEQ draws: this one leaves it out.
      return null;
  }
  state.nodes += 1;
  if (depth < WORLD_LIMITS.depth && Array.isArray(value.children)) {
    value.children.forEach((child) => {
      const read = readNode(child, depth + 1, state, scopes, materials, models);
      if (read) {
        node?.children.push(read);
      }
    });
  }
  return node;
};

/** The top-level list of a world's objects, bounded as a whole. */
export const readWorldNodes = (
  value: unknown,
  scopes: IWorldScopes,
  materials: Readonly<Record<string, IWorldMaterial>>,
  models: Readonly<Record<string, IWorldModel>>,
): TWorldNode[] => {
  if (!Array.isArray(value)) {
    return [];
  }
  const state: IReadState = { nodes: 0, instances: 0, lights: 0, shadows: 0 };
  const nodes: TWorldNode[] = [];
  value.forEach((raw) => {
    const node = readNode(raw, 1, state, scopes, materials, models);
    if (node) {
      nodes.push(node);
    }
  });
  return nodes;
};
