/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * A member's GLSL as the scene rules read it (`memberSceneRules.ts`): its
 * comments blanked, its lines, its brackets paired, its words, the names its
 * `int` declarations introduce, where a statement ends and each function's
 * body. Every pass here is one pass: each was, at some point, a rescan that a
 * source of the right few thousand tokens turned into seconds of a frozen
 * main process.
 */

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
export const lineStarts = (text: string): number[] => {
  const starts = [0];
  for (let k = 0; k < text.length; k += 1) {
    if (text.charCodeAt(k) === 10) {
      starts.push(k + 1);
    }
  }
  return starts;
};

export const lineOf = (starts: readonly number[], index: number): number => {
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
export const bracketPartners = (
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

export interface ISourceIndex {
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

export const wordAt = (code: string, at: number): string | undefined => {
  WORD.lastIndex = at;
  return WORD.exec(code)?.[0];
};

export const skipSpace = (code: string, from: number): number => {
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
export const intDeclarations = (code: string, parens: Int32Array) => {
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
export const statementEnd = (source: ISourceIndex, from: number): number => {
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
export const functionBodies = (source: ISourceIndex) => {
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
