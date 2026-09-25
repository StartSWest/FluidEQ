/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import {
  WORLD_INSTANCE_SIGNALS,
  WORLD_LIMITS,
  WORLD_SIGNALS,
  worldHasMirror,
  worldInstanceScopeNames,
  worldScopeNames,
  type ISceneWorld,
  type IWorldAtlasRegion,
  type IWorldBloom,
  type IWorldCamera,
  type IWorldFog,
  type IWorldMaterial,
  type IWorldModel,
  type IWorldVariable,
  type TWorldColour,
  type TWorldExpr,
  type TWorldMaterialKind,
  type TWorldToneMapping,
} from './sceneWorld';
import { readWorldNodes } from './sceneWorldNodes';
import {
  clampWorld,
  isWorldRecord,
  readBoolean,
  readChoice,
  readColour,
  readExpr,
  readNumber,
  readVec3,
  WORLD_HEX,
  type IWorldScopes,
} from './sceneWorldValues';

/**
 * A pack's `world`, read the way the rest of a pack is read: everything
 * bounded, anything this version cannot use dropped, and only a world with
 * nothing to draw refused. `undefined` then means "play the shader", which is
 * exactly what an older FluidEQ does with the same pack.
 */

// Any name a formula can spell (`worldExpressionLexicon.ts`): lower case
// only, `heroA` was dropped here while every formula naming it compiled, and
// read as 0 — a lantern meant to rise sat on the water with nothing saying so.
const VAR_NAME = /^[A-Za-z][A-Za-z0-9_]{0,23}$/;
const MATERIAL_ID = /^[A-Za-z][A-Za-z0-9_-]{0,31}$/;
const VERTEX_ENTRY = /\bvec3\s+worldDisplace\s*\(/;
const FRAGMENT_ENTRY = /\bvoid\s+worldSurface\s*\(/;

const RESERVED = new Set<string>([
  ...WORLD_SIGNALS,
  ...WORLD_INSTANCE_SIGNALS,
  'pi',
  'tau',
  'e',
]);

/**
 * Variables by name, in order: as an author writes them, `{ "kick": "..." }`,
 * or as this reader writes them, a list of `{ name, value }`.
 */
const variableEntries = (value: unknown): [string, unknown][] => {
  if (Array.isArray(value)) {
    return value
      .filter(isWorldRecord)
      .map((entry): [string, unknown] => [
        typeof entry.name === 'string' ? entry.name : '',
        entry.value,
      ]);
  }
  return isWorldRecord(value) ? Object.entries(value) : [];
};

const readVars = (
  value: unknown,
  paramIds: readonly string[],
): IWorldVariable[] => {
  const vars: IWorldVariable[] = [];
  variableEntries(value).forEach(([name, source]) => {
    if (
      vars.length >= WORLD_LIMITS.vars ||
      !VAR_NAME.test(name) ||
      RESERVED.has(name) ||
      vars.some((known) => known.name === name)
    ) {
      return;
    }
    // Each variable may use those before it, never itself or those after:
    // the frame evaluates them once, in order.
    const scope = {
      names: worldScopeNames(
        paramIds,
        vars.map((known) => known.name),
      ),
    };
    const read = readExpr(source, scope, undefined);
    if (read !== undefined) {
      vars.push({ name, value: read });
    }
  });
  return vars;
};

const readCamera = (value: unknown, scopes: IWorldScopes): IWorldCamera => {
  const raw = isWorldRecord(value) ? value : {};
  const near = readNumber(raw.near, 0.1, 0.001, 100);
  return {
    fov: readExpr(raw.fov, scopes.global, 50),
    position: readVec3(raw.position, scopes.global, [0, 2, 10]),
    target: readVec3(raw.target, scopes.global, [0, 0, 0]),
    roll: readExpr(raw.roll, scopes.global, 0),
    near,
    far: readNumber(raw.far, 500, near * 2, WORLD_LIMITS.extent * 2),
  };
};

const readFog = (value: unknown): IWorldFog | undefined => {
  if (!isWorldRecord(value)) {
    return undefined;
  }
  const near = readNumber(value.near, 20, 0, WORLD_LIMITS.extent);
  return {
    colour:
      typeof value.colour === 'string' && WORLD_HEX.test(value.colour)
        ? value.colour.toLowerCase()
        : '#000000',
    near,
    far: readNumber(value.far, 120, near + 0.01, WORLD_LIMITS.extent * 2),
    toBackdrop: readBoolean(value.toBackdrop, true),
  };
};

const readBloom = (
  value: unknown,
  scopes: IWorldScopes,
): IWorldBloom | undefined => {
  if (!isWorldRecord(value)) {
    return undefined;
  }
  return {
    strength: readExpr(value.strength, scopes.global, 0.6),
    radius: readNumber(value.radius, 0.5, 0, 1),
    threshold: readNumber(value.threshold, 0.8, 0, 64),
  };
};

/** `[x, y, width, height]` as written, or `{ x, y, width, height }` as read. */
const regionNumbers = (value: unknown): unknown[] | undefined => {
  if (Array.isArray(value)) {
    return value.length === 4 ? value : undefined;
  }
  return isWorldRecord(value)
    ? [value.x, value.y, value.width, value.height]
    : undefined;
};

const readRegion = (
  value: unknown,
  artwork: { width: number; height: number } | undefined,
): IWorldAtlasRegion | undefined => {
  const numbers = regionNumbers(value);
  if (!artwork || !numbers) {
    return undefined;
  }
  const [x, y, width, height] = numbers.map((entry) =>
    typeof entry === 'number' && Number.isFinite(entry) ? Math.round(entry) : 0,
  );
  if (
    width <= 0 ||
    height <= 0 ||
    x < 0 ||
    y < 0 ||
    x + width > artwork.width ||
    y + height > artwork.height
  ) {
    return undefined;
  }
  return { x, y, width, height };
};

/** What is left of the world's GLSL budget (`hookTotalBytes`). */
interface IHookBudget {
  bytes: number;
}

const readHook = (
  value: unknown,
  entry: RegExp,
  budget: IHookBudget,
): string | undefined => {
  if (typeof value !== 'string' || !entry.test(value)) {
    return undefined;
  }
  if (/^\s*#version\b/m.test(value)) {
    return undefined;
  }
  const bytes = new TextEncoder().encode(value).byteLength;
  if (bytes > WORLD_LIMITS.hookBytes || bytes > budget.bytes) {
    return undefined;
  }
  // eslint-disable-next-line no-param-reassign -- the budget is shared by every material's hooks, in order
  budget.bytes -= bytes;
  return value;
};

/**
 * Entries whose ids are all distinct however they are capitalised: a
 * material's GLSL and a model are written out under their ids (`world-<id>`,
 * `model-<id>`, `projectRestore.ts`), and `Glow` and `glow` are one file on
 * Windows and macOS, where restoring such a world failed half written.
 */
const distinctIds = <T>(entries: [string, T][]): [string, T][] => {
  const seen = new Set<string>();
  return entries.filter(([id]) => {
    const folded = id.toLowerCase();
    if (seen.has(folded)) {
      return false;
    }
    seen.add(folded);
    return true;
  });
};

const MATERIAL_KINDS: readonly TWorldMaterialKind[] = [
  'standard',
  'physical',
  'basic',
  'glow',
];

const WHITE: TWorldColour = { hex: '#ffffff' };
const BLACK: TWorldColour = { hex: '#000000' };

const readMaterial = (
  value: unknown,
  scopes: IWorldScopes,
  artwork: { width: number; height: number } | undefined,
  hooks: IHookBudget,
): IWorldMaterial => {
  const raw = isWorldRecord(value) ? value : {};
  const expr = (field: unknown, fallback: TWorldExpr) =>
    readExpr(field, scopes.global, fallback);
  const repeat: [number, number] = Array.isArray(raw.repeat)
    ? [
        readNumber(raw.repeat[0], 1, 0.001, 1000),
        readNumber(raw.repeat[1], 1, 0.001, 1000),
      ]
    : [1, 1];
  const map = readRegion(raw.map, artwork);
  const emissiveMap = readRegion(raw.emissiveMap, artwork);
  const vertex = readHook(raw.vertex, VERTEX_ENTRY, hooks);
  const fragment = readHook(raw.fragment, FRAGMENT_ENTRY, hooks);
  return {
    kind: readChoice(raw.kind, MATERIAL_KINDS, 'standard'),
    colour: readColour(raw.colour, scopes.global, WHITE),
    emissive: readColour(raw.emissive, scopes.global, BLACK),
    emissiveIntensity: expr(raw.emissiveIntensity, 1),
    roughness: expr(raw.roughness, 0.5),
    metalness: expr(raw.metalness, 0),
    opacity: expr(raw.opacity, 1),
    clearcoat: expr(raw.clearcoat, 0),
    clearcoatRoughness: expr(raw.clearcoatRoughness, 0.1),
    transmission: expr(raw.transmission, 0),
    thickness: expr(raw.thickness, 0.5),
    iridescence: expr(raw.iridescence, 0),
    sheen: expr(raw.sheen, 0),
    ior: readNumber(raw.ior, 1.5, 1, 2.333),
    transparent: readBoolean(raw.transparent, false),
    wireframe: readBoolean(raw.wireframe, false),
    flatShading: readBoolean(raw.flatShading, false),
    side: readChoice(raw.side, ['front', 'back', 'double'] as const, 'front'),
    additive: readBoolean(raw.additive, false),
    fog: readBoolean(raw.fog, true),
    ...(map ? { map } : {}),
    ...(emissiveMap ? { emissiveMap } : {}),
    repeat,
    mirror: expr(raw.mirror, 0),
    mirrorBlur: readNumber(raw.mirrorBlur, 0.3, 0, 1),
    ...(vertex ? { vertex } : {}),
    ...(fragment ? { fragment } : {}),
  };
};

const readMaterials = (
  value: unknown,
  scopes: IWorldScopes,
  artwork: { width: number; height: number } | undefined,
): Record<string, IWorldMaterial> => {
  const materials: Record<string, IWorldMaterial> = {};
  if (!isWorldRecord(value)) {
    return materials;
  }
  const hooks: IHookBudget = { bytes: WORLD_LIMITS.hookTotalBytes };
  distinctIds(Object.entries(value).filter(([id]) => MATERIAL_ID.test(id)))
    .slice(0, WORLD_LIMITS.materials)
    .forEach(([id, raw]) => {
      materials[id] = readMaterial(raw, scopes, artwork, hooks);
    });
  return materials;
};

/** Base64 of the size a decoded model can be, and nothing else. */
const readModels = (value: unknown): Record<string, IWorldModel> => {
  const models: Record<string, IWorldModel> = {};
  if (!isWorldRecord(value)) {
    return models;
  }
  let bytes = 0;
  distinctIds(Object.entries(value).filter(([id]) => MATERIAL_ID.test(id)))
    .slice(0, WORLD_LIMITS.models)
    .forEach(([id, raw]) => {
      if (!isWorldRecord(raw) || typeof raw.data !== 'string') {
        return;
      }
      const { data } = raw;
      const decoded = Math.floor((data.length * 3) / 4);
      if (
        data.length === 0 ||
        data.length % 4 !== 0 ||
        !/^[A-Za-z0-9+/]+={0,2}$/.test(data) ||
        bytes + decoded > WORLD_LIMITS.modelBytes
      ) {
        return;
      }
      bytes += decoded;
      models[id] = { data };
    });
  return models;
};

const TONE_MAPPINGS: readonly TWorldToneMapping[] = [
  'aces',
  'agx',
  'neutral',
  'none',
];

/**
 * The world in `raw`, or `undefined` for none worth drawing.
 *
 * `paramIds` are the pack's parameters, which formulas name as `p.<id>`;
 * `artwork` is the pack's atlas, which materials may cut regions from.
 */
const normalizeSceneWorld = (
  raw: unknown,
  paramIds: readonly string[],
  artwork?: { width: number; height: number },
): ISceneWorld | undefined => {
  if (!isWorldRecord(raw)) {
    return undefined;
  }
  const vars = readVars(raw.vars, paramIds);
  const varNames = vars.map((known) => known.name);
  const scopes: IWorldScopes = {
    global: { names: worldScopeNames(paramIds, varNames) },
    instance: { names: worldInstanceScopeNames(paramIds, varNames) },
  };
  const materials = readMaterials(raw.materials, scopes, artwork);
  const models = readModels(raw.models);
  const nodes = readWorldNodes(
    raw.nodes,
    scopes,
    materials,
    models,
    worldHasMirror(materials),
  );
  if (nodes.length === 0) {
    return undefined;
  }
  const fog = readFog(raw.fog);
  const bloom = readBloom(raw.bloom, scopes);
  const backdrop =
    typeof raw.backdrop === 'string' && WORLD_HEX.test(raw.backdrop)
      ? raw.backdrop.toLowerCase()
      : 'shader';
  return {
    camera: readCamera(raw.camera, scopes),
    vars,
    backdrop,
    ...(fog ? { fog } : {}),
    environment: readChoice(raw.environment, ['studio', 'none'], 'studio'),
    environmentIntensity: readNumber(raw.environmentIntensity, 0.4, 0, 4),
    exposure: readExpr(raw.exposure, scopes.global, 1),
    toneMapping: readChoice(raw.toneMapping, TONE_MAPPINGS, 'aces'),
    ...(bloom ? { bloom } : {}),
    vignette: clampWorld(readNumber(raw.vignette, 0.25, 0, 1), 0, 1),
    materials,
    models,
    nodes,
  };
};
export default normalizeSceneWorld;
