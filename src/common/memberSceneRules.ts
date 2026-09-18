/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU General Public License as published by
the Free Software Foundation, either version 3 of the License, or
(at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
GNU General Public License for more details.

You should have received a copy of the GNU General Public License
along with this program.  If not, see <https://www.gnu.org/licenses/>.
*/

/**
 * The rules a member's scene must keep, on top of the ones every scene pack
 * keeps (see `scenePacks.ts`).
 *
 * Official scenes are read by a person before they are signed; members' are
 * not, so their source is held to rules that make two things impossible
 * rather than unlikely. A preprocessor line could `#define main` away and
 * replace the wrapper the app puts around every scene — and with it the fade
 * and every guard in it — so no `#` may appear outside a comment. A loop could
 * run long enough to reset the graphics driver, so the only loop is a `for`
 * with constant bounds, at most 128 turns, whose counter the body can never
 * change, and all the loops and calls one pixel runs stay inside a budget.
 * Every one of the thirty official scenes already keeps these rules.
 *
 * GLSL ES 3.00 allows a loop to change its own counter and to run to a
 * variable, so these rules are the only thing that ends a member's loop: a
 * scene that slips past them holds the GPU until Windows resets the driver,
 * for every program on the machine, and five resets in a minute stop Windows.
 * Each rule is written against the way around it that was found.
 *
 * NO IMPORTS, on purpose: the signing function vendors this file into Deno
 * as it is, and the checks must be the same bytes on both sides. That is also
 * why it is one file past the usual length: a second file would be an import.
 */

/**
 * A quarter of a megabyte of source, not the 64 KB this was. Measured, the
 * old number bought nothing: the same scene at 51 KB and at 64 KB compiled in
 * 11.32 s and 11.29 s, while the seven call sites inside it were ten of those
 * seconds — a driver compiles a fresh copy of a function at each call site.
 * See `MAX_SHADER_BYTES`. What a scene costs is held below, by the loop
 * bounds and the pixel-work budget, which measure the work itself.
 */
export const MAX_MEMBER_SOURCE_BYTES = 256 * 1024;
export const MAX_MEMBER_LOOP_ITERATIONS = 128;
/**
 * The work one pixel may do: every loop turn, and every call of the scene's
 * own functions, counted from `sceneColour` down — nested loops multiply, and
 * a helper called in a loop costs its own work on every turn.
 *
 * A cap on each loop alone let three nested 128-turn loops run two million
 * turns a pixel, two trillion on a 1920x1080 picture: minutes of GPU time,
 * where Windows resets the driver after two seconds. This cuts that to a
 * ceiling a scene cannot argue with.
 *
 * A unit is about one noise turn: a turn and every call cost one, and each
 * span's own arithmetic, tests and built-in calls one per
 * OPERATIONS_PER_UNIT besides. Counted that way on 2026-09-13, the heaviest
 * of the 77 official scenes and Studio projects on this machine (Coral as a
 * member gets it in the Studio, with its helpers) does 8579, and every one
 * of them passes.
 *
 * WHAT THIS NUMBER DOES NOT DO, measured on 2026-09-17 and written here
 * because it used to claim the opposite. It said this budget keeps a whole
 * 1920x1080 frame under two seconds on the slowest GPU. It does not. Timed on
 * this machine's integrated chip, the heaviest thing these rules accept — one
 * 128-turn loop holding 104 texture fetches, each reading an address the last
 * one returned, 13,312 a pixel — comes to 3.74 seconds for one 1920x1080
 * frame. Nothing built of arithmetic gets near it: the same loop full of sums
 * runs out of MAX_MEMBER_SOURCE_BYTES first, at 0.27 s, and one doing almost
 * nothing per turn at 0.54 s.
 *
 * Nor can the number be shaved until it does. A static count says what a
 * source COULD run and a GPU runs what its branches allow, and the gap is
 * enormous in both directions: Coral is charged 8,579 units, over half this
 * ceiling, and actually draws a 1920x1080 frame in 63 ms — a sixtieth of what
 * the budget thinks it is buying. Weighing a sampler at two instead of one
 * refuses Coral AND still leaves 2.05 s on the table; three, four, six and
 * eight all refuse Coral too. There is no pair of numbers here that admits
 * the scenes Ivan has already made and refuses this shape.
 *
 * So this is a cheap first filter — it costs the signing server nothing and
 * it turns away the obvious — and it is NOT what keeps somebody's driver
 * alive. That is done where the work actually happens, by measurement rather
 * than by counting: a member's scene on the graph starts at the smallest
 * picture the listener allows and climbs only after twelve smooth frames,
 * never more than four times the pixels it has already drawn
 * (`sceneWarmup.ts`); a kept picture is timed small, extrapolated, refused
 * over thirty seconds and otherwise drawn in bands no longer than a
 * quarter-second each (`sceneStill.worker.ts`); and a scene whose frame held
 * the GPU past half a second when the context went is blamed for it and never
 * loaded again. Do not weaken any of those on the strength of this number.
 *
 * Two corrections to what that paragraph said when it was written, both from
 * reading the code rather than trusting it. The climb does NOT start at an
 * eighth of the panel: it starts at the listener's floor, 0.35 by default
 * since 2026-09-16, so the worst shape here submits a first frame of about
 * 1.8 seconds on a 4K panel rather than a tenth of that — inside Windows' two
 * only on the GPU it was measured on. And the climb's judgement of "smooth"
 * was, until `judgedIntervalMs` (`frameCadence.ts`), made against the gap
 * between the frames the scene itself paced, so it read smooth at any cost
 * and climbed to full size regardless. The bound above is only as good as
 * that judgement.
 */
export const MAX_MEMBER_PIXEL_WORK = 16384;

export type TMemberRuleCode =
  | 'too-large'
  | 'unterminated-comment'
  | 'preprocessor'
  | 'non-ascii'
  | 'while'
  | 'do'
  | 'main'
  | 'loop-shape'
  | 'loop-bound'
  | 'loop-assign'
  | 'loop-budget'
  | 'entry-point';

export interface IMemberRuleViolation {
  code: TMemberRuleCode;
  /** One-based, in the author's own file. */
  line: number;
}

const ENTRY_POINT = /\bvec4\s+sceneColour\s*\(\s*vec2\s+\w+\s*\)/;
const IDENTIFIER = /[A-Za-z_][A-Za-z0-9_]*/g;
/**
 * A decimal integer as GLSL reads it. A leading zero makes a literal octal
 * there: `01000000000` is 134217728 turns to the compiler and, read with
 * `Number`, a billion here. Hex and `u` suffixes are not constants at all.
 */
const DECIMAL = /^-?(?:0|[1-9]\d*)$/;
const CONST_INT =
  /\bconst\s+int\s+([A-Za-z_]\w*)\s*=\s*(-?(?:0|[1-9]\d*))\s*;/g;
/** The range of a GLSL `int`; a counter that leaves it wraps and never ends. */
const INT_MIN = -2147483648;
const INT_MAX = 2147483647;
const isInt = (value: number) =>
  Number.isSafeInteger(value) && value >= INT_MIN && value <= INT_MAX;

/**
 * Comments replaced by spaces, newlines kept — so a line number found in the
 * result is the line the author sees. `null` for a block comment that never
 * closes, which a compiler would read as the rest of the file.
 */
export const blankGlslComments = (source: string): string | null => {
  const out: string[] = [];
  let at = 0;
  while (at < source.length) {
    const pair = source.slice(at, at + 2);
    if (pair === '//') {
      // A carriage return ends a line comment for the compiler too: ended
      // only at a newline, `// x` + CR + `while (true) {}` hid a loop from
      // every rule below while the compiler read it.
      while (at < source.length && source[at] !== '\n' && source[at] !== '\r') {
        out.push(' ');
        at += 1;
      }
    } else if (pair === '/*') {
      const end = source.indexOf('*/', at + 2);
      if (end < 0) {
        return null;
      }
      for (let k = at; k < end + 2; k += 1) {
        out.push(source[k] === '\n' ? '\n' : ' ');
      }
      at = end + 2;
    } else {
      out.push(source[at]);
      at += 1;
    }
  }
  return out.join('');
};

/*
 * A `stripGlslComments` used to sit here, and its comment said a shared scene
 * carried its source with every comment gone — comments being the only free
 * text a scene has, and a shared scene being read by other people's AIs as
 * often as by their GPUs. NOTHING EVER CALLED IT. It was written, tested and
 * never wired to the signing it named, so the protection it described has
 * never existed and the file claimed it for a fortnight.
 *
 * Taken out rather than wired in, because wiring it in is not this file's
 * call: it would drop every author's comments out of what they publish, which
 * is their work and is visible to them. And it would not be a defence anyway —
 * the brief an author's agent reads is the author's own to edit, so it is not
 * a boundary, and a member's scene does not become another member's project
 * (`memberSharing.ts` brings a foreign scene in as a look). Worth doing as
 * hygiene if somebody decides the authors will not mind; not worth a comment
 * describing a guard that is not there.
 */

/** Where each line starts, so finding a line is a search, not a rescan. */
const lineStarts = (text: string): number[] => {
  const starts = [0];
  for (let k = 0; k < text.length; k += 1) {
    if (text.charCodeAt(k) === 10) {
      starts.push(k + 1);
    }
  }
  return starts;
};

const lineOf = (starts: readonly number[], index: number): number => {
  let low = 0;
  let high = starts.length - 1;
  while (low < high) {
    const middle = Math.ceil((low + high) / 2);
    if (starts[middle] <= index) {
      low = middle;
    } else {
      high = middle - 1;
    }
  }
  return low + 1;
};

/**
 * Every bracket of one kind paired with its partner, -1 for one with none,
 * in a single pass. Found by scanning forward from each opening instead, a
 * source of twelve thousand unclosed `for (` held the main process for a
 * second before it was refused.
 */
const bracketPartners = (
  text: string,
  left: string,
  right: string,
): Int32Array => {
  const partners = new Int32Array(text.length).fill(-1);
  const open: number[] = [];
  for (let k = 0; k < text.length; k += 1) {
    if (text[k] === left) {
      open.push(k);
    } else if (text[k] === right) {
      const start = open.pop();
      if (start !== undefined) {
        partners[start] = k;
        partners[k] = start;
      }
    }
  }
  return partners;
};

interface ISourceIndex {
  /** The source with its comments blanked. */
  code: string;
  parens: Int32Array;
  braces: Int32Array;
  /** Each `const int` literal's values, by name. */
  constants: Map<string, number[]>;
  /** How many declarations of any kind make each name an `int`. */
  ints: Map<string, number>;
}

const WORD = /[A-Za-z_]\w*/y;

const wordAt = (code: string, at: number): string | undefined => {
  WORD.lastIndex = at;
  return WORD.exec(code)?.[0];
};

const skipSpace = (code: string, from: number): number => {
  let at = from;
  while (at < code.length && /\s/.test(code[at])) {
    at += 1;
  }
  return at;
};

/** Whether an `int` keyword that declares — not an `int(...)` conversion — starts at `at`. */
const declaringIntAt = (code: string, at: number): boolean =>
  code.startsWith('int', at) &&
  !/\w/.test(code[at - 1] ?? '') &&
  !/\w/.test(code[at + 3] ?? '') &&
  code[skipSpace(code, at + 3)] !== '(';

/**
 * Every name an `int` declaration introduces — variables, constants,
 * parameters, each name in a list — counted. One walk per `int`, over its
 * declarators only; `int(` is a conversion and declares nothing.
 *
 * A walk also ends at the next declaring `int`, which no declarator can
 * contain outside brackets: sixteen thousand `int ` with nothing between
 * walked every one to the end of the file, and held the main process for six
 * seconds. An `int(` conversion inside a declarator does not end it, or
 * `int a = int(x), N = 1000000000;` would hide the second `N`.
 */
const intDeclarations = (code: string, parens: Int32Array) => {
  const counts = new Map<string, number>();
  const count = (from: number, to: number) => {
    const name = code.slice(from, to).match(/[A-Za-z_]\w*/)?.[0];
    if (name) {
      counts.set(name, (counts.get(name) ?? 0) + 1);
    }
  };
  const keyword = /\bint\b/g;
  let found = keyword.exec(code);
  while (found) {
    let k = skipSpace(code, found.index + 3);
    // A walk ends where the declaration does, or where the next `int` in a
    // parameter list starts its own: each `int` is walked once.
    let part = code[k] === '(' ? -1 : k;
    while (part >= 0 && k < code.length && !';){}'.includes(code[k])) {
      if (k > part && code[k] === 'i' && declaringIntAt(code, k)) {
        break;
      }
      if (code[k] === '(') {
        k = parens[k] < 0 ? code.length : parens[k] + 1;
      } else if (code[k] === ',') {
        count(part, k);
        part = wordAt(code, skipSpace(code, k + 1)) === 'int' ? -1 : k + 1;
        k += 1;
      } else {
        k += 1;
      }
    }
    if (part >= 0) {
      count(part, k);
    }
    found = keyword.exec(code);
  }
  return counts;
};

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

/** The semicolon ending a statement with no body of its own, or -1. */
const simpleEnd = (source: ISourceIndex, from: number): number => {
  const { code, parens } = source;
  let k = from;
  while (k < code.length) {
    const char = code[k];
    if (char === ';') {
      return k;
    }
    if (char === '(') {
      if (parens[k] < 0) {
        return -1;
      }
      k = parens[k] + 1;
    } else if (char === ')' || char === '{' || char === '}') {
      return -1;
    } else {
      k += 1;
    }
  }
  return -1;
};

/** Deeper than any scene is written; past it a statement is not read. */
const MAX_STATEMENT_NESTING = 256;

/**
 * The index of the last character of the statement starting at `from`, or
 * -1. Follows the statement's own shape: a block, an `if` and its `else`, a
 * `for`, `while` or `switch` and what they govern. Ended at its first
 * semicolon, `for (...) if (hit) a; else { i = 0; }` had a body of `if (hit)
 * a;`, and the `else` that reset the counter was never read as the loop's.
 */
const statementEnd = (source: ISourceIndex, from: number): number => {
  const { code, parens, braces } = source;
  const governing: boolean[] = [];
  let at = from;
  for (let step = 0; step < MAX_STATEMENT_NESTING; step += 1) {
    at = skipSpace(code, at);
    const word = wordAt(code, at);
    if (
      word === 'if' ||
      word === 'for' ||
      word === 'while' ||
      word === 'switch'
    ) {
      const paren = skipSpace(code, at + word.length);
      const close = code[paren] === '(' ? parens[paren] : -1;
      if (close < 0) {
        return -1;
      }
      governing.push(word === 'if');
      at = close + 1;
    } else {
      const end = code[at] === '{' ? braces[at] : simpleEnd(source, at);
      if (end < 0) {
        return -1;
      }
      let resume = -1;
      while (governing.length > 0 && resume < 0) {
        if (governing.pop()) {
          const after = skipSpace(code, end + 1);
          if (wordAt(code, after) === 'else') {
            resume = after + 4;
          }
        }
      }
      if (resume < 0) {
        return end;
      }
      at = resume;
    }
  }
  return -1;
};

interface ILoop {
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
const readLoop = (
  source: ISourceIndex,
  at: number,
): ILoop | TMemberRuleCode => {
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
const writersIn = (code: string, parens: Int32Array): Set<string> => {
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
const changesCounter = (
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

/** A top-level `{`'s function name, when it opens a function's body. */
const functionNameBefore = (
  source: ISourceIndex,
  brace: number,
): string | undefined => {
  const { code, parens } = source;
  let at = brace - 1;
  while (at >= 0 && /\s/.test(code[at])) {
    at -= 1;
  }
  if (code[at] !== ')' || parens[at] < 0) {
    return undefined;
  }
  at = parens[at] - 1;
  while (at >= 0 && /\s/.test(code[at])) {
    at -= 1;
  }
  const end = at + 1;
  while (at >= 0 && /\w/.test(code[at])) {
    at -= 1;
  }
  const name = code.slice(at + 1, end);
  return /^[A-Za-z_]\w*$/.test(name) ? name : undefined;
};

/** Each function's bodies, as `[from, to)`; overloads keep one each. */
const functionBodies = (source: ISourceIndex) => {
  const { code, braces } = source;
  const bodies = new Map<string, Array<[number, number]>>();
  let at = code.indexOf('{');
  while (at >= 0 && braces[at] > at) {
    const name = functionNameBefore(source, at);
    if (name) {
      bodies.set(name, [...(bodies.get(name) ?? []), [at + 1, braces[at]]]);
    }
    at = code.indexOf('{', braces[at] + 1);
  }
  return bodies;
};

/** Deeper than any scene calls and nests; past it a pixel is over budget. */
const MAX_WORK_DEPTH = 64;

/** What a turn's own arithmetic, tests and calls are counted by. */
const OPERATION_MARKS = '+-*/%<>=!&|^?(';

/**
 * Operations worth one unit of work. Counted by turns and calls alone, a
 * loop of 128 by 127 turns with fifteen hundred statements in each turn
 * passed the budget at seventy million operations a pixel; weighing each
 * turn by what it does closes that without moving any scene written to be
 * looked at — see the measurement at MAX_MEMBER_PIXEL_WORK.
 */
const OPERATIONS_PER_UNIT = 32;

/**
 * What a sampler costs, in units, beyond the one bracket mark it already
 * contributes. A unit is about one turn of noise — arithmetic — and a fetch
 * from a texture is not arithmetic.
 *
 * Every call weighed the same before: a `texture()` cost what a `+` costs, a
 * thirty-second of a unit. So a scene could pass this budget and still hold
 * the GPU long enough to reset the driver, and one was built to prove it — a
 * single 128-turn loop with 369 copies of a fetch whose address comes from
 * the LAST fetch. Accepted, at 47,232 dependent fetches a pixel. A fetch that
 * waits on the one before it cannot be hoisted, cannot be coalesced and
 * cannot run alongside its neighbours.
 *
 * ONE, and samplers only, both measured rather than reasoned. Transcendentals
 * are heavier than arithmetic too and were in this list first; Coral — the
 * heaviest real scene, and the one `MAX_MEMBER_PIXEL_WORK` is calibrated on —
 * went over the budget at a weight of one for `sin`, and over it again at a
 * sampler weight of two. A rule that refuses a scene somebody already made is
 * worse than the approximation it replaces. One is what all 40 scenes in the
 * Studio folder pass at.
 *
 * It is an improvement and not a wall, and the difference is worth writing
 * down: the attack above is refused, and the same shape at a sixth of its
 * size — 7,680 dependent fetches a pixel — is still accepted. Closing that
 * needs a weight of two, which Coral does not survive. What that really says
 * is that the budget itself wants measuring again against a GPU rather than
 * shaving: Coral sits at half of it while fetching inside loops, so the two
 * numbers are arguing about the same scene. That measurement needs a GPU and
 * a stopwatch, and is not something this file can decide alone.
 */
const COSTLY_CALLS = new Map<string, number>([
  ['texture', 1],
  ['textureLod', 1],
  ['textureProj', 1],
  ['textureOffset', 1],
  ['textureGrad', 1],
  ['texelFetch', 1],
]);

/**
 * Where the work one pixel can do first goes past the budget, or undefined
 * when it never does.
 *
 * Counted from `sceneColour` down: a loop costs its turns times one more
 * than its body, a call one more than the function it calls, and every span
 * its own operations over OPERATIONS_PER_UNIT besides — a nested loop's
 * operations are its own, counted once per turn inside it. Sums stop just
 * past the budget, so a loop that never turns cannot multiply a body past
 * any number into NaN and hide the work around it.
 */
const overBudget = (
  source: ISourceIndex,
  loops: ReadonlyMap<number, ILoop>,
): number | undefined => {
  const { code } = source;
  const bodies = functionBodies(source);
  const ceiling = MAX_MEMBER_PIXEL_WORK + 1;
  const known = new Map<string, number>();
  const operationsBefore = new Uint32Array(code.length + 1);
  for (let k = 0; k < code.length; k += 1) {
    operationsBefore[k + 1] =
      operationsBefore[k] + (OPERATION_MARKS.includes(code[k]) ? 1 : 0);
  }
  const operationsIn = (from: number, to: number) =>
    operationsBefore[to] - operationsBefore[from];
  // What the samplers before each position come to, counted once in the same
  // shape as the operations above, so asking a span is two reads.
  const samplersBefore = new Uint32Array(code.length + 1);
  const samplerWord = /[A-Za-z_]\w*/g;
  let samplerFound = samplerWord.exec(code);
  while (samplerFound) {
    const weight = COSTLY_CALLS.get(samplerFound[0]);
    if (
      weight !== undefined &&
      code[skipSpace(code, samplerFound.index + samplerFound[0].length)] === '('
    ) {
      samplersBefore[samplerFound.index + 1] += weight;
    }
    samplerFound = samplerWord.exec(code);
  }
  for (let k = 0; k < code.length; k += 1) {
    samplersBefore[k + 1] += samplersBefore[k];
  }
  const samplersIn = (from: number, to: number) =>
    samplersBefore[to] - samplersBefore[from];
  let over: number | undefined;
  const add = (work: number, more: number, at: number) => {
    const sum = Math.min(work + more, ceiling);
    if (sum >= ceiling && over === undefined) {
      over = at;
    }
    return sum;
  };

  const workOf = (from: number, to: number, depth: number): number => {
    if (depth > MAX_WORK_DEPTH) {
      return add(0, ceiling, from);
    }
    let work = 0;
    let operations = operationsIn(from, to);
    let samplers = samplersIn(from, to);
    const word = /[A-Za-z_]\w*/g;
    word.lastIndex = from;
    let found = word.exec(code);
    while (found && found.index < to) {
      const name = found[0];
      const loop = name === 'for' ? loops.get(found.index) : undefined;
      if (loop) {
        const body = workOf(loop.from, loop.to, depth + 1);
        work = add(
          work,
          Math.min(loop.turns * (1 + body), ceiling),
          found.index,
        );
        operations -= operationsIn(loop.from, loop.to);
        samplers -= samplersIn(loop.from, loop.to);
        word.lastIndex = loop.to;
      } else if (
        bodies.has(name) &&
        code[skipSpace(code, found.index + name.length)] === '('
      ) {
        let called = known.get(name);
        if (called === undefined) {
          // Recursion is a compile error; counted as nothing, it ends here.
          known.set(name, 0);
          called = Math.max(
            0,
            ...(bodies.get(name) ?? []).map(([start, end]) =>
              workOf(start, end, depth + 1),
            ),
          );
          known.set(name, called);
        }
        work = add(work, 1 + called, found.index);
      }
      found = word.exec(code);
    }
    return add(work, operations / OPERATIONS_PER_UNIT + samplers, from);
  };

  const total = Math.max(
    0,
    ...(bodies.get('sceneColour') ?? []).map(([start, end]) =>
      workOf(start, end, 0),
    ),
  );
  return total >= ceiling ? (over ?? 0) : undefined;
};

/**
 * More loops than any scene has — the most in the 77 official scenes and
 * Studio projects measured on 2026-09-13 is 11 — and each one is more for
 * the compiler to link, which holds every other scene in the window while it
 * does. Past it the source is not read further.
 */
const MAX_MEMBER_LOOPS = 64;

/**
 * Every rule the source breaks, at most once each, in the order they appear.
 * Empty means the source may be handed to the compiler.
 *
 * One pass over the source, whatever is in it: every check that scanned
 * again from a match, or from the top of the file for its line, let a source
 * of the right twenty thousand tokens hold the main process for a second.
 */
export const checkMemberSceneSource = (
  source: string,
): IMemberRuleViolation[] => {
  const found = new Map<TMemberRuleCode, number>();

  if (new TextEncoder().encode(source).byteLength > MAX_MEMBER_SOURCE_BYTES) {
    // Refused whatever else it holds, so nothing else is read: every other
    // check is paced to a source of this size, not to what was sent.
    return [{ code: 'too-large', line: 1 }];
  }
  // A BACKSLASH IMMEDIATELY BEFORE A NEWLINE, ON THE RAW SOURCE, BEFORE
  // ANYTHING IS BLANKED. This is the one thing that makes this whole file
  // decorative, so it is refused first and on the bytes as they arrived.
  //
  // The compiler splices those two characters away BEFORE it reads comments.
  // So `*\` + newline + `/` is `*/` to the compiler and closes a block
  // comment there, while `blankGlslComments` below is still looking for the
  // first LITERAL `*/` further down — and blanks everything in between. The
  // checker and the compiler then read different programs, and everything in
  // the gap is invisible to every rule here at once: an unbounded loop, a
  // `while`, a `#define` that redefines the wrapper's own clamp and fade.
  // Measured: a scene hiding a two-billion-turn loop that way passed with no
  // violations at all.
  //
  // It cannot be caught after blanking, because by then the backslash has
  // been blanked away with the comment it was smuggled into. The legitimate
  // use inside a comment — a Windows path — has something after the
  // backslash, so nothing that reads sensibly is refused.
  //
  // EITHER line terminator, not a newline. This read `\r?\n` — a backslash
  // before a line feed, or before a carriage return AND a line feed — and a
  // LONE carriage return is neither. GLSL ES ends a line at "a carriage
  // return or a line feed", each on its own, and deletes a backslash before
  // either; so the whole bypass above was still open through one byte, and
  // measured open: a two-billion-turn loop, a `while`, a `#define`, a second
  // `main` and a loop resetting its own counter all passed with no violations
  // at all when the splice was written with a bare carriage return. The same
  // hole, found and closed twice, which is what a lookahead over a character
  // class rather than a sequence is worth here.
  // And the END of the source is a line terminator too, because the app puts
  // one there: `assembleFragmentSource` joins the member's text, a newline and
  // the wrapper that holds `main` and the clamp-and-fade. A source whose last
  // byte is a backslash therefore reaches the compiler as a backslash
  // immediately before a newline and splices, pulling the wrapper's first line
  // into whatever the source ended in. Today that is harmless by exactly one
  // character — the wrapper's own text opens with a newline, so the splice
  // eats an empty line — which is not a thing to leave standing between a
  // stranger's scene and the fade every scene is drawn through.
  const spliced = /\\(?=[\r\n]|$)/.exec(source);
  if (spliced) {
    found.set('preprocessor', lineOf(lineStarts(source), spliced.index));
    return [...found].map(([rule, line]) => ({ code: rule, line }));
  }
  const code = blankGlslComments(source);
  if (code === null) {
    found.set(
      'unterminated-comment',
      lineOf(lineStarts(source), source.lastIndexOf('/*')),
    );
    return [...found].map(([rule, line]) => ({ code: rule, line }));
  }
  const starts = lineStarts(code);
  const note = (rule: TMemberRuleCode, index: number) => {
    if (!found.has(rule)) {
      found.set(rule, lineOf(starts, index));
    }
  };

  for (let k = 0; k < code.length; k += 1) {
    const unit = code.charCodeAt(k);
    const printable = unit >= 32 && unit <= 126;
    if (!printable && unit !== 9 && unit !== 10 && unit !== 13) {
      note('non-ascii', k);
      break;
    }
  }
  const hash = code.indexOf('#');
  if (hash >= 0) {
    note('preprocessor', hash);
  }
  // A backslash before a newline joins two lines before the compiler reads
  // either: `whi` + backslash + newline + `le (true) {}` is a loop no rule
  // saw, because every rule read two words. No scene needs one outside a
  // comment, so none is allowed there.
  const backslash = code.indexOf('\\');
  if (backslash >= 0) {
    note('preprocessor', backslash);
  }

  const parens = bracketPartners(code, '(', ')');
  const index: ISourceIndex = {
    code,
    parens,
    braces: bracketPartners(code, '{', '}'),
    constants: new Map(),
    ints: intDeclarations(code, parens),
  };
  Array.from(code.matchAll(CONST_INT)).forEach(([, name, value]) => {
    index.constants.set(name, [
      ...(index.constants.get(name) ?? []),
      Number(value),
    ]);
  });
  const writers = writersIn(code, parens);
  const loops = new Map<number, ILoop>();
  let loopCount = 0;
  let loopsBroken = false;

  Array.from(code.matchAll(IDENTIFIER)).forEach((token) => {
    const word = token[0];
    const at = token.index ?? 0;
    if (word === 'while') {
      note('while', at);
    } else if (word === 'do') {
      note('do', at);
    } else if (word === 'main' && code[skipSpace(code, at + 4)] === '(') {
      note('main', at);
    } else if (word === 'for') {
      loopCount += 1;
      if (loopCount > MAX_MEMBER_LOOPS) {
        note('loop-budget', at);
        loopsBroken = true;
        return;
      }
      const loop = readLoop(index, at);
      if (typeof loop === 'string') {
        note(loop, at);
        loopsBroken = true;
      } else if (changesCounter(index, loop, writers)) {
        note('loop-assign', at);
        loopsBroken = true;
      } else {
        loops.set(at, loop);
      }
    }
  });

  if (!ENTRY_POINT.test(code)) {
    note('entry-point', 0);
  } else if (!loopsBroken) {
    const over = overBudget(index, loops);
    if (over !== undefined) {
      note('loop-budget', over);
    }
  }

  return [...found]
    .map(([rule, line]) => ({ code: rule, line }))
    .sort((a, b) => a.line - b.line);
};
