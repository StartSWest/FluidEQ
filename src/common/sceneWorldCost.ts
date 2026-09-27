/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import {
  WORLD_INSTANCE_SIGNALS,
  WORLD_LIMITS,
  type IWorldGeometry,
  type TWorldColour,
  type TWorldExpr,
} from './sceneWorld';
import { compileExpression, type IExpressionScope } from './worldExpression';

/**
 * What a world costs a frame, worked out from its description alone, so the
 * reader can hold it to a budget before anything is built — in the app and
 * on the server alike, which read worlds with this same code.
 *
 * A world is somebody else's, and every listener's machine draws it. The
 * bounds on copies, nodes and GLSL each held, and together still let one
 * world ask for 60,000 copies of a 256-by-256 sphere: four billion vertices
 * a frame, which is a driver reset rather than a slow frame.
 */

/**
 * Vertices three.js builds for `shape` (`worldGeometry.ts`): the platonic
 * solids unindexed, three a triangle, everything else a grid of rings.
 */
export const geometryVertices = (shape: IWorldGeometry): number => {
  const [around, along] = shape.segments;
  const split = (shape.detail + 1) ** 2;
  const ring = Math.max(3, around) + 1;
  const caps = shape.open ? 0 : 2 * Math.max(3, around) + 1;
  switch (shape.kind) {
    case 'sphere':
      return (around + 1) * (Math.max(2, along) + 1);
    case 'icosahedron':
      return 60 * split;
    case 'octahedron':
      return 24 * split;
    case 'tetrahedron':
      return 12 * split;
    case 'dodecahedron':
      return 108 * split;
    case 'torus':
      return (Math.max(2, along) + 1) * ring;
    case 'torusKnot':
      return (Math.max(3, around * 2) + 1) * (Math.max(3, along) + 1);
    case 'cylinder':
      return ring * 2 + caps * 2;
    case 'cone':
      return ring * 2 + caps;
    case 'plane':
      return (around + 1) * (along + 1);
    case 'ring':
      return ring * 2;
    case 'capsule':
      return ring * (2 * Math.max(1, along) + 2);
    default:
      return 24;
  }
};

/**
 * What one placement of a model is charged against the frame's vertices.
 * Every grid three builds draws about two triangles a vertex, so a frame's
 * vertices stand for twice as many triangles; a model is charged its shaded
 * vertices, or half its triangles where those are more. Its vertices alone
 * let a model of three vertices and half a million triangles, indexed over
 * and over, be placed 512 times: a quarter of a billion triangles a frame,
 * charged 1,536 vertices.
 */
export const modelFrameVertices = (cost: {
  vertices: number;
  triangles: number;
}): number => Math.max(cost.vertices, Math.ceil(cost.triangles / 2));

const PER_COPY = new Set<string>(WORLD_INSTANCE_SIGNALS);

/**
 * Whether a per-copy formula changes from frame to frame, or only from copy
 * to copy. A pillar's place round a ring is worked out once; its height, if
 * it reads the spectrum, every frame. The one rule for both sides: what the
 * budget charges a frame here is what the engine works out a frame
 * (`worldCopies.ts`).
 */
export const variesPerFrame = (formula: {
  names: readonly string[];
  live: boolean;
  constant?: number | boolean;
}): boolean =>
  formula.constant !== true &&
  typeof formula.constant !== 'number' &&
  (formula.live || formula.names.some((name) => !PER_COPY.has(name)));

/** A per-copy formula's share of a frame, for each copy it runs for. */
interface IFormulaCost {
  /** Worked out again every frame, rather than once for the copy. */
  everyFrame: boolean;
  /** Slots its remembering calls (`smooth`, `decay`, `integrate`) keep. */
  state: number;
}

const formulaCost = (
  value: TWorldExpr,
  scope: IExpressionScope,
): IFormulaCost => {
  if (typeof value === 'number') {
    return { everyFrame: false, state: 0 };
  }
  const compiled = compileExpression(value, scope);
  if (!compiled.ok) {
    return { everyFrame: false, state: 0 };
  }
  const { expression } = compiled;
  return {
    everyFrame: variesPerFrame(expression),
    state: expression.stateSize,
  };
};

const colourFormulas = (colour: TWorldColour | undefined): TWorldExpr[] => {
  if (!colour || 'hex' in colour) {
    return [];
  }
  return [...('hsl' in colour ? colour.hsl : colour.rgb)];
};

/**
 * Formulas run per copy each frame, and state slots kept per copy. A colour
 * is worked out whole (`worldCopies.ts`): when one of its channels follows
 * the music all three are worked out every frame, and all three are counted.
 */
export const copyCost = (
  formulas: readonly TWorldExpr[],
  colour: TWorldColour | undefined,
  scope: IExpressionScope,
): { perFrame: number; state: number } => {
  const parts = formulas.map((formula) => formulaCost(formula, scope));
  const hues = colourFormulas(colour).map((formula) =>
    formulaCost(formula, scope),
  );
  const colourFrame = hues.some((cost) => cost.everyFrame) ? hues.length : 0;
  return {
    perFrame: parts.filter((cost) => cost.everyFrame).length + colourFrame,
    state: [...parts, ...hues].reduce((sum, cost) => sum + cost.state, 0),
  };
};

/**
 * The same for a ribbon's points, every one of which is worked out every
 * frame (`worldRibbon.ts`) whatever it reads.
 */
export const pointCost = (
  formulas: readonly TWorldExpr[],
  colour: TWorldColour,
  scope: IExpressionScope,
): { perFrame: number; state: number } => {
  const all = [...formulas, ...colourFormulas(colour)];
  return {
    perFrame: all.filter((formula) => typeof formula !== 'number').length,
    state: all
      .map((formula) => formulaCost(formula, scope).state)
      .reduce((sum, slots) => sum + slots, 0),
  };
};

/** How many times a frame the world is drawn. */
export interface IWorldPasses {
  /** Again for its reflection (`worldHasMirror`). */
  mirrored: boolean;
  /** Again behind glass (`worldHasGlass`, or a model's). */
  glass: boolean;
}

/** A world's frame as its nodes are read: what is spent, and on what. */
export interface IWorldBudget {
  /**
   * A frame's vertices so far, and what each counts: once for every time the
   * world is drawn a frame — again for a mirror, again behind glass.
   */
  vertices: number;
  vertexWeight: number;
  formulas: number;
  formulaState: number;
  /** Times a caster is drawn into shadow maps a frame: six for a point light. */
  shadowPasses: number;
  /** Every node that casts a shadow, in reading order, and its vertices. */
  casters: { node: { castShadow: boolean }; vertices: number }[];
}

export const createWorldBudget = (passes: IWorldPasses): IWorldBudget => ({
  vertices: 0,
  vertexWeight: (passes.mirrored ? 2 : 1) * (passes.glass ? 2 : 1),
  formulas: 0,
  formulaState: 0,
  shadowPasses: 0,
  casters: [],
});

/**
 * Takes a node's share of the frame, or says there is no room for it: then
 * it is left out, like a copy past the copy limit.
 */
export const affordInFrame = (
  budget: IWorldBudget,
  vertices: number,
  formulas = 0,
  formulaState = 0,
): boolean => {
  const drawn = budget.vertices + vertices * budget.vertexWeight;
  if (
    drawn > WORLD_LIMITS.frameVertices ||
    budget.formulas + formulas > WORLD_LIMITS.frameFormulas ||
    budget.formulaState + formulaState > WORLD_LIMITS.formulaState
  ) {
    return false;
  }
  budget.vertices = drawn;
  budget.formulas += formulas;
  budget.formulaState += formulaState;
  return true;
};

/**
 * Shadows are drawn once a frame whatever else redraws the world — the
 * mirror keeps the shadow map it was given (`worldMirror.ts`) — each caster
 * again for every pass of every light that shadows. Worked out once every
 * light is known, since a light may be read after what it lights; past the
 * frame's budget the last casters stop casting, rather than the world
 * losing parts it would otherwise keep.
 */
export const shedShadows = (budget: IWorldBudget): void => {
  const passes = budget.shadowPasses;
  let shadowed =
    budget.casters.reduce((sum, caster) => sum + caster.vertices, 0) * passes;
  for (
    let i = budget.casters.length - 1;
    i >= 0 && budget.vertices + shadowed > WORLD_LIMITS.frameVertices;
    i -= 1
  ) {
    const caster = budget.casters[i];
    caster.node.castShadow = false;
    shadowed -= caster.vertices * passes;
  }
};
