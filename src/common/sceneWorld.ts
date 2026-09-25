/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * A 3D scene, as data: what a scene pack's optional `world` holds.
 *
 * A pack with a world still carries its shader, and the shader keeps two
 * jobs. It is the sky the world stands in front of — drawn once per pixel in
 * the same pass that finishes the world, so it costs what it always cost —
 * and it is the whole scene on any FluidEQ older than this one, which ignores
 * a field it has not heard of (`normalizeScenePack`). A world that cannot be
 * built here, on a GPU that refuses something in it, falls back the same
 * way: the shader alone, never a blank panel.
 *
 * Everything that moves is a formula (`worldExpression.ts`) over the music
 * the shader is already given — level, beat, the three bands, the accent, the
 * flywheel, the spectrum and the waveform — so a world answers the music in
 * as many ways as its author writes, and still carries no code.
 *
 * Read forgivingly, like the rest of a pack (`sceneWorldRead.ts`): a part this
 * version cannot use is dropped and the rest is still a world.
 */

export type TWorldExpr = string | number;
export type TWorldVec3 = readonly [TWorldExpr, TWorldExpr, TWorldExpr];

/** A colour: a fixed sRGB hex, or three formulas, hue 0..1 or sRGB 0..1. */
export type TWorldColour =
  { hex: string } | { hsl: TWorldVec3 } | { rgb: TWorldVec3 };

export interface IWorldCamera {
  /** Vertical field of view, in degrees. */
  fov: TWorldExpr;
  position: TWorldVec3;
  target: TWorldVec3;
  /** Radians about the line of sight. */
  roll: TWorldExpr;
  near: number;
  far: number;
}

export interface IWorldVariable {
  name: string;
  value: TWorldExpr;
}

export interface IWorldFog {
  colour: string;
  near: number;
  far: number;
  /**
   * Fade into the shader's sky rather than into `colour`: a distant object
   * thins to transparent, so the backdrop shows through it.
   */
  toBackdrop: boolean;
}

export interface IWorldBloom {
  strength: TWorldExpr;
  /** 0..1: how far the glow spreads. */
  radius: number;
  /** Linear light above which a pixel glows. */
  threshold: number;
}

export type TWorldToneMapping = 'aces' | 'agx' | 'neutral' | 'none';

export type TWorldEnvironment = 'studio' | 'none';

/** A rectangle of the pack's artwork, in its pixels, top-left origin. */
export interface IWorldAtlasRegion {
  x: number;
  y: number;
  width: number;
  height: number;
}

export type TWorldMaterialKind = 'standard' | 'physical' | 'basic' | 'glow';

export interface IWorldMaterial {
  kind: TWorldMaterialKind;
  colour: TWorldColour;
  emissive: TWorldColour;
  emissiveIntensity: TWorldExpr;
  roughness: TWorldExpr;
  metalness: TWorldExpr;
  opacity: TWorldExpr;
  clearcoat: TWorldExpr;
  clearcoatRoughness: TWorldExpr;
  transmission: TWorldExpr;
  thickness: TWorldExpr;
  iridescence: TWorldExpr;
  sheen: TWorldExpr;
  ior: number;
  transparent: boolean;
  wireframe: boolean;
  flatShading: boolean;
  side: 'front' | 'back' | 'double';
  /** Additive light that never hides what is behind it. */
  additive: boolean;
  fog: boolean;
  map?: IWorldAtlasRegion;
  emissiveMap?: IWorldAtlasRegion;
  repeat: readonly [number, number];
  /**
   * How much of the world a flat floor reflects, 0..1: wet asphalt under
   * the neon. Only the first mesh wearing a mirror is one; it must be flat.
   */
  mirror: TWorldExpr;
  /** 0 a polished mirror, 1 a reflection softened to a glow. */
  mirrorBlur: number;
  /**
   * GLSL defining `vec3 worldDisplace(vec3 position, vec3 normal,
   * WorldVertex v)`: where each vertex goes, in the object's own space.
   */
  vertex?: string;
  /**
   * GLSL defining `void worldSurface(inout vec4 colour, inout vec3 emissive,
   * WorldSurface s)`: the surface's colour and its own light.
   */
  fragment?: string;
}

export type TWorldGeometryKind =
  | 'box'
  | 'sphere'
  | 'icosahedron'
  | 'octahedron'
  | 'tetrahedron'
  | 'dodecahedron'
  | 'torus'
  | 'torusKnot'
  | 'cylinder'
  | 'cone'
  | 'plane'
  | 'ring'
  | 'capsule';

/**
 * A primitive's measurements. One shape for every kind so a reader has one
 * set of bounds: `size` is a box's or plane's extent, `radius` a round
 * shape's (a cylinder's top), `tube` a torus's thickness, a ring's inner
 * radius or a cylinder's bottom radius.
 */
export interface IWorldGeometry {
  kind: TWorldGeometryKind;
  size: readonly [number, number, number];
  radius: number;
  tube: number;
  detail: number;
  segments: readonly [number, number];
  knot: readonly [number, number];
  open: boolean;
}

export type TWorldLayoutKind =
  'grid' | 'ring' | 'spiral' | 'line' | 'scatter' | 'sphere';

/**
 * Where a set of copies starts before its formulas move them. Each copy gets
 * `x`, `y`, `z` from here, `i` and `n`, `u` = i / (n - 1), a repeatable
 * `rand`, `rand2` and `rand3`, and `angle` round the vertical axis.
 */
export interface IWorldLayout {
  kind: TWorldLayoutKind;
  /** Copies per axis for a grid; the first alone for everything else. */
  count: readonly [number, number, number];
  spacing: readonly [number, number, number];
  radius: number;
  /** Radians a ring or spiral sweeps. */
  arc: number;
  turns: number;
  height: number;
  from: readonly [number, number, number];
  to: readonly [number, number, number];
  box: readonly [number, number, number];
  seed: number;
}

export interface IWorldInstanceMotion {
  position: TWorldVec3;
  rotation: TWorldVec3;
  scale: TWorldVec3;
  colour?: TWorldColour;
}

export type TWorldLightKind =
  'ambient' | 'hemisphere' | 'directional' | 'point' | 'spot';

export interface IWorldLight {
  kind: TWorldLightKind;
  colour: TWorldColour;
  groundColour: TWorldColour;
  intensity: TWorldExpr;
  distance: number;
  decay: number;
  angle: number;
  penumbra: number;
  target: readonly [number, number, number];
  shadow: boolean;
}

interface IWorldNodeCommon {
  name?: string;
  position: TWorldVec3;
  rotation: TWorldVec3;
  scale: TWorldVec3;
  visible: TWorldExpr;
  castShadow: boolean;
  receiveShadow: boolean;
  children: TWorldNode[];
}

export interface IWorldMeshNode extends IWorldNodeCommon {
  type: 'mesh';
  geometry: IWorldGeometry;
  material: string;
}

export interface IWorldInstancesNode extends IWorldNodeCommon {
  type: 'instances';
  geometry: IWorldGeometry;
  material: string;
  layout: IWorldLayout;
  instance: IWorldInstanceMotion;
}

export interface IWorldPointsNode extends IWorldNodeCommon {
  type: 'points';
  layout: IWorldLayout;
  instance: IWorldInstanceMotion;
  /** World units across at a distance of one, formula over the scene. */
  size: TWorldExpr;
  colour: TWorldColour;
  opacity: TWorldExpr;
  additive: boolean;
}

export interface IWorldRibbonNode extends IWorldNodeCommon {
  type: 'ribbon';
  segments: number;
  /** Where the ribbon runs, with `u` 0..1 along it. */
  point: TWorldVec3;
  width: TWorldExpr;
  colour: TWorldColour;
  material: string;
}

export interface IWorldTerrainNode extends IWorldNodeCommon {
  type: 'terrain';
  /** Width across the spectrum, and depth into the past. */
  size: readonly [number, number];
  segments: readonly [number, number];
  height: TWorldExpr;
  /** Spectra kept, the nearest row the newest. */
  rows: number;
  /** Rows written a second of scene time. */
  rate: number;
  /** The spectrum from the centre outwards, both ways: a valley. */
  mirror: boolean;
  /** Where along the spectrum the ground reads, u 0..1 each end. */
  band: readonly [number, number];
  /**
   * The share of the width kept low down the middle, 0..0.9: a floor for a
   * road to run along between the ridges. 0 leaves the whole width to rise.
   */
  valley: number;
  material: string;
}

export interface IWorldModelNode extends IWorldNodeCommon {
  type: 'model';
  model: string;
  clip?: string | number;
  speed: TWorldExpr;
}

export interface IWorldLightNode extends IWorldNodeCommon {
  type: 'light';
  light: IWorldLight;
}

export interface IWorldGroupNode extends IWorldNodeCommon {
  type: 'group';
}

export type TWorldNode =
  | IWorldMeshNode
  | IWorldInstancesNode
  | IWorldPointsNode
  | IWorldRibbonNode
  | IWorldTerrainNode
  | IWorldModelNode
  | IWorldLightNode
  | IWorldGroupNode;

export interface IWorldModel {
  /** A binary glTF, base64: everything embedded, nothing fetched. */
  data: string;
}

export interface ISceneWorld {
  camera: IWorldCamera;
  vars: IWorldVariable[];
  /** `shader` puts the pack's own scene behind the world; a hex, a colour. */
  backdrop: 'shader' | string;
  fog?: IWorldFog;
  environment: TWorldEnvironment;
  environmentIntensity: number;
  exposure: TWorldExpr;
  toneMapping: TWorldToneMapping;
  bloom?: IWorldBloom;
  /** 0..1: how far the corners are darkened. */
  vignette: number;
  materials: Readonly<Record<string, IWorldMaterial>>;
  models: Readonly<Record<string, IWorldModel>>;
  nodes: TWorldNode[];
}

/** Bounds on what a world may ask a GPU for, whatever its author wrote. */
export const WORLD_LIMITS = {
  nodes: 512,
  depth: 8,
  /** Copies and points across the whole world. */
  instances: 60000,
  ribbonSegments: 2048,
  terrainSegments: 256,
  terrainRows: 256,
  materials: 64,
  models: 16,
  /** Decoded glTF bytes across every model. */
  modelBytes: 8 * 1024 * 1024,
  /** Triangles across every model once parsed. */
  modelTriangles: 1_500_000,
  lights: 16,
  shadowLights: 2,
  vars: 32,
  hookBytes: 32 * 1024,
  geometrySegments: 256,
  extent: 10000,
} as const;

/** What a formula anywhere in a world may name. */
export const WORLD_SIGNALS = [
  'time',
  'dt',
  'level',
  'beat',
  'bass',
  'mid',
  'treble',
  'accent',
  'accentId',
  'run',
  'runSpeed',
  'aspect',
  // Contract 8, as the shader has them in uRhythm, uDrums, uSong, uStereo,
  // uVoice, uPointer, uTap and uCamera. Each is named with its group because
  // a variable named like a signal is dropped (`RESERVED`): `kick`, `drop` and
  // `pan` are what worlds already call their own variables, and a signal that
  // took one of those names would silently empty a world's GLSL of it. Each
  // group runs in its uniform's own order, and is set as one run.
  'beatPhase',
  'barPhase',
  'tempo',
  'tempoSure',
  'drumKick',
  'drumSnare',
  'drumHat',
  'songIntensity',
  'songBuild',
  'songDrop',
  'songDrops',
  'stereoPan',
  'stereoWidth',
  'voiceOpen',
  'voiceNote',
  'voiceSure',
  'pointerX',
  'pointerY',
  'pointerHeld',
  'pointerOver',
  'tapX',
  'tapY',
  'tapAge',
  'taps',
  'viewYaw',
  'viewPitch',
  'viewZoom',
] as const;

/** What a formula evaluated once per copy may name besides. */
export const WORLD_INSTANCE_SIGNALS = [
  'i',
  'n',
  'u',
  'rand',
  'rand2',
  'rand3',
  'x',
  'y',
  'z',
  'angle',
] as const;

/** A pack parameter as a formula names it. */
export const worldParamName = (id: string): string => `p.${id}`;

/** A world variable as a GLSL hook names it. */
export const worldVarUniform = (name: string): string => `uVar_${name}`;

/**
 * The names a world's formulas may use, in `env` order: the signals, the
 * pack's parameters, then its variables.
 */
export const worldScopeNames = (
  paramIds: readonly string[],
  varNames: readonly string[],
): string[] => [...WORLD_SIGNALS, ...paramIds.map(worldParamName), ...varNames];

/** The same, with the per-copy names after. */
export const worldInstanceScopeNames = (
  paramIds: readonly string[],
  varNames: readonly string[],
): string[] => [
  ...worldScopeNames(paramIds, varNames),
  ...WORLD_INSTANCE_SIGNALS,
];
