/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import {
  WORLD_INSTANCE_SIGNALS,
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

const PER_COPY = new Set<string>(WORLD_INSTANCE_SIGNALS);

/** A per-copy formula's share of a frame, for each copy it runs for. */
export interface IFormulaCost {
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
  if (!compiled.ok || compiled.expression.constant !== undefined) {
    return { everyFrame: false, state: 0 };
  }
  const { expression } = compiled;
  return {
    everyFrame:
      expression.live || expression.names.some((name) => !PER_COPY.has(name)),
    state: expression.stateSize,
  };
};

const colourFormulas = (colour: TWorldColour | undefined): TWorldExpr[] => {
  if (!colour || 'hex' in colour) {
    return [];
  }
  return [...('hsl' in colour ? colour.hsl : colour.rgb)];
};

/** Formulas run per copy each frame, and state slots kept per copy. */
export const copyCost = (
  formulas: readonly TWorldExpr[],
  colour: TWorldColour | undefined,
  scope: IExpressionScope,
): { perFrame: number; state: number } =>
  [...formulas, ...colourFormulas(colour)]
    .map((formula) => formulaCost(formula, scope))
    .reduce(
      (total, cost) => ({
        perFrame: total.perFrame + (cost.everyFrame ? 1 : 0),
        state: total.state + cost.state,
      }),
      { perFrame: 0, state: 0 },
    );

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
