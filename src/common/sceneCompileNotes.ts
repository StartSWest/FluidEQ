/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import {
  blankGlslComments,
  lineOf,
  lineStarts,
  skipSpace,
} from './memberGlslSource';
import loopWork, { type ILoopWork } from './sceneCompileLoops';
import {
  assignedNames,
  readProgram,
  type IProgram,
} from './sceneCompileSource';

/**
 * What in a scene's source makes it slow to compile on Windows, as warnings
 * for its author and their AI: never a refusal, and never given where the
 * reading is unsure.
 *
 * Measured on 2026-11-25 on Alpine and Hanami, which took 20-38 s and
 * 11-14 s to load: Chromium's ANGLE hands a scene's one fragment program to
 * Direct3D's FXC compiler, whose time grows faster than the code (about
 * size^2.5) and explodes on three shapes. Rewriting those shapes, pixel for
 * pixel the same picture, took both scenes to 40-50% of their time:
 *
 * - work inside a loop that is the same on every turn (`sceneCompileLoops.ts`);
 * - a "keep the N nearest" list written from many separate places — Alpine
 *   offered cards from six, and one loop over every candidate with one
 *   insertion took 49% off its compile alone;
 * - a whole subsystem built twice, as when a reflection runs its own copy of
 *   the scene — Hanami's pond, now one two-turn loop for the eye ray and the
 *   mirrored ray.
 *
 * The thresholds sit between what the official scenes do today and what the
 * two slow ones did before they were rewritten, on every scene in the Studio
 * folder (`sceneCompileNotes.test.ts` holds both sides).
 */
export type TCompileNote =
  /** A heavy function is compiled again at each of `sites` calls. */
  | { code: 'repeated-subsystem'; line: number; name: string; sites: number }
  /** A sorted list of nearest things is offered to from `sites` places. */
  | { code: 'nearest-offers'; line: number; name: string; sites: number }
  /** The loop at `line` redoes a lot of work that no turn changes. */
  | { code: 'loop-invariant'; line: number };

export type TCompileNoteCode = TCompileNote['code'];

export const COMPILE_NOTE_CODES: readonly TCompileNoteCode[] = [
  'repeated-subsystem',
  'nearest-offers',
  'loop-invariant',
];

/** Where every scene starts; the size of the whole program is counted from it. */
const ENTRY = 'sceneColour';

/*
 * Every size below is in tokens — words, numbers and runs of operators — of
 * the program with every call inlined, as the driver hands it to FXC. The
 * numbers each rule was set between, measured with FXC (ps_5_0 /O1, as ANGLE
 * compiles for Direct3D 11) on ANGLE's own translation, 2026-11-26:
 *
 * - Repeats. Hanami before its rewrite repeated 8,924 tokens of a 21,126
 *   program (42%) and took 11-14 s to load. Aurora repeats 8,493 of 14,386
 *   and Crystal 7,218 of 12,267, and compile in 2.5 s and 4.2 s: a program
 *   that size compiles quickly even doubled, so the program has to be big
 *   before a repeat is worth a note.
 * - Lists. Alpine's six offers of an eleven-float card into three slots cost
 *   49% of its compile. Hanami offers a vec4 into three slots from seven
 *   places, and took 8.7 s with its insertion cut down to one compare
 *   against 7.2 s with it — nothing to gain — so a list is noted only when
 *   what it moves is wide.
 * - Loops. Hanami with the 63 values its steady() works out put back where
 *   they are used compiles in 12.3 s, against 8.5 s as it ships: a score of
 *   4,129 against 304. The highest of any official scene is 885
 *   (Magnetic, a 6,197-token program).
 */

/** A function smaller than this is a helper (noise, a hash), cheap to repeat. */
export const HEAVY_FUNCTION_TOKENS = 400;
/** A program smaller than this compiles quickly even with its repeats. */
export const REPEATED_PROGRAM_TOKENS = 16000;
/** Repeats that add less than this to the program are not worth a note. */
export const REPEATED_TOKENS = 6000;
/** ...nor repeats that are less than this share of the whole program. */
export const REPEATED_SHARE = 0.3;
/** One function's repeats smaller than this are not named. */
const NAMED_REPEAT_TOKENS = 1500;
/** Offer sites past which a nearest list is worth one loop. */
export const NEAREST_SITES = 3;
/** Floats across a list's slots past which its insertion is costly. */
export const NEAREST_FLOATS = 24;
/**
 * Same-every-turn tokens times the loop body's own size, in thousands: the
 * work that never changes costs more the more there is around it.
 */
export const INVARIANT_SCORE = 2000;
/** Characters every list's tests may read together; an insertion reads a few hundred. */
const LIST_SCAN_BUDGET = 4_000_000;
/** No more notes of one kind than this: the worst are the ones to fix. */
const MAX_NOTES_PER_CODE = 3;

const BASE_FLOATS = new Map<string, number>([
  ['float', 1],
  ['int', 1],
  ['uint', 1],
  ['bool', 1],
  ['vec2', 2],
  ['ivec2', 2],
  ['vec3', 3],
  ['ivec3', 3],
  ['vec4', 4],
  ['ivec4', 4],
  ['mat2', 4],
  ['mat3', 9],
  ['mat4', 16],
]);

/** How many floats each type holds, the scene's own structs included. */
const typeSizes = (code: string): Map<string, number> => {
  const sizes = new Map(BASE_FLOATS);
  const structs = /\bstruct\s+([A-Za-z_]\w*)\s*\{([^{}]*)\}/g;
  Array.from(code.matchAll(structs)).forEach(([, name, fields]) => {
    let total = 0;
    fields.split(';').forEach((field) => {
      const [type, ...names] = field.match(/[A-Za-z_]\w*/g) ?? [];
      const length = Number(/\[\s*(\d+)\s*\]/.exec(field)?.[1] ?? 1);
      total += (sizes.get(type ?? '') ?? 1) * names.length * length;
    });
    sizes.set(name, total);
  });
  return sizes;
};

/**
 * How many floats a function keeps in a sorted list, or 0 when it keeps
 * none: two or more tests that compare and then write a file-scope variable
 * or an `out`/`inout` parameter — an insertion's swaps — against two or
 * more different slots. Keeping only the nearest (`if (t < best) best = t;`)
 * compares against one slot and is no list.
 */
const listFloats = (
  program: IProgram,
  name: string,
  sizes: ReadonlyMap<string, number>,
  budget: { left: number },
): number => {
  const { code, index } = program;
  const fn = program.functions.get(name);
  if (!fn) {
    return 0;
  }
  const typeOf = new Map(program.types);
  fn.params.forEach((param) => {
    if (param.writes) {
      typeOf.set(param.name, param.type);
    } else {
      typeOf.delete(param.name);
    }
  });
  const isTarget = (target: string) =>
    typeOf.has(target) &&
    (program.globals.has(target) ||
      fn.params.some((param) => param.writes && param.name === target));
  let swaps = 0;
  const slots = new Set<string>();
  const tests = /\bif\s*\(/g;
  tests.lastIndex = fn.from;
  let test = tests.exec(code);
  while (test && test.index < fn.to) {
    const open = code.indexOf('(', test.index);
    const close = index.parens[open];
    if (close > open && close < fn.to) {
      const condition = code.slice(open + 1, close);
      const compares = /(^|[^<>])[<>](?![<>=])|<=|>=/.test(condition);
      const compared = compares
        ? (condition.match(/[A-Za-z_]\w*/g) ?? []).filter(isTarget)
        : [];
      const after = skipSpace(code, close + 1);
      const end =
        code[after] === '{' ? index.braces[after] : code.indexOf(';', after);
      // Nested tests read their blocks again, once per level: bounded, so a
      // source of ten thousand nested ifs cannot hold the window.
      // eslint-disable-next-line no-param-reassign -- one budget for every list in the scene
      budget.left -= compared.length > 0 && end > after ? end - after : 0;
      if (budget.left < 0) {
        return 0;
      }
      const writes =
        compared.length > 0 &&
        end > after &&
        [...assignedNames(code, after, end + 1)].some(isTarget);
      if (writes) {
        swaps += 1;
        compared.forEach((slot) => slots.add(slot));
      }
    }
    test = tests.exec(code);
  }
  if (swaps < 2 || slots.size < 2) {
    return 0;
  }
  return [...slots].reduce(
    (sum, slot) => sum + (sizes.get(typeOf.get(slot) ?? '') ?? 1),
    0,
  );
};

const repeatedSubsystems = (program: IProgram): TCompileNote[] => {
  const total = program.weight(ENTRY);
  const repeats = [...program.functions.keys()]
    .filter((name) => name !== ENTRY)
    .map((name) => ({
      name,
      sites: program.sites.get(name) ?? 0,
      weight: program.weight(name),
    }))
    .filter(
      ({ sites, weight }) => sites >= 2 && weight >= HEAVY_FUNCTION_TOKENS,
    )
    .map((one) => ({ ...one, extra: one.weight * (one.sites - 1) }));
  const extra = repeats.reduce((sum, one) => sum + one.extra, 0);
  if (
    total < REPEATED_PROGRAM_TOKENS ||
    extra < REPEATED_TOKENS ||
    extra / total < REPEATED_SHARE
  ) {
    return [];
  }
  return repeats
    .filter((one) => one.extra >= NAMED_REPEAT_TOKENS)
    .sort((a, b) => b.extra - a.extra)
    .slice(0, MAX_NOTES_PER_CODE)
    .map(({ name, sites }) => ({
      code: 'repeated-subsystem' as const,
      line: 0,
      name,
      sites,
    }));
};

export const invariantScore = (loop: ILoopWork): number =>
  (loop.invariant * loop.body) / 1000;

/**
 * Every compile-time note the scene's source earns, worst first within each
 * kind. Empty for a source that reads clean or cannot be read.
 */
export const compileNotesFor = (source: string): TCompileNote[] => {
  const code = blankGlslComments(source);
  if (code === null) {
    return [];
  }
  const program = readProgram(code);
  if (!program.functions.has(ENTRY)) {
    return [];
  }
  const starts = lineStarts(code);
  const lineOfFunction = (name: string) =>
    lineOf(starts, program.functions.get(name)?.at ?? 0);

  const repeated = repeatedSubsystems(program).map((note) =>
    note.code === 'repeated-subsystem'
      ? { ...note, line: lineOfFunction(note.name) }
      : note,
  );
  const sizes = typeSizes(code);
  const listBudget = { left: LIST_SCAN_BUDGET };
  const nearest: TCompileNote[] = [...program.functions.keys()]
    .filter(
      (name) =>
        (program.sites.get(name) ?? 0) >= NEAREST_SITES &&
        listFloats(program, name, sizes, listBudget) >= NEAREST_FLOATS,
    )
    .sort((a, b) => (program.sites.get(b) ?? 0) - (program.sites.get(a) ?? 0))
    .slice(0, MAX_NOTES_PER_CODE)
    .map((name) => ({
      code: 'nearest-offers' as const,
      line: lineOfFunction(name),
      name,
      sites: program.sites.get(name) ?? 0,
    }));
  const loops = loopWork(program).filter(
    (loop) => invariantScore(loop) >= INVARIANT_SCORE,
  );
  // A loop inside another noted loop is the same work noted twice.
  const invariant: TCompileNote[] = loops
    .filter(
      (loop) =>
        !loops.some(
          (outer) =>
            outer !== loop && outer.from <= loop.at && loop.to <= outer.to,
        ),
    )
    .sort((a, b) => invariantScore(b) - invariantScore(a))
    .slice(0, MAX_NOTES_PER_CODE)
    .map((loop) => ({
      code: 'loop-invariant' as const,
      line: lineOf(starts, loop.at),
    }));
  return [...repeated, ...nearest, ...invariant];
};
