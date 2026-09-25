/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import type { TWorldColour, TWorldExpr, TWorldVec3 } from './sceneWorld';
import { isValidExpression, type IExpressionScope } from './worldExpression';

/** The small readers every part of a world is built from. */

export interface IWorldScopes {
  /** What a formula over the whole scene may name. */
  global: IExpressionScope;
  /** The same, plus one copy's own `i`, `u`, `rand` and position. */
  instance: IExpressionScope;
}

export const isWorldRecord = (
  value: unknown,
): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

export const clampWorld = (value: number, min: number, max: number): number =>
  Math.min(max, Math.max(min, value));

/** A finite number kept inside its bounds, or the fallback. */
export const readNumber = (
  value: unknown,
  fallback: number,
  min: number,
  max: number,
): number =>
  typeof value === 'number' && Number.isFinite(value)
    ? clampWorld(value, min, max)
    : fallback;

/** A whole number kept inside its bounds, or the fallback. */
export const readCount = (
  value: unknown,
  fallback: number,
  min: number,
  max: number,
): number =>
  // Rounded inside the range: a grid's second axis is bounded by the room
  // its first left, which is rarely whole, and rounding 1.5 up to 2 let a
  // grid past the copy limit by a third.
  Math.min(
    Math.floor(max),
    Math.max(Math.ceil(min), Math.round(readNumber(value, fallback, min, max))),
  );

export const readBoolean = (value: unknown, fallback: boolean): boolean =>
  typeof value === 'boolean' ? value : fallback;

export const readChoice = <T extends string>(
  value: unknown,
  choices: readonly T[],
  fallback: T,
): T => choices.find((choice) => choice === value) ?? fallback;

/** A formula this scope can run, or the fallback. */
export const readExpr = <T extends TWorldExpr | undefined>(
  value: unknown,
  scope: IExpressionScope,
  fallback: T,
): TWorldExpr | T => (isValidExpression(value, scope) ? value : fallback);

/**
 * Three formulas. A single one is accepted where `broadcast` says so — a
 * scale of `2` means twice as big every way — and any entry that cannot be
 * read takes the fallback's, so one bad axis does not undo the other two.
 */
export const readVec3 = (
  value: unknown,
  scope: IExpressionScope,
  fallback: TWorldVec3,
  broadcast = false,
): TWorldVec3 => {
  if (broadcast && isValidExpression(value, scope)) {
    return [value, value, value];
  }
  if (!Array.isArray(value) || value.length !== 3) {
    return fallback;
  }
  return [
    readExpr(value[0], scope, fallback[0]),
    readExpr(value[1], scope, fallback[1]),
    readExpr(value[2], scope, fallback[2]),
  ];
};

/** Three plain numbers, each bounded; the fallback for anything else. */
export const readTriple = (
  value: unknown,
  fallback: readonly [number, number, number],
  min: number,
  max: number,
): readonly [number, number, number] => {
  if (!Array.isArray(value) || value.length !== 3) {
    return fallback;
  }
  return [
    readNumber(value[0], fallback[0], min, max),
    readNumber(value[1], fallback[1], min, max),
    readNumber(value[2], fallback[2], min, max),
  ];
};

/** A fixed sRGB colour as a world writes one. */
export const WORLD_HEX = /^#[0-9a-f]{6}$/i;

/** A hex, `{ hsl: [...] }` or `{ rgb: [...] }`; the fallback otherwise. */
export const readColour = (
  value: unknown,
  scope: IExpressionScope,
  fallback: TWorldColour,
): TWorldColour => {
  if (typeof value === 'string') {
    return WORLD_HEX.test(value) ? { hex: value.toLowerCase() } : fallback;
  }
  if (!isWorldRecord(value)) {
    return fallback;
  }
  // The form this reader writes, so a world read twice is the same world.
  if (typeof value.hex === 'string') {
    return WORLD_HEX.test(value.hex)
      ? { hex: value.hex.toLowerCase() }
      : fallback;
  }
  if (Array.isArray(value.hsl)) {
    return { hsl: readVec3(value.hsl, scope, [0, 0, 1]) };
  }
  if (Array.isArray(value.rgb)) {
    return { rgb: readVec3(value.rgb, scope, [1, 1, 1]) };
  }
  return fallback;
};
