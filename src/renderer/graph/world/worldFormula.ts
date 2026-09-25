/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { Color, SRGBColorSpace } from 'three';
import type { TWorldColour, TWorldExpr, TWorldVec3 } from 'common/sceneWorld';
import {
  compileExpression,
  type IExpressionRuntime,
  type IExpressionScope,
} from 'common/worldExpression';

/**
 * A world's formulas, bound to the frame they are evaluated in.
 *
 * Every formula keeps its own state (for `smooth`, `decay`, `integrate`), one
 * slot set per copy when it is evaluated once per copy, so two pillars easing
 * toward their own heights never share an easing.
 */

export interface IWorldFormula {
  /** This frame's value, for copy `copy` of a per-copy formula. */
  value(copy?: number): number;
  /** Set when it never changes. */
  constant?: number;
  names: readonly string[];
  live: boolean;
}

export interface IWorldVec3Formula {
  x: IWorldFormula;
  y: IWorldFormula;
  z: IWorldFormula;
  constant: boolean;
}

export interface IWorldColourFormula {
  /** Writes this frame's colour, in the renderer's linear space. */
  apply(target: Color, copy?: number): void;
  constant: boolean;
  names: readonly string[];
  live: boolean;
}

/**
 * A formula already checked by the reader. One that fails here anyway — a
 * scope that shrank between the two — is 0 rather than an exception in the
 * middle of a frame.
 */
export const createFormula = (
  source: TWorldExpr,
  runtime: IExpressionRuntime,
  scope: IExpressionScope,
  copies = 1,
): IWorldFormula => {
  const compiled = compileExpression(source, scope);
  if (!compiled.ok) {
    return { value: () => 0, constant: 0, names: [], live: false };
  }
  const { expression } = compiled;
  if (expression.constant !== undefined) {
    const fixed = expression.constant;
    return { value: () => fixed, constant: fixed, names: [], live: false };
  }
  const size = expression.stateSize;
  const state = new Float64Array(Math.max(1, size * Math.max(1, copies)));
  const { evaluate } = expression;
  return {
    value: (copy = 0) => {
      runtime.state = state;
      runtime.stateBase = copy * size;
      return evaluate(runtime);
    },
    names: expression.names,
    live: expression.live,
  };
};

export const createVec3Formula = (
  source: TWorldVec3,
  runtime: IExpressionRuntime,
  scope: IExpressionScope,
  copies = 1,
): IWorldVec3Formula => {
  const x = createFormula(source[0], runtime, scope, copies);
  const y = createFormula(source[1], runtime, scope, copies);
  const z = createFormula(source[2], runtime, scope, copies);
  return {
    x,
    y,
    z,
    constant:
      x.constant !== undefined &&
      y.constant !== undefined &&
      z.constant !== undefined,
  };
};

export const createColourFormula = (
  source: TWorldColour,
  runtime: IExpressionRuntime,
  scope: IExpressionScope,
  copies = 1,
): IWorldColourFormula => {
  if ('hex' in source) {
    const fixed = new Color(source.hex);
    return {
      apply: (target) => {
        target.copy(fixed);
      },
      constant: true,
      names: [],
      live: false,
    };
  }
  const hsl = 'hsl' in source;
  const channels = createVec3Formula(
    hsl ? source.hsl : source.rgb,
    runtime,
    scope,
    copies,
  );
  const names = [...channels.x.names, ...channels.y.names, ...channels.z.names];
  const live = channels.x.live || channels.y.live || channels.z.live;
  return {
    apply: (target, copy = 0) => {
      const a = channels.x.value(copy);
      const b = channels.y.value(copy);
      const c = channels.z.value(copy);
      if (hsl) {
        // Hue wraps; saturation and lightness are the colour's own 0..1.
        target.setHSL(
          a - Math.floor(a),
          Math.min(1, Math.max(0, b)),
          Math.min(1, Math.max(0, c)),
          SRGBColorSpace,
        );
      } else {
        // Brighter than white is allowed: a glow is light, not paint.
        target.setRGB(
          Math.max(0, a),
          Math.max(0, b),
          Math.max(0, c),
          SRGBColorSpace,
        );
      }
    },
    constant: channels.constant,
    names,
    live,
  };
};

/**
 * Whether a per-copy formula changes from frame to frame, or only from copy
 * to copy. A pillar's place round a ring is worked out once; its height, if
 * it reads the spectrum, every frame.
 */
export const variesPerFrame = (
  formula: {
    names: readonly string[];
    live: boolean;
    constant?: number | boolean;
  },
  perCopy: ReadonlySet<string>,
): boolean =>
  formula.constant !== true &&
  typeof formula.constant !== 'number' &&
  (formula.live || formula.names.some((name) => !perCopy.has(name)));
