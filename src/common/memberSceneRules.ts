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
 * with constant bounds, at most 128 turns, whose counter the body never
 * touches. Every one of the thirty official scenes already keeps these rules.
 *
 * NO IMPORTS, on purpose: the signing function vendors this file into Deno
 * as it is, and the checks must be the same bytes on both sides.
 */

export const MAX_MEMBER_SOURCE_BYTES = 64 * 1024;
export const MAX_MEMBER_LOOP_ITERATIONS = 128;

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
  | 'entry-point';

export interface IMemberRuleViolation {
  code: TMemberRuleCode;
  /** One-based, in the author's own file. */
  line: number;
}

const ENTRY_POINT = /\bvec4\s+sceneColour\s*\(\s*vec2\s+\w+\s*\)/;
const IDENTIFIER = /[A-Za-z_][A-Za-z0-9_]*/g;
const CONST_INT = /\bconst\s+int\s+([A-Za-z_]\w*)\s*=\s*(-?\d+)\s*;/g;
const FOR_HEADER =
  /^\s*int\s+([A-Za-z_]\w*)\s*=\s*(-?\w+)\s*;\s*([A-Za-z_]\w*)\s*(<=|<|>=|>)\s*(-?\w+)\s*;\s*(.*?)\s*$/s;

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
      while (at < source.length && source[at] !== '\n') {
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

const lineAt = (text: string, index: number): number => {
  let line = 1;
  for (let k = 0; k < index; k += 1) {
    if (text.charCodeAt(k) === 10) {
      line += 1;
    }
  }
  return line;
};

/** The index of the bracket that closes the one at `open`, or -1. */
const matching = (text: string, open: number, left: string, right: string) => {
  let depth = 0;
  for (let k = open; k < text.length; k += 1) {
    if (text[k] === left) {
      depth += 1;
    } else if (text[k] === right) {
      depth -= 1;
      if (depth === 0) {
        return k;
      }
    }
  }
  return -1;
};

const readInt = (token: string, constants: Map<string, number>) => {
  if (/^-?\d+$/.test(token)) {
    return Number(token);
  }
  return constants.get(token);
};

/** How far one turn moves the counter, or undefined for anything else. */
const readStep = (
  step: string,
  counter: string,
  constants: Map<string, number>,
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
  const size = readInt(by[3], constants);
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

/** Where a loop's body ends: its closing brace, or the end of one statement. */
const bodyEnd = (code: string, from: number): number => {
  let at = from;
  while (at < code.length && /\s/.test(code[at])) {
    at += 1;
  }
  if (code[at] === '{') {
    return matching(code, at, '{', '}');
  }
  let depth = 0;
  for (let k = at; k < code.length; k += 1) {
    if (code[k] === '(') {
      depth += 1;
    } else if (code[k] === ')') {
      depth -= 1;
    } else if (code[k] === ';' && depth === 0) {
      return k;
    }
  }
  return -1;
};

type TLoopFinding = TMemberRuleCode | undefined;

const checkLoop = (
  code: string,
  open: number,
  constants: Map<string, number>,
): TLoopFinding => {
  const close = matching(code, open, '(', ')');
  if (close < 0) {
    return 'loop-shape';
  }
  const header = code.slice(open + 1, close).match(FOR_HEADER);
  if (!header) {
    return 'loop-shape';
  }
  const [, counter, from, tested, test, to, stepText] = header;
  const start = readInt(from, constants);
  const end = readInt(to, constants);
  const step = readStep(stepText, counter, constants);
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
  if (turns(start, end, test, step) > MAX_MEMBER_LOOP_ITERATIONS) {
    return 'loop-bound';
  }
  const last = bodyEnd(code, close + 1);
  if (last < 0) {
    return 'loop-shape';
  }
  const body = code.slice(close + 1, last + 1);
  const assigned = new RegExp(
    `\\b${counter}\\s*(?:[-+*/%]?=(?!=)|\\+\\+|--)|(?:\\+\\+|--)\\s*${counter}\\b`,
  );
  return assigned.test(body) ? 'loop-assign' : undefined;
};

/**
 * Every rule the source breaks, at most once each, in the order they appear.
 * Empty means the source may be handed to the compiler.
 */
export const checkMemberSceneSource = (
  source: string,
): IMemberRuleViolation[] => {
  const found = new Map<TMemberRuleCode, number>();
  const note = (code: TMemberRuleCode, line: number) => {
    if (!found.has(code)) {
      found.set(code, line);
    }
  };

  if (new TextEncoder().encode(source).byteLength > MAX_MEMBER_SOURCE_BYTES) {
    note('too-large', 1);
  }
  const code = blankGlslComments(source);
  if (code === null) {
    note('unterminated-comment', lineAt(source, source.lastIndexOf('/*')));
    return [...found].map(([rule, line]) => ({ code: rule, line }));
  }

  for (let k = 0; k < code.length; k += 1) {
    const unit = code.charCodeAt(k);
    const printable = unit >= 32 && unit <= 126;
    if (!printable && unit !== 9 && unit !== 10 && unit !== 13) {
      note('non-ascii', lineAt(code, k));
      break;
    }
  }
  const hash = code.indexOf('#');
  if (hash >= 0) {
    note('preprocessor', lineAt(code, hash));
  }

  const constants = new Map<string, number>();
  Array.from(code.matchAll(CONST_INT)).forEach(([, name, value]) => {
    constants.set(name, Number(value));
  });

  Array.from(code.matchAll(IDENTIFIER)).forEach((token) => {
    const word = token[0];
    const index = token.index ?? 0;
    if (word === 'while') {
      note('while', lineAt(code, index));
    } else if (word === 'do') {
      note('do', lineAt(code, index));
    } else if (word === 'main' && /^\s*\(/.test(code.slice(index + 4))) {
      note('main', lineAt(code, index));
    } else if (word === 'for') {
      const open = code.indexOf('(', index);
      const between = code.slice(index + 3, open);
      const finding =
        open < 0 || between.trim() !== ''
          ? 'loop-shape'
          : checkLoop(code, open, constants);
      if (finding) {
        note(finding, lineAt(code, index));
      }
    }
  });

  if (!ENTRY_POINT.test(code)) {
    note('entry-point', 1);
  }

  return [...found]
    .map(([rule, line]) => ({ code: rule, line }))
    .sort((a, b) => a.line - b.line);
};
