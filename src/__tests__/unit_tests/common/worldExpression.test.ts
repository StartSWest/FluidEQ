/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import {
  compileExpression,
  isValidExpression,
  MAX_EXPRESSION_LENGTH,
  type ICompiledExpression,
  type IExpressionRuntime,
  type IExpressionScope,
} from '../../../common/worldExpression';
import {
  MUSIC,
  PURE,
  STATEFUL,
  tokenize,
} from '../../../common/worldExpressionLexicon';

/**
 * The arithmetic a 3D world ties itself to the music with. A world is
 * somebody else's document, so a formula in it must compute a number and
 * nothing else: no JavaScript reached through a name, no frame handed NaN,
 * no formula long or deep enough to cost the reader anything. And the three
 * functions that remember keep one memory per place they are written and
 * per copy, or a hundred pillars easing to their own heights ease as one.
 */

const SCOPE: IExpressionScope = { names: ['x', 'y'] };

const runtime = (): IExpressionRuntime => ({
  env: new Float64Array(SCOPE.names.length),
  state: new Float64Array(8),
  stateBase: 0,
  dt: 1,
  spectrum: () => 0,
  slow: () => 0,
  wave: () => 0,
});

const compile = (source: string | number): ICompiledExpression => {
  const result = compileExpression(source, SCOPE);
  if (!result.ok) {
    throw new Error(`"${source}" did not compile: ${result.error}`);
  }
  return result.expression;
};

/** Why `source` was refused, or `compiled` when it was not. */
const errorOf = (source: string | number): string => {
  const result = compileExpression(source, SCOPE);
  return result.ok ? 'compiled' : result.error;
};

const valueOf = (source: string | number, x = 0, y = 0): number => {
  const rt = runtime();
  rt.env[0] = x;
  rt.env[1] = y;
  return compile(source).evaluate(rt);
};

/** One formula over several frames, `x` and the frame's length each time. */
const overFrames = (
  source: string,
  frames: readonly { x: number; dt: number }[],
): number[] => {
  const expression = compile(source);
  const rt = runtime();
  return frames.map(({ x, dt }) => {
    rt.env[0] = x;
    rt.dt = dt;
    return expression.evaluate(rt);
  });
};

const steady = (xs: readonly number[], dt = 1) => xs.map((x) => ({ x, dt }));

describe('precedence, loosest first: ?:, ||, &&, comparisons, + -, * / %, unary, ^', () => {
  // Where two levels meet, the case is chosen so that swapping them, or
  // grouping one from the wrong side, changes the answer.
  it.each([
    ['1 + 2 * 3', 7],
    ['(1 + 2) * 3', 9],
    ['10 - 4 - 3', 3],
    ['8 / 4 / 2', 1],
    ['2 * 3 % 4', 2],
    ['2 * 3 ^ 2', 18],
    ['2 ^ 3 ^ 2', 512],
    ['-2 ^ 2', -4],
    ['2 ^ -1', 0.5],
    ['- -4', 4],
    ['+5', 5],
    ['!0', 1],
    ['!3', 0],
    ['!!3', 1],
    ['2 + 2 == 4', 1],
    ['3 > 2 > 1', 0],
    ['2 <= 2', 1],
    ['2 >= 3', 0],
    ['2 != 3', 1],
    ['1 < 2 && 3 < 2', 0],
    ['0 && 1 || 1', 1],
    ['1 || 1 && 0', 1],
    ['0 ? 1 : 2', 2],
    ['1 + 1 ? 10 : 20', 10],
    ['0 ? 1 : 2 + 3', 5],
    ['0 ? 1 : 0 ? 2 : 3', 3],
    ['1 ? 0 ? 5 : 6 : 7', 6],
  ])('reads %s as %d', (source, expected) => {
    expect(valueOf(source)).toBe(expected);
  });

  // Folded at load above; here the same rules run as closures every frame.
  it.each([
    ['x + y * 3', 1, 2, 7],
    ['x ^ y ^ 2', 2, 3, 512],
    ['-x ^ 2', 2, 0, -4],
    ['x > y > 1', 3, 2, 0],
    ['y || x && 0', 1, 1, 1],
    ['x ? y : 5', 0, 9, 5],
    ['x ? y : 5', 1, 9, 9],
    ['-x % 3', 1, 0, 2],
    ['!x', 0, 0, 1],
  ])('reads %s with x = %d and y = %d as %d', (source, x, y, expected) => {
    expect(valueOf(source, x, y)).toBe(expected);
  });

  it('takes the remainder with the sign of the divisor, as GLSL mod does', () => {
    expect(valueOf('-1 % 3')).toBe(2);
    expect(valueOf('5 % -3')).toBe(-1);
    expect(valueOf('mod(-1, 3)')).toBe(2);
  });
});

describe('a frame is never handed anything but a finite number', () => {
  it('reads a division or remainder by zero as 0', () => {
    expect(valueOf('1 / 0')).toBe(0);
    expect(valueOf('5 % 0')).toBe(0);
    expect(valueOf('mod(5, 0)')).toBe(0);
    expect(valueOf('y / x', 0, 5)).toBe(0);
  });

  it('turns a result that would be Infinity or NaN into 0, folded or live', () => {
    const overflow = compile('1e308 * 10');
    expect(overflow.constant).toBe(0);
    expect(overflow.evaluate(runtime())).toBe(0);
    expect(valueOf('10 ^ 400')).toBe(0);
    expect(valueOf('x * 1e308', 10)).toBe(0);
    expect(valueOf('x - x', Infinity)).toBe(0);
    expect(valueOf('sin(x)', Infinity)).toBe(0);
    expect(valueOf('x + 1', NaN)).toBe(0);
  });

  it('answers a number for any input to a function that has a domain', () => {
    expect(valueOf('sqrt(-4)')).toBe(0);
    expect(valueOf('log(0)')).toBe(Math.log(1e-12));
    expect(valueOf('asin(2)')).toBe(Math.PI / 2);
    expect(valueOf('acos(-3)')).toBe(Math.PI);
    expect(valueOf('exp(1000)')).toBe(Math.exp(80));
    // GLSL's pow is undefined below zero; this one reads the base's size.
    expect(valueOf('pow(-4, 0.5)')).toBe(2);
    expect(valueOf('(-4) ^ 0.5')).toBe(2);
    expect(valueOf('smoothstep(1, 1, 0.5)')).toBe(0);
    expect(valueOf('smoothstep(1, 1, 2)')).toBe(1);
  });

  it('accepts a finite number as written and refuses one that is not', () => {
    expect(compile(2.5)).toMatchObject({
      constant: 2.5,
      stateSize: 0,
      names: [],
      live: false,
    });
    expect(compile('2').constant).toBe(2);
    expect(errorOf(Infinity)).toBe('not a finite number');
    expect(errorOf(-Infinity)).toBe('not a finite number');
    expect(errorOf(NaN)).toBe('not a finite number');
  });
});

describe('what a formula reads', () => {
  it('knows the three constants and every value its scope names', () => {
    expect(valueOf('pi')).toBe(Math.PI);
    expect(valueOf('tau')).toBe(Math.PI * 2);
    expect(valueOf('e')).toBe(Math.E);
    expect(valueOf('x * 10 + y', 3, 4)).toBe(34);
  });

  it('says which values it names, and whether it reads the music or keeps state', () => {
    expect(compile('y + x + y')).toMatchObject({
      names: ['y', 'x'],
      live: false,
    });
    expect(compile('x + 1').constant).toBeUndefined();
    expect(compile('pi * 2')).toMatchObject({
      constant: Math.PI * 2,
      names: [],
      live: false,
    });
    expect(compile('spec(0.5)')).toMatchObject({ names: [], live: true });
    expect(compile('smooth(x, 1)')).toMatchObject({
      names: ['x'],
      live: true,
      stateSize: 1,
    });
  });

  it('reads each of the music’s three curves from its own source, at a formula’s place', () => {
    const rt = runtime();
    rt.spectrum = (u) => u + 1;
    rt.slow = (u) => u + 10;
    rt.wave = (u) => u + 100;
    rt.env[0] = 1;
    expect(compile('spec(x * 0.5)').evaluate(rt)).toBe(1.5);
    expect(compile('slow(0.5)').evaluate(rt)).toBe(10.5);
    expect(compile('wave(0.5)').evaluate(rt)).toBe(100.5);
  });

  it('refuses a name its scope does not have', () => {
    expect(errorOf('z')).toBe('unknown value "z"');
    expect(errorOf('bogus(1)')).toBe('unknown function "bogus"');
    // A function's name without its brackets is not a value.
    expect(errorOf('sin')).toBe('unknown value "sin"');
  });
});

describe('the functions a formula may call', () => {
  // The guide's list (docs/scene-worlds.md), with how many values each takes.
  const ARITIES: Readonly<Record<string, number>> = {
    sin: 1,
    cos: 1,
    tan: 1,
    asin: 1,
    acos: 1,
    atan: 1,
    atan2: 2,
    abs: 1,
    sign: 1,
    floor: 1,
    ceil: 1,
    round: 1,
    fract: 1,
    sqrt: 1,
    exp: 1,
    log: 1,
    pow: 2,
    min: 2,
    max: 2,
    clamp: 3,
    saturate: 1,
    mix: 3,
    step: 2,
    smoothstep: 3,
    mod: 2,
    hash: 1,
    noise: 1,
    spec: 1,
    slow: 1,
    wave: 1,
    smooth: 2,
    decay: 2,
    integrate: 1,
  };

  const call = (name: string, count: number) =>
    `${name}(${Array.from({ length: count }, () => '0.5').join(', ')})`;

  it('are exactly the ones the guide lists', () => {
    expect([...Object.keys(PURE), ...STATEFUL, ...MUSIC].sort()).toEqual(
      Object.keys(ARITIES).sort(),
    );
  });

  it.each(Object.entries(ARITIES))(
    'calls %s with %d values and refuses one fewer or one more',
    (name, count) => {
      const values = count === 1 ? 'value' : 'values';
      expect(errorOf(call(name, count))).toBe('compiled');
      expect(errorOf(call(name, count - 1))).toBe(
        `${name}() takes ${count} ${values}, at 1`,
      );
      expect(errorOf(call(name, count + 1))).toBe(
        `${name}() takes ${count} ${values}, at 1`,
      );
    },
  );
});

describe('the three functions that remember', () => {
  it('eases toward a value with the half-life it is given', () => {
    expect(overFrames('smooth(x, 1)', steady([1, 1, 0]))).toEqual([
      0.5, 0.75, 0.375,
    ]);
  });

  it('jumps up to a value and falls back with its half-life', () => {
    expect(overFrames('decay(x, 1)', steady([1, 0, 0, 0.75, 0.25]))).toEqual([
      1, 0.5, 0.25, 0.75, 0.5,
    ]);
  });

  it('adds up a value a second', () => {
    expect(overFrames('integrate(x)', steady([2, 2, -4], 0.5))).toEqual([
      1, 2, 0,
    ]);
  });

  it('never folds a remembering call into a constant, whatever it is handed', () => {
    const expression = compile('integrate(1)');
    expect(expression.constant).toBeUndefined();
    const rt = runtime();
    expect([1, 2, 3].map(() => expression.evaluate(rt))).toEqual([1, 2, 3]);
  });

  it('lands on its target on a half-life of nothing or less, instead of poisoning its memory', () => {
    // A zero half-life on a frame of no time is 0 / 0; a negative one eases
    // away from the target. Either would stay in the slot for good.
    expect(
      overFrames('smooth(x, 0)', [
        { x: 1, dt: 0 },
        { x: 1, dt: 1 },
      ]),
    ).toEqual([0, 1]);
    expect(overFrames('smooth(x, -1)', steady([1]))[0]).toBeCloseTo(1, 9);
  });

  it('keeps one memory for each place it is written', () => {
    const twice = compile('integrate(1) - integrate(1)');
    expect(twice.stateSize).toBe(2);
    const rt = runtime();
    expect([1, 2, 3].map(() => twice.evaluate(rt))).toEqual([0, 0, 0]);
    expect(compile('smooth(x, 1) + decay(x, 1) + integrate(x)').stateSize).toBe(
      3,
    );
    expect(compile('smooth(smooth(x, 1), 1)').stateSize).toBe(2);
  });

  it('keeps one memory for each copy, found from where that copy’s slots begin', () => {
    const expression = compile('smooth(x, 1)');
    const rt = runtime();
    const copy = (index: number, x: number) => {
      rt.stateBase = index * expression.stateSize;
      rt.env[0] = x;
      return expression.evaluate(rt);
    };
    expect([copy(0, 1), copy(1, 0)]).toEqual([0.5, 0]);
    expect([copy(0, 1), copy(1, 0)]).toEqual([0.75, 0]);
  });
});

describe('what a formula is kept from', () => {
  it.each([
    'constructor',
    '__proto__',
    'prototype',
    'toString',
    'valueOf',
    'hasOwnProperty',
    'this',
    'globalThis',
    'window',
    'process',
    'require',
    'eval',
    'Function',
    'Math',
    'Math.PI',
    'x.constructor',
  ])(
    'reads %s as a name it does not know, as a value and as a call',
    (name) => {
      expect(errorOf(name)).toBe(`unknown value "${name}"`);
      expect(errorOf(`${name}(1)`)).toBe(`unknown function "${name}"`);
    },
  );

  it.each([
    ['x[0]', 'unexpected "[" at 2'],
    ['x = 1', 'unexpected "=" at 3'],
    ['x => 1', 'unexpected "=" at 3'],
    ['"x"', 'unexpected """ at 1'],
    ['`x`', 'unexpected "`" at 1'],
    ['x; y', 'unexpected ";" at 2'],
    ['{}', 'unexpected "{" at 1'],
  ])('refuses the punctuation of a program: %s', (source, error) => {
    expect(errorOf(source)).toBe(error);
  });

  it.each([
    ['1 2', 'unexpected "2" at 3'],
    ['1 +', 'formula ends too early'],
    [')', 'unexpected ")" at 1'],
    ['(1', 'expected ")" at the end'],
    ['sin(1', 'expected ")" at the end'],
    ['x ? 1', 'expected ":" at the end'],
    ['', 'formula is empty or too long'],
    ['   ', 'formula is empty'],
  ])('refuses a formula that does not read: "%s"', (source, error) => {
    expect(errorOf(source)).toBe(error);
  });

  it('checks only text and numbers that compile', () => {
    expect(isValidExpression('x + 1', SCOPE)).toBe(true);
    expect(isValidExpression(3, SCOPE)).toBe(true);
    expect(isValidExpression('z', SCOPE)).toBe(false);
    expect(isValidExpression(Infinity, SCOPE)).toBe(false);
    expect(isValidExpression(true, SCOPE)).toBe(false);
    expect(isValidExpression(null, SCOPE)).toBe(false);
    expect(isValidExpression(['1'], SCOPE)).toBe(false);
    expect(isValidExpression({ valueOf: () => 1 }, SCOPE)).toBe(false);
  });
});

describe('the size of a formula', () => {
  it(`reads ${MAX_EXPRESSION_LENGTH} characters and refuses one more`, () => {
    expect(MAX_EXPRESSION_LENGTH).toBe(400);
    const atLimit = `x${' '.repeat(MAX_EXPRESSION_LENGTH - 1)}`;
    expect(errorOf(atLimit)).toBe('compiled');
    expect(errorOf(`${atLimit} `)).toBe('formula is empty or too long');
  });

  it('reads 240 tokens and refuses the 241st', () => {
    const atLimit = `-1${'+1'.repeat(119)}`;
    const past = `1${'+1'.repeat(120)}`;
    expect(tokenize(atLimit)).toHaveLength(240);
    expect(valueOf(atLimit)).toBe(118);
    expect(tokenize(past)).toBe('formula is too long');
    expect(errorOf(past)).toBe('formula is too long');
  });

  // One depth counts every kind of nesting together.
  it.each([
    ['brackets', (n: number) => `${'('.repeat(n)}1${')'.repeat(n)}`],
    ['signs', (n: number) => `${'-'.repeat(n)}1`],
    ['calls', (n: number) => `${'abs('.repeat(n)}1${')'.repeat(n)}`],
    ['powers', (n: number) => `${'1 ^ '.repeat(n)}1`],
    ['choices', (n: number) => `${'0 ? 0 : '.repeat(n)}1`],
    [
      'brackets round signs',
      (n: number) => `${'('.repeat(20)}${'-'.repeat(n - 20)}1${')'.repeat(20)}`,
    ],
  ])('reads %s nested 40 deep and refuses 41', (_kind, nest) => {
    expect(errorOf(nest(40))).toBe('compiled');
    expect(errorOf(nest(41))).toBe('formula is nested too deeply');
  });
});
