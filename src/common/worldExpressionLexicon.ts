/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * The words a world's formula is made of (`worldExpression.ts`): its
 * operators, constants and functions, and the tokenizer that splits a
 * formula into them. Every function here is pure and total: whatever it is
 * handed, it answers a number, and the tokenizer stops at a length bound
 * rather than reading whatever a pack sends.
 */

const MAX_TOKENS = 240;

export type TToken =
  | { kind: 'number'; value: number; at: number }
  | { kind: 'name'; value: string; at: number }
  | { kind: 'op'; value: string; at: number };

const OPERATORS = [
  '<=',
  '>=',
  '==',
  '!=',
  '&&',
  '||',
  '+',
  '-',
  '*',
  '/',
  '%',
  '^',
  '(',
  ')',
  ',',
  '?',
  ':',
  '<',
  '>',
  '!',
];

export const CONSTANTS: Readonly<Record<string, number>> = {
  pi: Math.PI,
  tau: Math.PI * 2,
  e: Math.E,
};

const fract = (x: number) => x - Math.floor(x);
const clampRange = (x: number, low: number, high: number) =>
  Math.min(high, Math.max(low, x));

/** A repeatable 0..1 from any number: the same input, the same answer. */
export const hash01 = (x: number): number =>
  fract(Math.sin(x * 127.1 + 311.7) * 43758.5453123);

/** Smooth value noise along one axis, 0..1. */
const noise1 = (x: number) => {
  const cell = Math.floor(x);
  const t = x - cell;
  const eased = t * t * (3 - 2 * t);
  return hash01(cell) + (hash01(cell + 1) - hash01(cell)) * eased;
};

const smoothstep = (low: number, high: number, x: number) => {
  if (high === low) {
    return x < low ? 0 : 1;
  }
  const t = clampRange((x - low) / (high - low), 0, 1);
  return t * t * (3 - 2 * t);
};

/** Pure functions, by the number of arguments they take. */
export const PURE: Readonly<Record<string, (...args: number[]) => number>> = {
  sin: Math.sin,
  cos: Math.cos,
  tan: Math.tan,
  asin: (x) => Math.asin(clampRange(x, -1, 1)),
  acos: (x) => Math.acos(clampRange(x, -1, 1)),
  atan: Math.atan,
  atan2: Math.atan2,
  abs: Math.abs,
  sign: Math.sign,
  floor: Math.floor,
  ceil: Math.ceil,
  round: Math.round,
  fract,
  sqrt: (x) => Math.sqrt(Math.max(0, x)),
  exp: (x) => Math.exp(Math.min(80, x)),
  log: (x) => Math.log(Math.max(1e-12, x)),
  pow: (x, y) => Math.abs(x) ** y,
  min: Math.min,
  max: Math.max,
  clamp: clampRange,
  saturate: (x) => clampRange(x, 0, 1),
  mix: (a, b, t) => a + (b - a) * t,
  step: (edge, x) => (x < edge ? 0 : 1),
  smoothstep,
  mod: (x, y) => (y === 0 ? 0 : x - y * Math.floor(x / y)),
  hash: hash01,
  noise: noise1,
};

export const ARITY: Readonly<Record<string, number>> = {
  atan2: 2,
  pow: 2,
  min: 2,
  max: 2,
  clamp: 3,
  mix: 3,
  step: 2,
  smoothstep: 3,
  mod: 2,
  smooth: 2,
  decay: 2,
  integrate: 1,
  spec: 1,
  slow: 1,
  wave: 1,
};

export const STATEFUL = new Set(['smooth', 'decay', 'integrate']);
export const MUSIC = new Set(['spec', 'slow', 'wave']);

export const tokenize = (text: string): TToken[] | string => {
  const tokens: TToken[] = [];
  let at = 0;
  while (at < text.length) {
    const char = text[at];
    if (/\s/.test(char)) {
      at += 1;
    } else if (/[0-9.]/.test(char)) {
      const match = /^(?:\d+\.?\d*|\.\d+)(?:[eE][-+]?\d+)?/.exec(
        text.slice(at),
      );
      if (!match) {
        return `unreadable number at ${at + 1}`;
      }
      tokens.push({ kind: 'number', value: Number(match[0]), at });
      at += match[0].length;
    } else if (/[A-Za-z_]/.test(char)) {
      const match = /^[A-Za-z_][A-Za-z0-9_]*(?:\.[A-Za-z_][A-Za-z0-9_]*)?/.exec(
        text.slice(at),
      );
      if (!match) {
        return `unreadable name at ${at + 1}`;
      }
      tokens.push({ kind: 'name', value: match[0], at });
      at += match[0].length;
    } else {
      const from = at;
      const operator = OPERATORS.find((op) => text.startsWith(op, from));
      if (!operator) {
        return `unexpected "${char}" at ${at + 1}`;
      }
      tokens.push({ kind: 'op', value: operator, at });
      at += operator.length;
    }
    if (tokens.length > MAX_TOKENS) {
      return 'formula is too long';
    }
  }
  return tokens;
};
