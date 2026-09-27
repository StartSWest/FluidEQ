/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import {
  changesCounter,
  readLoop,
  writersIn,
  type ILoop,
} from './memberGlslLoops';
import {
  blankGlslComments,
  bracketPartners,
  intDeclarations,
  lineOf,
  lineStarts,
  skipSpace,
  type ISourceIndex,
} from './memberGlslSource';
import { overBudget } from './memberGlslWork';

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
 * change (`memberGlslLoops.ts`), and all the loops and calls one pixel runs
 * stay inside a budget (`memberGlslWork.ts`). Every one of the thirty
 * official scenes already keeps these rules.
 *
 * GLSL ES 3.00 allows a loop to change its own counter and to run to a
 * variable, so these rules are the only thing that ends a member's loop: a
 * scene that slips past them holds the GPU until Windows resets the driver,
 * for every program on the machine, and five resets in a minute stop Windows.
 * Each rule is written against the way around it that was found.
 *
 * The signing function vendors this file and the three it reads from into
 * Deno as they are (`tools/vendor-member-rules.mjs` on the server), and the
 * checks must be the same bytes on both sides: these four import nothing but
 * each other. They were one file of a thousand lines while the vendoring
 * could not follow an import; it can now, and the file was split where its
 * parts already were.
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

/** The function a piece of GLSL must define, and what it is called. */
interface IEntryPoint {
  name: string;
  pattern: RegExp;
}

const SCENE_ENTRY: IEntryPoint = {
  name: 'sceneColour',
  pattern: /\bvec4\s+sceneColour\s*\(\s*vec2\s+\w+\s*\)/,
};

/**
 * A 3D world's own GLSL (`sceneWorld.ts`): a vertex's move and a surface's
 * colour. Each runs per vertex or per pixel exactly as a scene does, so each
 * is held to every rule a scene is, its budget counted from its own entry.
 */
const WORLD_ENTRIES: Record<'vertex' | 'fragment', IEntryPoint> = {
  vertex: { name: 'worldDisplace', pattern: /\bvec3\s+worldDisplace\s*\(/ },
  fragment: { name: 'worldSurface', pattern: /\bvoid\s+worldSurface\s*\(/ },
};
const IDENTIFIER = /[A-Za-z_][A-Za-z0-9_]*/g;
const CONST_INT =
  /\bconst\s+int\s+([A-Za-z_]\w*)\s*=\s*(-?(?:0|[1-9]\d*))\s*;/g;

/**
 * More loops than any scene has — the most in the 77 official scenes and
 * Studio projects measured on 2026-09-13 is 11 — and each one is more for
 * the compiler to link, which holds every other scene in the window while it
 * does. Past it the source is not read further.
 */
export const MAX_MEMBER_LOOPS = 64;

/**
 * Every rule the source breaks, at most once each, in the order they appear.
 * Empty means the source may be handed to the compiler.
 *
 * One pass over the source, whatever is in it: every check that scanned
 * again from a match, or from the top of the file for its line, let a source
 * of the right twenty thousand tokens hold the main process for a second.
 */
const checkMemberGlsl = (
  source: string,
  entry: IEntryPoint,
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

  if (!entry.pattern.test(code)) {
    note('entry-point', 0);
  } else if (!loopsBroken) {
    const over = overBudget(index, loops, entry.name);
    if (over !== undefined) {
      note('loop-budget', over);
    }
  }

  return [...found]
    .map(([rule, line]) => ({ code: rule, line }))
    .sort((a, b) => a.line - b.line);
};

export const checkMemberSceneSource = (
  source: string,
): IMemberRuleViolation[] => checkMemberGlsl(source, SCENE_ENTRY);

/** A 3D world material's GLSL, held to a scene's rules from its own entry. */
export const checkMemberWorldHook = (
  source: string,
  stage: 'vertex' | 'fragment',
): IMemberRuleViolation[] => checkMemberGlsl(source, WORLD_ENTRIES[stage]);
