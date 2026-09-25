/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * The arithmetic a 3D scene uses to tie what it draws to the music.
 *
 * A world is a document, never a program (`scenePacks.ts` explains why that
 * line matters for a scene that is sold), so it cannot carry a function. What
 * it can carry is a formula — `"4 + slow(u) * 9"` for a pillar's height — and
 * this reads one into a tree of closures once, at load, so a frame evaluates
 * it without parsing anything. There is no `eval`, no property access and no
 * way to name anything but the values and functions a scope declares, so a
 * formula can compute a number and nothing else.
 *
 * Three functions keep state between frames, one slot per place they are
 * written (and per instance, for a formula evaluated once per instance):
 * `smooth(x, s)` eases toward `x` with a half-life of `s` seconds, `decay(x, s)`
 * jumps up to `x` and falls back with that half-life, and `integrate(x)` adds
 * up `x` a second. The last is what lets a speed follow the music without the
 * position jumping: an angle of `integrate(0.1 + bass)` turns faster on the
 * kick and never leaps, where `time * (0.1 + bass)` would.
 */

import {
  ARITY,
  CONSTANTS,
  MUSIC,
  PURE,
  STATEFUL,
  tokenize,
  type TToken,
} from './worldExpressionLexicon';

export { hash01 } from './worldExpressionLexicon';

export const MAX_EXPRESSION_LENGTH = 400;
const MAX_DEPTH = 40;

/** What a formula runs against: the scope's values and its stateful slots. */
export interface IExpressionRuntime {
  /** Values by the index `IExpressionScope.names` gave them. */
  env: Float64Array;
  /** Stateful slots; this evaluation's begin at `stateBase`. */
  state: Float64Array;
  stateBase: number;
  /** Seconds since the last frame, for the stateful functions. */
  dt: number;
  spectrum(u: number): number;
  slow(u: number): number;
  wave(u: number): number;
}

export type TEvaluate = (runtime: IExpressionRuntime) => number;

export interface ICompiledExpression {
  evaluate: TEvaluate;
  /** Slots the stateful calls in it need, one each. */
  stateSize: number;
  /** Set when the formula names no value and calls nothing stateful. */
  constant?: number;
  /** Every value it names, so a caller can tell what it changes with. */
  names: readonly string[];
  /** Whether it keeps state or reads the music's own curves. */
  live: boolean;
}

export interface IExpressionScope {
  /** The values a formula may name, in the order `env` holds them. */
  names: readonly string[];
}

export type TExpressionResult =
  { ok: true; expression: ICompiledExpression } | { ok: false; error: string };

/** A node of the tree before it is closed over: constant or not. */
interface IPart {
  evaluate: TEvaluate;
  constant?: number;
}

const constantPart = (value: number): IPart => ({
  evaluate: () => value,
  constant: value,
});

class ExpressionError extends Error {}

/**
 * Recursive descent over the token list. Precedence, loosest first:
 * `?:`, `||`, `&&`, comparisons, `+ -`, `* / %`, unary `- + !`, `^`.
 */
const parse = (tokens: TToken[], scope: IExpressionScope) => {
  let position = 0;
  let depth = 0;
  let stateSize = 0;
  let live = false;
  const named = new Set<string>();

  const peek = () => tokens[position];
  const isOp = (value: string) => {
    const token = peek();
    return token !== undefined && token.kind === 'op' && token.value === value;
  };
  const expect = (value: string) => {
    if (!isOp(value)) {
      const token = peek();
      throw new ExpressionError(
        token
          ? `expected "${value}" at ${token.at + 1}`
          : `expected "${value}" at the end`,
      );
    }
    position += 1;
  };
  const enter = () => {
    depth += 1;
    if (depth > MAX_DEPTH) {
      throw new ExpressionError('formula is nested too deeply');
    }
  };

  const fold = (parts: IPart[], combine: (...values: number[]) => number) => {
    if (parts.every((part) => part.constant !== undefined)) {
      return constantPart(combine(...parts.map((part) => part.constant ?? 0)));
    }
    const evaluators = parts.map((part) => part.evaluate);
    if (evaluators.length === 1) {
      const [only] = evaluators;
      return { evaluate: (rt: IExpressionRuntime) => combine(only(rt)) };
    }
    if (evaluators.length === 2) {
      const [left, right] = evaluators;
      return {
        evaluate: (rt: IExpressionRuntime) => combine(left(rt), right(rt)),
      };
    }
    return {
      evaluate: (rt: IExpressionRuntime) =>
        combine(...evaluators.map((evaluate) => evaluate(rt))),
    };
  };

  const stateful = (name: string, args: IPart[]): IPart => {
    const slot = stateSize;
    stateSize += 1;
    const [value, seconds] = args.map((part) => part.evaluate);
    if (name === 'integrate') {
      return {
        evaluate: (rt) => {
          const index = rt.stateBase + slot;
          rt.state[index] += value(rt) * rt.dt;
          return rt.state[index];
        },
      };
    }
    const rising = name === 'decay';
    return {
      evaluate: (rt) => {
        const index = rt.stateBase + slot;
        const target = value(rt);
        const halfLife = Math.max(1e-3, seconds(rt));
        const ease = 1 - 0.5 ** (rt.dt / halfLife);
        const current = rt.state[index];
        rt.state[index] =
          rising && target > current
            ? target
            : current + (target - current) * ease;
        return rt.state[index];
      },
    };
  };

  const call = (name: string, at: number): IPart => {
    expect('(');
    const args: IPart[] = [];
    if (!isOp(')')) {
      args.push(ternary());
      while (isOp(',')) {
        position += 1;
        args.push(ternary());
      }
    }
    expect(')');
    const wanted = ARITY[name] ?? 1;
    if (args.length !== wanted) {
      throw new ExpressionError(
        `${name}() takes ${wanted} value${wanted === 1 ? '' : 's'}, at ${at + 1}`,
      );
    }
    if (STATEFUL.has(name)) {
      live = true;
      return stateful(name, args);
    }
    if (MUSIC.has(name)) {
      live = true;
      const [u] = args.map((part) => part.evaluate);
      if (name === 'spec') {
        return { evaluate: (rt) => rt.spectrum(u(rt)) };
      }
      if (name === 'slow') {
        return { evaluate: (rt) => rt.slow(u(rt)) };
      }
      return { evaluate: (rt) => rt.wave(u(rt)) };
    }
    return fold(args, PURE[name]);
  };

  const primary = (): IPart => {
    const token = peek();
    if (!token) {
      throw new ExpressionError('formula ends too early');
    }
    position += 1;
    if (token.kind === 'number') {
      return constantPart(token.value);
    }
    if (token.kind === 'op' && token.value === '(') {
      enter();
      const inner = ternary();
      depth -= 1;
      expect(')');
      return inner;
    }
    if (token.kind === 'name') {
      const { value: name } = token;
      if (isOp('(')) {
        if (
          !Object.prototype.hasOwnProperty.call(PURE, name) &&
          !STATEFUL.has(name) &&
          !MUSIC.has(name)
        ) {
          throw new ExpressionError(`unknown function "${name}"`);
        }
        enter();
        const part = call(name, token.at);
        depth -= 1;
        return part;
      }
      if (Object.prototype.hasOwnProperty.call(CONSTANTS, name)) {
        return constantPart(CONSTANTS[name]);
      }
      const index = scope.names.indexOf(name);
      if (index < 0) {
        throw new ExpressionError(`unknown value "${name}"`);
      }
      named.add(name);
      return { evaluate: (rt) => rt.env[index] };
    }
    throw new ExpressionError(`unexpected "${token.value}" at ${token.at + 1}`);
  };

  const power = (): IPart => {
    const base = primary();
    if (isOp('^')) {
      position += 1;
      enter();
      const exponent = unary();
      depth -= 1;
      return fold([base, exponent], PURE.pow);
    }
    return base;
  };

  const unary = (): IPart => {
    if (isOp('-') || isOp('+') || isOp('!')) {
      const token = peek();
      position += 1;
      enter();
      const operand = unary();
      depth -= 1;
      if (token?.value === '-') {
        return fold([operand], (x) => -x);
      }
      if (token?.value === '!') {
        return fold([operand], (x) => (x === 0 ? 1 : 0));
      }
      return operand;
    }
    return power();
  };

  const binary = (
    next: () => IPart,
    table: Readonly<Record<string, (a: number, b: number) => number>>,
  ) => {
    let left = next();
    let token = peek();
    while (
      token !== undefined &&
      token.kind === 'op' &&
      Object.prototype.hasOwnProperty.call(table, token.value)
    ) {
      position += 1;
      left = fold([left, next()], table[token.value]);
      token = peek();
    }
    return left;
  };

  const product = () =>
    binary(unary, {
      '*': (a, b) => a * b,
      '/': (a, b) => (b === 0 ? 0 : a / b),
      '%': (a, b) => (b === 0 ? 0 : a - b * Math.floor(a / b)),
    });
  const sum = () =>
    binary(product, { '+': (a, b) => a + b, '-': (a, b) => a - b });
  const comparison = () =>
    binary(sum, {
      '<': (a, b) => (a < b ? 1 : 0),
      '>': (a, b) => (a > b ? 1 : 0),
      '<=': (a, b) => (a <= b ? 1 : 0),
      '>=': (a, b) => (a >= b ? 1 : 0),
      '==': (a, b) => (a === b ? 1 : 0),
      '!=': (a, b) => (a !== b ? 1 : 0),
    });
  const conjunction = () =>
    binary(comparison, { '&&': (a, b) => (a !== 0 && b !== 0 ? 1 : 0) });
  const disjunction = () =>
    binary(conjunction, { '||': (a, b) => (a !== 0 || b !== 0 ? 1 : 0) });

  function ternary(): IPart {
    const condition = disjunction();
    if (!isOp('?')) {
      return condition;
    }
    position += 1;
    enter();
    const whenTrue = ternary();
    expect(':');
    const whenFalse = ternary();
    depth -= 1;
    if (condition.constant !== undefined) {
      return condition.constant !== 0 ? whenTrue : whenFalse;
    }
    const test = condition.evaluate;
    const yes = whenTrue.evaluate;
    const no = whenFalse.evaluate;
    return { evaluate: (rt) => (test(rt) !== 0 ? yes(rt) : no(rt)) };
  }

  const root = ternary();
  if (position < tokens.length) {
    const token = tokens[position];
    throw new ExpressionError(
      `unexpected "${String(token.value)}" at ${token.at + 1}`,
    );
  }
  return { root, stateSize, live, names: [...named] };
};

/**
 * A formula read into closures, or why it could not be.
 *
 * A number is accepted as well as text, so a world can write `2` or `"2"`
 * alike. Whatever the arithmetic produces, a frame is never handed NaN or
 * Infinity: those become 0, because one NaN in a matrix makes the whole
 * object vanish for good.
 */
export const compileExpression = (
  source: string | number,
  scope: IExpressionScope,
): TExpressionResult => {
  if (typeof source === 'number') {
    return Number.isFinite(source)
      ? {
          ok: true,
          expression: {
            evaluate: () => source,
            stateSize: 0,
            constant: source,
            names: [],
            live: false,
          },
        }
      : { ok: false, error: 'not a finite number' };
  }
  if (source.length === 0 || source.length > MAX_EXPRESSION_LENGTH) {
    return { ok: false, error: 'formula is empty or too long' };
  }
  const tokens = tokenize(source);
  if (typeof tokens === 'string') {
    return { ok: false, error: tokens };
  }
  if (tokens.length === 0) {
    return { ok: false, error: 'formula is empty' };
  }
  try {
    const { root, stateSize, live, names } = parse(tokens, scope);
    if (root.constant !== undefined) {
      const value = Number.isFinite(root.constant) ? root.constant : 0;
      return {
        ok: true,
        expression: {
          evaluate: () => value,
          stateSize: 0,
          constant: value,
          names: [],
          live: false,
        },
      };
    }
    const inner = root.evaluate;
    return {
      ok: true,
      expression: {
        evaluate: (rt) => {
          const value = inner(rt);
          return Number.isFinite(value) ? value : 0;
        },
        stateSize,
        names,
        live,
      },
    };
  } catch (error) {
    if (error instanceof ExpressionError) {
      return { ok: false, error: error.message };
    }
    throw error;
  }
};

/** Whether `source` is a formula this scope can run: the reader's check. */
export const isValidExpression = (
  source: unknown,
  scope: IExpressionScope,
): source is string | number =>
  (typeof source === 'string' || typeof source === 'number') &&
  compileExpression(source, scope).ok;
