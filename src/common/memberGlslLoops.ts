/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { skipSpace, statementEnd, type ISourceIndex } from './memberGlslSource';

/**
 * A member's loops as the scene rules read them (`memberSceneRules.ts`):
 * the only loop is a `for` with constant bounds and a counter the body can
 * never change, because GLSL ES 3.00 lets a loop change its own counter and
 * run to a variable, and a loop that slips past these holds the GPU until
 * Windows resets the driver for every program on the machine.
 */

export const MAX_MEMBER_LOOP_ITERATIONS = 128;
/**
 * A decimal integer as GLSL reads it. A leading zero makes a literal octal
 * there: `01000000000` is 134217728 turns to the compiler and, read with
 * `Number`, a billion here. Hex and `u` suffixes are not constants at all.
 */
const DECIMAL = /^-?(?:0|[1-9]\d*)$/;
/** The range of a GLSL `int`; a counter that leaves it wraps and never ends. */
const INT_MIN = -2147483648;
const INT_MAX = 2147483647;
const isInt = (value: number) =>
  Number.isSafeInteger(value) && value >= INT_MIN && value <= INT_MAX;

/**
 * A loop bound's value, when the name can only mean one constant: declared
 * as an `int` once in the whole source, and that once a `const int` literal.
 * Read as whichever `const int` came last, a `const int N = 1` in one
 * function hid the hundred million a loop in another actually ran to; and a
 * runtime `int N`, or a parameter named `N`, is not a constant at all.
 */
const constantValue = (source: ISourceIndex, name: string) => {
  const values = source.constants.get(name) ?? [];
  return values.length === 1 && source.ints.get(name) === 1
    ? values[0]
    : undefined;
};

const readInt = (source: ISourceIndex, token: string) => {
  const value = DECIMAL.test(token)
    ? Number(token)
    : constantValue(source, token);
  return value !== undefined && isInt(value) ? value : undefined;
};

/** How far one turn moves the counter, or undefined for anything else. */
const readStep = (
  source: ISourceIndex,
  step: string,
  counter: string,
): number | undefined => {
  const compact = step.replace(/\s+/g, '');
  if (compact === `${counter}++` || compact === `++${counter}`) {
    return 1;
  }
  if (compact === `${counter}--` || compact === `--${counter}`) {
    return -1;
  }
  const by = compact.match(/^([A-Za-z_]\w*)([+-])=(-?\w+)$/);
  if (!by || by[1] !== counter) {
    return undefined;
  }
  const size = readInt(source, by[3]);
  if (size === undefined) {
    return undefined;
  }
  return by[2] === '+' ? size : -size;
};

const turns = (start: number, end: number, test: string, step: number) => {
  if (test === '<') {
    return end > start ? Math.ceil((end - start) / step) : 0;
  }
  if (test === '<=') {
    return end >= start ? Math.floor((end - start) / step) + 1 : 0;
  }
  if (test === '>') {
    return start > end ? Math.ceil((start - end) / -step) : 0;
  }
  return start >= end ? Math.floor((start - end) / -step) + 1 : 0;
};

export interface ILoop {
  counter: string;
  turns: number;
  /** Where its body starts, and one past where it ends. */
  from: number;
  to: number;
}

/**
 * The step is taken whole, to the end, rather than trimmed by the pattern.
 *
 * It used to end `;\s*(.*?)\s*$`, and a lazy group followed by optional
 * whitespace backtracks once per space: `for (int i=0;i<4;i++` and a quarter
 * of a million spaces took twenty-three seconds of one frozen main process to
 * refuse — on every save in the open project, from a file that "came from
 * wherever their AI or a forum post put it". `readStep` takes the whitespace
 * out of what it is handed anyway, so the pattern never needed to.
 */
const FOR_HEADER =
  /^\s*int\s+([A-Za-z_]\w*)\s*=\s*(-?\w+)\s*;\s*([A-Za-z_]\w*)\s*(<=|<|>=|>)\s*(-?\w+)\s*;([\s\S]*)$/;

/** The loop whose `for` is at `at`, or the rule its header breaks. */
export const readLoop = (
  source: ISourceIndex,
  at: number,
): ILoop | 'loop-shape' | 'loop-bound' => {
  const { code, parens } = source;
  const open = skipSpace(code, at + 3);
  const close = code[open] === '(' ? parens[open] : -1;
  if (close < 0) {
    return 'loop-shape';
  }
  const header = code.slice(open + 1, close).match(FOR_HEADER);
  if (!header) {
    return 'loop-shape';
  }
  const [, counter, from, tested, test, to, stepText] = header;
  const start = readInt(source, from);
  const end = readInt(source, to);
  const step = readStep(source, stepText, counter);
  if (
    tested !== counter ||
    start === undefined ||
    end === undefined ||
    step === undefined ||
    step === 0 ||
    ((test === '<' || test === '<=') && step < 0) ||
    ((test === '>' || test === '>=') && step > 0)
  ) {
    return 'loop-shape';
  }
  const count = turns(start, end, test, step);
  if (count > MAX_MEMBER_LOOP_ITERATIONS) {
    return 'loop-bound';
  }
  // Where the counter stands once the test fails must still be an `int`:
  // from 2147483640 while `i <= 2147483647`, eight turns on paper, the ninth
  // wraps to the most negative int and the test never fails again.
  if (!isInt(start + count * step)) {
    return 'loop-bound';
  }
  const last = statementEnd(source, close + 1);
  if (last < 0) {
    return 'loop-shape';
  }
  return { counter, turns: count, from: close + 1, to: last + 1 };
};

/** A call's arguments, split at the commas that belong to it. */
const splitArguments = (text: string): string[] => {
  const parts: string[] = [];
  let depth = 0;
  let start = 0;
  for (let k = 0; k < text.length; k += 1) {
    const char = text[k];
    if (char === '(' || char === '[') {
      depth += 1;
    } else if (char === ')' || char === ']') {
      depth -= 1;
    } else if (char === ',' && depth === 0) {
      parts.push(text.slice(start, k));
      start = k + 1;
    }
  }
  parts.push(text.slice(start));
  return parts;
};

/**
 * Functions with a parameter they write back to their caller: every name
 * followed by a bracket whose partner closes a list naming `out` or `inout`.
 * Found by a pattern that stopped at the first bracket inside the list,
 * `void reset(inout int c, float q[(2)])` was not a writer, and handing it
 * the counter reset the loop unnoticed — and on a long enough name the
 * pattern held the main process for a second besides.
 */
export const writersIn = (code: string, parens: Int32Array): Set<string> => {
  // How many `out`/`inout` words start before each position, counted once so
  // that asking whether a parenthesised list holds one is two reads.
  //
  // This used to slice the list out and test it, which re-reads the same text
  // once for every identifier around it — so calls nested inside calls made
  // it quadratic. A 256 KB source of `a(a(a(...)))`, breaking no rule and so
  // signable and publishable, took 1.8 seconds of one frozen main process per
  // check; the check runs again on every read of an installed scene, and
  // listing the looks reads every one of them. The same prefix count the
  // pixel-work budget already uses (`operationsBefore`).
  const marks = new Int32Array(code.length + 1);
  const names: { name: string; end: number }[] = [];
  const word = /[A-Za-z_]\w*/g;
  let found = word.exec(code);
  while (found) {
    names.push({ name: found[0], end: found.index + found[0].length });
    if (found[0] === 'out' || found[0] === 'inout') {
      marks[found.index + 1] += 1;
    }
    found = word.exec(code);
  }
  for (let k = 0; k < code.length; k += 1) {
    marks[k + 1] += marks[k];
  }
  const writers = new Set<string>();
  names.forEach(({ name, end }) => {
    const open = skipSpace(code, end);
    const close = code[open] === '(' ? parens[open] : -1;
    if (close > open && marks[close] - marks[open + 1] > 0) {
      writers.add(name);
    }
  });
  return writers;
};

/**
 * Whether the body can change the loop's counter, and so run it forever.
 * Every assignment counts — `&=`, `|=`, `^=`, `<<=` and `>>=` too, and
 * through parentheses, `(i) = 0` — and so does handing the counter to a
 * function that writes back through an `out` or `inout` parameter.
 */
export const changesCounter = (
  source: ISourceIndex,
  loop: ILoop,
  writers: ReadonlySet<string>,
): boolean => {
  const { code, parens } = source;
  const body = code.slice(loop.from, loop.to);
  const name = loop.counter;
  const written = new RegExp(
    `\\b${name}(?:\\s*\\))*\\s*(?:(?:[-+*/%&|^]|<<|>>)?=(?!=)|\\+\\+|--)|(?:\\+\\+|--)(?:\\s*\\()*\\s*${name}\\b`,
  );
  if (written.test(body)) {
    return true;
  }
  const call = /[A-Za-z_]\w*/g;
  let found = call.exec(body);
  while (found) {
    const paren = loop.from + skipSpace(body, found.index + found[0].length);
    if (writers.has(found[0]) && code[paren] === '(') {
      const close = parens[paren];
      if (
        close < 0 ||
        splitArguments(code.slice(paren + 1, close)).some(
          (argument) => argument.replace(/[\s()]/g, '') === name,
        )
      ) {
        return true;
      }
    }
    found = call.exec(body);
  }
  return false;
};
