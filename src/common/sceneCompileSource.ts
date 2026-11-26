/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import {
  bracketPartners,
  functionBodies,
  skipSpace,
  type ISourceIndex,
} from './memberGlslSource';

/**
 * A scene's GLSL read the way the compile-time notes need it
 * (`sceneCompileNotes.ts`): its functions with their parameters, the
 * variables declared at file scope, who calls whom, what each function writes
 * and reads, and how big each one becomes once every call in it is inlined —
 * which is what a driver does before Windows' shader compiler sees it.
 *
 * Read from source the scene rules already accepted, so it never refuses
 * anything: what it cannot read it leaves out, and a note it is unsure of is
 * a note it does not give.
 */

export interface IParameter {
  name: string;
  /** `out` or `inout`: the caller's argument is written. */
  writes: boolean;
  /** Its type's name, as written. */
  type: string;
}

export interface IFunction {
  name: string;
  /** Where its body starts (after `{`) and where its `}` is. */
  from: number;
  to: number;
  /** Where its name stands in its definition, for the line a note names. */
  at: number;
  params: IParameter[];
}

export interface ICall {
  callee: string;
  /** Where the callee's name starts, and its `(`. */
  at: number;
  open: number;
}

export interface IProgram {
  code: string;
  index: ISourceIndex;
  functions: Map<string, IFunction>;
  /** Names declared at file scope that a function may write: no `const`, no `uniform`. */
  globals: Set<string>;
  /** Names declared `const` at file scope: values the compiler folds away. */
  constants: Set<string>;
  /** The type each file-scope name was declared with. */
  types: Map<string, string>;
  /** Every call of one of the scene's own functions, by the function it sits in. */
  callsIn: Map<string, ICall[]>;
  /** How many places in the source call each function. */
  sites: Map<string, number>;
  /** Tokens in [from, to): words, numbers and runs of operators. */
  tokens(from: number, to: number): number;
  /** A function's tokens with every call inside it inlined, recursively. */
  weight(name: string): number;
  /** Globals the function writes, itself or through what it calls. */
  writes(name: string): ReadonlySet<string>;
  /** Globals the function reads, itself or through what it calls. */
  reads(name: string): ReadonlySet<string>;
}

const TOKEN =
  /[A-Za-z_]\w*|\d+\.?\d*(?:[eE][-+]?\d+)?[uUfF]?|\.\d+|[-+*/%<>=!&|^?:~]+/g;
const WORD = /[A-Za-z_]\w*/g;
const QUALIFIERS = new Set(['highp', 'mediump', 'lowp', 'flat', 'smooth']);
const NOT_WRITABLE = new Set([
  'uniform',
  'const',
  'in',
  'out',
  'precision',
  'struct',
  'layout',
]);
/** Words that can stand before an assignment without declaring anything. */
const NOT_A_TYPE = new Set(['else', 'return', 'case', 'do']);
const ASSIGNMENT = /^(?:[-+*/%&|^]|<<|>>)?=(?!=)/;

/** The arguments of a call or a list, split at the commas that belong to it. */
export const splitTopLevel = (
  code: string,
  from: number,
  to: number,
): Array<[number, number]> => {
  const parts: Array<[number, number]> = [];
  let depth = 0;
  let start = from;
  for (let k = from; k < to; k += 1) {
    const char = code[k];
    if (char === '(' || char === '[' || char === '{') {
      depth += 1;
    } else if (char === ')' || char === ']' || char === '}') {
      depth -= 1;
    } else if (char === ',' && depth === 0) {
      parts.push([start, k]);
      start = k + 1;
    }
  }
  parts.push([start, to]);
  return parts;
};

/** The word that ends just before `at`, ignoring space, or undefined. */
export const wordBefore = (code: string, at: number): string | undefined => {
  let end = at - 1;
  while (end >= 0 && /\s/.test(code[end])) {
    end -= 1;
  }
  let start = end;
  while (start >= 0 && /\w/.test(code[start])) {
    start -= 1;
  }
  const word = code.slice(start + 1, end + 1);
  return /^[A-Za-z_]\w*$/.test(word) ? word : undefined;
};

/** The character before `at` that is not space, or ''. */
export const charBefore = (code: string, at: number): string => {
  let k = at - 1;
  while (k >= 0 && /\s/.test(code[k])) {
    k -= 1;
  }
  return k >= 0 ? code[k] : '';
};

/**
 * The names written in [from, to) by an assignment, `++` or `--` — the base
 * name of `a.x = ...` and `list[k] = ...` — leaving out a declaration's own
 * initialiser (`float a = ...`), which writes nothing that existed before.
 */
export const assignedNames = (
  code: string,
  from: number,
  to: number,
): Set<string> => {
  const names = new Set<string>();
  WORD.lastIndex = from;
  let found = WORD.exec(code);
  while (found && found.index < to) {
    const name = found[0];
    const at = found.index;
    if (charBefore(code, at) !== '.') {
      let k = skipSpace(code, at + name.length);
      // Past any `.field` and `[index]` to what is done to the whole.
      for (let guard = 0; guard < 64; guard += 1) {
        if (code[k] === '.') {
          WORD.lastIndex = skipSpace(code, k + 1);
          const field = WORD.exec(code);
          if (!field || field.index !== skipSpace(code, k + 1)) {
            break;
          }
          k = skipSpace(code, field.index + field[0].length);
        } else if (code[k] === '[') {
          const close = code.indexOf(']', k);
          if (close < 0) {
            break;
          }
          k = skipSpace(code, close + 1);
        } else {
          break;
        }
      }
      const after = code.slice(k, k + 3);
      const before = code.slice(Math.max(0, at - 2), at);
      const previous = wordBefore(code, at);
      const declared = previous !== undefined && !NOT_A_TYPE.has(previous);
      if (
        (ASSIGNMENT.test(after) && !declared) ||
        after.startsWith('++') ||
        after.startsWith('--') ||
        before === '++' ||
        before === '--'
      ) {
        names.add(name);
      }
    }
    WORD.lastIndex = Math.max(WORD.lastIndex, at + name.length);
    found = WORD.exec(code);
  }
  return names;
};

/** The parameter list of a function whose body opens at `brace`. */
const readHeader = (
  code: string,
  parens: Int32Array,
  brace: number,
): { at: number; params: IParameter[] } | undefined => {
  let close = brace - 1;
  while (close >= 0 && /\s/.test(code[close])) {
    close -= 1;
  }
  const open = code[close] === ')' ? parens[close] : -1;
  if (open < 0) {
    return undefined;
  }
  let at = open - 1;
  while (at >= 0 && /\s/.test(code[at])) {
    at -= 1;
  }
  while (at > 0 && /\w/.test(code[at - 1])) {
    at -= 1;
  }
  const params = splitTopLevel(code, open + 1, close).flatMap(
    ([start, end]): IParameter[] => {
      const words = code.slice(start, end).match(/[A-Za-z_]\w*/g) ?? [];
      const named = words.filter((word) => word !== 'void');
      if (named.length < 2) {
        return [];
      }
      return [
        {
          name: named[named.length - 1],
          type: named[named.length - 2],
          writes: named.includes('out') || named.includes('inout'),
        },
      ];
    },
  );
  return { at, params };
};

/**
 * File-scope names, from the source outside every body: the variables a
 * function could write, and the `const` ones, which a compiler folds away.
 */
const readFileScope = (
  code: string,
  braces: Int32Array,
): {
  globals: Set<string>;
  constants: Set<string>;
  types: Map<string, string>;
} => {
  const outside: string[] = [];
  let at = 0;
  while (at < code.length) {
    const open = code.indexOf('{', at);
    if (open < 0 || braces[open] < open) {
      outside.push(code.slice(at));
      break;
    }
    // A body ends its statement: with a space in its place, the function
    // header before it ran into the next declaration, which read as one
    // more prototype and was never counted.
    outside.push(code.slice(at, open), ';');
    at = braces[open] + 1;
  }
  const globals = new Set<string>();
  const constants = new Set<string>();
  const types = new Map<string, string>();
  outside
    .join('')
    .split(';')
    .forEach((statement) => {
      const words = (statement.match(/[A-Za-z_]\w*|[()[\]=,]/g) ?? []).filter(
        (word) => !QUALIFIERS.has(word),
      );
      const isConst = words[0] === 'const';
      const plain = isConst ? words.slice(1) : words;
      if (plain.length < 2 || (!isConst && NOT_WRITABLE.has(plain[0]))) {
        return;
      }
      if (plain[2] === '(') {
        return; // A function's prototype.
      }
      // Each declarator's name is the word after the type, or after a comma
      // outside any bracket and before any initialiser.
      let depth = 0;
      let named = false;
      plain.forEach((word, k) => {
        if (word === '(' || word === '[') {
          depth += 1;
        } else if (word === ')' || word === ']') {
          depth -= 1;
        } else if (depth === 0 && word === ',') {
          named = false;
        } else if (depth === 0 && word === '=') {
          named = true;
        } else if (depth === 0 && !named && k >= 1 && /^[A-Za-z_]/.test(word)) {
          (isConst ? constants : globals).add(word);
          types.set(word, plain[0]);
          named = true;
        }
      });
    });
  return { globals, constants, types };
};

export const readProgram = (code: string): IProgram => {
  const parens = bracketPartners(code, '(', ')');
  const braces = bracketPartners(code, '{', '}');
  const index: ISourceIndex = {
    code,
    parens,
    braces,
    constants: new Map(),
    ints: new Map(),
  };
  const functions = new Map<string, IFunction>();
  functionBodies(index).forEach((bodies, name) => {
    // An overload keeps its first body: the notes are about size, and two
    // overloads of one name are rare enough in a scene to read as one.
    const [from, to] = bodies[0];
    const header = readHeader(code, parens, from - 1);
    if (header) {
      functions.set(name, { name, from, to, ...header });
    }
  });
  const { globals, constants, types } = readFileScope(code, braces);

  const tokenStarts = new Uint32Array(code.length + 1);
  TOKEN.lastIndex = 0;
  let token = TOKEN.exec(code);
  while (token) {
    tokenStarts[token.index + 1] += 1;
    token = TOKEN.exec(code);
  }
  for (let k = 0; k < code.length; k += 1) {
    tokenStarts[k + 1] += tokenStarts[k];
  }
  const tokens = (from: number, to: number) =>
    tokenStarts[Math.min(to, code.length)] - tokenStarts[Math.max(from, 0)];

  const callsIn = new Map<string, ICall[]>();
  const sites = new Map<string, number>();
  const readsOwn = new Map<string, Set<string>>();
  functions.forEach((fn) => {
    const calls: ICall[] = [];
    const read = new Set<string>();
    WORD.lastIndex = fn.from;
    let found = WORD.exec(code);
    while (found && found.index < fn.to) {
      const name = found[0];
      const open = skipSpace(code, found.index + name.length);
      if (charBefore(code, found.index) !== '.') {
        if (code[open] === '(' && functions.has(name)) {
          calls.push({ callee: name, at: found.index, open });
          sites.set(name, (sites.get(name) ?? 0) + 1);
        } else if (globals.has(name)) {
          read.add(name);
        }
      }
      found = WORD.exec(code);
    }
    callsIn.set(fn.name, calls);
    readsOwn.set(fn.name, read);
  });

  const weights = new Map<string, number>();
  const writeSets = new Map<string, Set<string>>();
  const readSets = new Map<string, Set<string>>();
  const visiting = new Set<string>();
  // GLSL forbids recursion; a source that tries it gets nothing added for
  // the cycle rather than a stack overflow.
  const weight = (name: string): number => {
    const known = weights.get(name);
    if (known !== undefined) {
      return known;
    }
    const fn = functions.get(name);
    if (!fn || visiting.has(name)) {
      return 0;
    }
    visiting.add(name);
    const total = (callsIn.get(name) ?? []).reduce(
      (sum, call) => sum + weight(call.callee),
      tokens(fn.from, fn.to),
    );
    visiting.delete(name);
    weights.set(name, total);
    return total;
  };
  const gather = (
    name: string,
    cache: Map<string, Set<string>>,
    own: (fn: IFunction) => Set<string>,
  ): Set<string> => {
    const known = cache.get(name);
    if (known) {
      return known;
    }
    const fn = functions.get(name);
    const result = new Set<string>();
    cache.set(name, result);
    if (!fn) {
      return result;
    }
    own(fn).forEach((global) => result.add(global));
    (callsIn.get(name) ?? []).forEach((call) =>
      gather(call.callee, cache, own).forEach((global) => result.add(global)),
    );
    return result;
  };
  const ownWrites = (fn: IFunction) => {
    const locals = new Set(fn.params.map((param) => param.name));
    const written = assignedNames(code, fn.from, fn.to);
    return new Set(
      [...written].filter((name) => globals.has(name) && !locals.has(name)),
    );
  };

  return {
    code,
    index,
    functions,
    globals,
    constants,
    types,
    callsIn,
    sites,
    tokens,
    weight,
    writes: (name) => gather(name, writeSets, ownWrites),
    reads: (name) =>
      gather(name, readSets, (fn) => readsOwn.get(fn.name) ?? new Set()),
  };
};
