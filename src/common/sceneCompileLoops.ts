/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { skipSpace, statementEnd, wordAt } from './memberGlslSource';
import {
  assignedNames,
  charBefore,
  splitTopLevel,
  wordBefore,
  type IProgram,
} from './sceneCompileSource';

/**
 * How much work inside each loop is the same on every turn — work that could
 * be done once before the loop. Windows' shader compiler (FXC, which ANGLE
 * hands every scene to) is far slower on it than on work that changes with
 * the turn: measured on 2026-11-25, the same code took seven times as long to
 * compile left inside a loop as varying per turn, and Hanami's loops carried
 * about seventy such values (sky, moon, lantern light, sway, clocks) until
 * they moved into one function run before them. Many sat inside helpers the
 * loop calls — a sway's clock inside the sway — so a call's body is read too,
 * with its parameters as the only thing that changes.
 *
 * Judged conservatively, because a note that is wrong teaches an author to
 * ignore the notes: anything the loop writes, directly, through a call's
 * `out` parameter or through a global a called function writes, changes per
 * turn; so does whatever reads one of those, and every call to a function
 * with a side effect. Only what is left is counted.
 */

export interface ILoopWork {
  /** Where its `for` stands. */
  at: number;
  /** Its body, [from, to). */
  from: number;
  to: number;
  /** Tokens of work in the body that no turn changes, calls inlined. */
  invariant: number;
  /** Tokens of the whole body, calls inlined. */
  body: number;
}

/** A span's tokens with every call of the scene's own functions inlined. */
const inlined = (program: IProgram, owner: string, from: number, to: number) =>
  (program.callsIn.get(owner) ?? [])
    .filter((call) => call.at >= from && call.at < to)
    .reduce(
      (sum, call) => sum + program.weight(call.callee),
      program.tokens(from, to),
    );

/**
 * The least a piece can be and still be work: `0.3 + gWind` is three tokens.
 * Hanami's loops carried seventy of about that size, and together they were
 * what its steady() took out.
 */
const MIN_PIECE_TOKENS = 3;
/** Words in an expression that are not a value read from anywhere. */
const LITERAL_WORDS = new Set(['true', 'false']);
/** Deeper than any scene calls; past it a call's body is not read. */
const MAX_DEPTH = 16;
const SAMPLERS = new Set([
  'texture',
  'textureLod',
  'textureGrad',
  'textureOffset',
  'textureProj',
  'texelFetch',
]);
const CONTROL = new Set(['if', 'while', 'for', 'switch']);
const STOPS = new Set(['break', 'continue', 'discard']);
const DECLARATION =
  /^(?:(?:const|highp|mediump|lowp)\s+)*([A-Za-z_]\w*)\s+([A-Za-z_]\w*)\s*(?:\[[^\]]*\]\s*)?(?:=(?!=)|,|$)/;
const NOT_TYPES = new Set(['return', 'else', 'case', 'do']);
const WORDS = /[A-Za-z_]\w*/g;

/**
 * Characters the reading of one scene's loops may scan, all loops together.
 * A loop's expressions are read once per bracket they sit in, so a source of
 * twenty thousand nested calls inside a loop — one the scene rules accept —
 * would be read twenty thousand times over and hold the window for seconds
 * on every save. Every official scene reads its loops in under 250,000; past
 * this, the loops get no note rather than a late one.
 */
export const LOOP_SCAN_BUDGET = 4_000_000;

/** Thrown when the budget runs out, and caught by `loopWork` alone. */
class ScanBudgetSpent extends Error {}

interface IWalk {
  /** Pieces already counted in this loop, by where they start. */
  counted: Set<number>;
  /** What is left of the scene's budget, shared by every loop. */
  budget: { left: number };
}

/**
 * The work in [from, to) that does not depend on anything in `seed` — the
 * loop's counter, or a function's parameters — nor on anything written in
 * the span or by what it calls, nor on any name in `outer` (what the loop
 * around a called function changes).
 */
const invariantWork = (
  program: IProgram,
  owner: string,
  from: number,
  to: number,
  seed: ReadonlySet<string>,
  outer: ReadonlySet<string>,
  depth: number,
  walk: IWalk,
): number => {
  const { code, index, functions } = program;
  const spend = (characters: number) => {
    // eslint-disable-next-line no-param-reassign -- the budget is shared on purpose: every loop and helper draws on one total
    walk.budget.left -= characters;
    if (walk.budget.left < 0) {
      throw new ScanBudgetSpent();
    }
  };
  const ownerCalls = program.callsIn.get(owner) ?? [];
  spend(to - from + ownerCalls.length);
  const variant = new Set([...seed, ...outer]);
  assignedNames(code, from, to).forEach((name) => variant.add(name));
  const calls = ownerCalls.filter((call) => call.at >= from && call.at < to);
  calls.forEach((call) => {
    program.writes(call.callee).forEach((name) => variant.add(name));
    const fn = functions.get(call.callee);
    const end = index.parens[call.open];
    // Only a function that writes back through an argument needs its
    // arguments read; nested calls would read the same text once per level.
    if (!fn || end < 0 || !fn.params.some((param) => param.writes)) {
      return;
    }
    spend(end - call.open);
    splitTopLevel(code, call.open + 1, end).forEach(([start], k) => {
      const name = wordAt(code, skipSpace(code, start));
      if (fn.params[k]?.writes && name) {
        variant.add(name);
      }
    });
  });

  const impure = (name: string) => {
    const fn = functions.get(name);
    return (
      fn !== undefined &&
      (program.writes(name).size > 0 ||
        fn.params.some((param) => param.writes) ||
        [...program.reads(name)].some((global) => variant.has(global)))
    );
  };
  const isVariant = (start: number, end: number): boolean => {
    spend(end - start);
    WORDS.lastIndex = start;
    let found = WORDS.exec(code);
    while (found && found.index < end) {
      const name = found[0];
      // A field or a swizzle is its struct's, judged by the struct's name.
      if (charBefore(code, found.index) !== '.') {
        const called = code[skipSpace(code, found.index + name.length)] === '(';
        if (called ? impure(name) : variant.has(name)) {
          return true;
        }
      }
      found = WORDS.exec(code);
    }
    return false;
  };
  // Work, not a constant: a value read from somewhere, and something done to
  // it. `vec3(0.2, 0.3, 0.4)` and `1.0 / 2.2` fold away when compiled, and a
  // lone `gBass` is a read, not work.
  const weightOf = (start: number, end: number) => {
    spend(end - start);
    const tokens = program.tokens(start, end);
    let sum = tokens;
    let reads = false;
    WORDS.lastIndex = start;
    let found = WORDS.exec(code);
    while (found && found.index < end) {
      const name = found[0];
      if (code[skipSpace(code, found.index + name.length)] === '(') {
        if (functions.has(name)) {
          sum += program.weight(name);
          reads = true;
        } else if (SAMPLERS.has(name)) {
          reads = true;
        }
      } else if (
        charBefore(code, found.index) !== '.' &&
        !LITERAL_WORDS.has(name) &&
        !program.constants.has(name)
      ) {
        reads = true;
      }
      found = WORDS.exec(code);
    }
    return reads && tokens >= MIN_PIECE_TOKENS ? sum : 0;
  };
  // A helper called from several places in the loop holds the same piece at
  // each; it is counted once, where it is written.
  const once = (start: number, end: number) => {
    if (walk.counted.has(start)) {
      return 0;
    }
    walk.counted.add(start);
    return weightOf(start, end);
  };

  let invariant = 0;
  // A call that changes with the turn still runs its body every turn: what
  // in that body does not depend on its arguments is counted too.
  const intoCalls = (start: number, end: number) => {
    if (depth >= MAX_DEPTH) {
      return;
    }
    spend(calls.length);
    const within = calls.filter((call) => call.at >= start && call.at < end);
    if (within.length === 0) {
      return;
    }
    spend(program.globals.size);
    const changing = new Set(
      [...program.globals].filter((name) => variant.has(name)),
    );
    within.forEach((call) => {
      const fn = functions.get(call.callee);
      if (fn) {
        const params = new Set(fn.params.map((param) => param.name));
        invariant += invariantWork(
          program,
          fn.name,
          fn.from,
          fn.to,
          params,
          changing,
          depth + 1,
          walk,
        );
      }
    });
  };
  // The largest pieces of [start, end) that no turn changes.
  const count = (start: number, end: number) => {
    if (start >= end) {
      return;
    }
    if (!isVariant(start, end)) {
      invariant += once(start, end);
      return;
    }
    let k = start;
    let readFrom = start;
    while (k < end) {
      const close = code[k] === '(' ? index.parens[k] : -1;
      const name = close > k ? wordBefore(code, k) : undefined;
      const piece = name ? code.lastIndexOf(name, k) : k;
      if (
        close > k &&
        close < end &&
        piece >= start &&
        !isVariant(piece, close + 1)
      ) {
        intoCalls(readFrom, piece);
        invariant += once(piece, close + 1);
        k = close + 1;
        readFrom = k;
      } else {
        k += 1;
      }
    }
    intoCalls(readFrom, end);
  };
  const expression = (start: number, end: number) => {
    let level = 0;
    for (let k = start; k < end; k += 1) {
      const char = code[k];
      if (char === '(' || char === '[') {
        level += 1;
      } else if (char === ')' || char === ']') {
        level -= 1;
      } else if (level === 0 && char === '=' && code[k + 1] !== '=') {
        const before = code[k - 1];
        if (
          before !== '=' &&
          before !== '!' &&
          before !== '<' &&
          before !== '>'
        ) {
          count(k + 1, end);
          return;
        }
      }
    }
    count(start, end);
  };
  /** The declarators from the first name at `names` to `end`. */
  const declaration = (names: number, end: number) => {
    splitTopLevel(code, names, end).forEach(([part, stop]) => {
      const declared = wordAt(code, skipSpace(code, part));
      const equals = code.indexOf('=', part);
      if (equals > 0 && equals < stop) {
        count(equals + 1, stop);
        // What reads it later is judged by what it was made from.
        if (declared && isVariant(equals + 1, stop)) {
          variant.add(declared);
        }
      }
    });
  };
  const statement = (start: number, end: number) => {
    let s = skipSpace(code, start);
    for (let guard = 0; guard < 64 && s < end; guard += 1) {
      const word = wordAt(code, s);
      if (word && CONTROL.has(word)) {
        const paren = skipSpace(code, s + word.length);
        const shut = code[paren] === '(' ? index.parens[paren] : -1;
        if (shut < 0 || shut >= end) {
          return;
        }
        // A nested loop's header counts and steps; its body is read below.
        if (word !== 'for') {
          count(paren + 1, shut);
        }
        s = skipSpace(code, shut + 1);
      } else if (word === 'else' || word === 'do') {
        s = skipSpace(code, s + word.length);
      } else if (word === 'return') {
        count(s + word.length, end);
        return;
      } else if (word && STOPS.has(word)) {
        return;
      } else {
        const declared = DECLARATION.exec(code.slice(s, end));
        if (declared && !NOT_TYPES.has(declared[1])) {
          // The first name stands after the type: `float f` searched for
          // "f" from the start found the f of "float".
          const type = s + declared[0].indexOf(declared[1]);
          declaration(
            code.indexOf(declared[2], type + declared[1].length),
            end,
          );
        } else {
          expression(s, end);
        }
        return;
      }
    }
  };

  let level = 0;
  let start = from;
  for (let k = from; k < to; k += 1) {
    const char = code[k];
    if (char === '(' || char === '[') {
      level += 1;
    } else if (char === ')' || char === ']') {
      level -= 1;
    } else if (level === 0 && (char === ';' || char === '{' || char === '}')) {
      statement(start, k);
      start = k + 1;
    }
  }
  statement(start, to);
  return invariant;
};

/**
 * Every loop in the scene's functions, with the work no turn changes; none
 * at all when reading them would take more than LOOP_SCAN_BUDGET.
 */
const loopWork = (program: IProgram): ILoopWork[] => {
  try {
    return readLoops(program, { left: LOOP_SCAN_BUDGET });
  } catch (error) {
    if (error instanceof ScanBudgetSpent) {
      return [];
    }
    throw error;
  }
};

const readLoops = (program: IProgram, budget: IWalk['budget']): ILoopWork[] => {
  const { code, index } = program;
  const found: ILoopWork[] = [];
  program.functions.forEach((fn) => {
    const keyword = /\bfor\b/g;
    keyword.lastIndex = fn.from;
    let match = keyword.exec(code);
    while (match && match.index < fn.to) {
      const open = skipSpace(code, match.index + 3);
      const close = code[open] === '(' ? index.parens[open] : -1;
      const last = close > 0 ? statementEnd(index, close + 1) : -1;
      if (last > close && last < fn.to) {
        const seed = assignedNames(code, open + 1, close);
        const counter =
          /^\s*(?:(?:highp|mediump|lowp)\s+)?int\s+([A-Za-z_]\w*)/.exec(
            code.slice(open + 1, close),
          );
        if (counter) {
          seed.add(counter[1]);
        }
        found.push({
          at: match.index,
          from: close + 1,
          to: last + 1,
          body: inlined(program, fn.name, close + 1, last + 1),
          invariant: invariantWork(
            program,
            fn.name,
            close + 1,
            last + 1,
            seed,
            new Set(),
            0,
            { counted: new Set(), budget },
          ),
        });
      }
      match = keyword.exec(code);
    }
  });
  return found;
};

export default loopWork;
