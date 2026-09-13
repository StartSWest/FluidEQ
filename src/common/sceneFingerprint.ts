/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * How much of one scene's code is in another, whatever it was renamed to.
 *
 * FluidEQ's own scenes can be opened in the Studio to look inside and take
 * ideas from, but never sent back out as a member's scene. A scene read that
 * way is a folder like any other, and a folder can be copied and relinked,
 * so what is refused is the code itself: before a member's scene is signed,
 * the server measures how much of each FluidEQ scene is in it.
 *
 * The code is reduced to what renaming, reformatting and retuning cannot
 * change. Comments and spacing go. Every name the author chose becomes the
 * same token and every number another, while the language's own words, the
 * scene contract's uniforms and swizzles like `.xy` stay what they are. Runs
 * of `SHINGLE_TOKENS` of those tokens are hashed, and winnowing keeps the
 * smallest hash of every `WINNOW_WINDOW` in a row: a stable sample, so a copy
 * with lines moved or functions reordered still shares most of the sample,
 * and a borrowed function shares only its own few.
 *
 * NO IMPORTS, on purpose: the signing function vendors this file into Deno
 * as it is, beside the member rules, so the app's warning and the server's
 * refusal are the same arithmetic.
 */

/**
 * Tokens per hashed run, and runs per window of which the smallest hash is
 * kept. Measured on the 36 official scenes, against copies of each: at 12 and
 * 6 a copy that also lost a fifth of its statements still carries at least
 * 58% of its original, while no official scene carries more than 22% of any
 * other and members' own scenes at most 6% of any of them. Longer runs lost
 * copies faster than they gained margin; shorter ones began to find the same
 * short idioms in unrelated scenes.
 */
export const SHINGLE_TOKENS = 12;
export const WINNOW_WINDOW = 6;

/**
 * Words kept as themselves: the GLSL ES 3.00 keywords, types, qualifiers and
 * built-in functions a scene can use. Anything else an author can rename.
 */
const LANGUAGE_WORDS = new Set(
  (
    'attribute const uniform varying layout centroid flat smooth break continue do for while switch case default if else in out inout float int void bool true false invariant discard return mat2 mat3 mat4 mat2x2 mat2x3 mat2x4 mat3x2 mat3x3 mat3x4 mat4x2 mat4x3 mat4x4 vec2 vec3 vec4 ivec2 ivec3 ivec4 bvec2 bvec3 bvec4 uint uvec2 uvec3 uvec4 lowp mediump highp precision sampler2D sampler3D samplerCube sampler2DShadow struct ' +
    'radians degrees sin cos tan asin acos atan sinh cosh tanh asinh acosh atanh pow exp log exp2 log2 sqrt inversesqrt abs sign floor trunc round roundEven ceil fract mod modf min max clamp mix step smoothstep isnan isinf length distance dot cross normalize faceforward reflect refract matrixCompMult outerProduct transpose determinant inverse lessThan lessThanEqual greaterThan greaterThanEqual equal notEqual any all not texture textureSize textureLod texelFetch dFdx dFdy fwidth'
  ).split(' '),
);

/** The scene contract's inputs, which no copy can rename. */
const CONTRACT_UNIFORM = /^u[A-Z]\w*$/;
const SWIZZLE = /^[xyzw]{1,4}$|^[rgba]{1,4}$|^[stpq]{1,4}$/;

const TOKEN =
  /\/\/[^\n]*|\/\*[\s\S]*?(?:\*\/|$)|(\d+\.?\d*(?:[eE][+-]?\d+)?[uUfF]?|\.\d+(?:[eE][+-]?\d+)?[fF]?)|([A-Za-z_]\w*)|(<<=|>>=|\+\+|--|<=|>=|==|!=|&&|\|\||\^\^|\+=|-=|\*=|\/=|%=|<<|>>|[^\s\w])/g;

/** The scene's code as the tokens renaming and retuning leave alone. */
export const sceneTokens = (source: string): string[] => {
  const tokens: string[] = [];
  let previous = '';
  source.replace(
    TOKEN,
    (
      match: string,
      number: string | undefined,
      word: string | undefined,
      symbol: string | undefined,
    ) => {
      let token: string | undefined;
      if (number !== undefined) {
        token = '0';
      } else if (word !== undefined) {
        const kept =
          LANGUAGE_WORDS.has(word) ||
          CONTRACT_UNIFORM.test(word) ||
          (previous === '.' && SWIZZLE.test(word));
        token = kept ? word : '$';
      } else if (symbol !== undefined) {
        token = symbol;
      }
      if (token !== undefined) {
        tokens.push(token);
        previous = token;
      }
      return match;
    },
  );
  return tokens;
};

/** FNV-1a over a run of tokens, as a signed 32-bit integer (a database int). */
/* eslint-disable no-bitwise -- FNV-1a is XOR and 32-bit multiplication by definition */
const hashRun = (tokens: readonly string[], from: number): number => {
  let hash = 0x811c9dc5;
  for (let at = from; at < from + SHINGLE_TOKENS; at += 1) {
    const token = tokens[at];
    for (let k = 0; k < token.length; k += 1) {
      hash ^= token.charCodeAt(k);
      hash = Math.imul(hash, 0x01000193);
    }
    // A separator, so `a` `bc` and `ab` `c` are different runs.
    hash ^= 0x1f;
    hash = Math.imul(hash, 0x01000193);
  }
  return hash | 0;
};
/* eslint-enable no-bitwise */

/**
 * The scene's fingerprint: the winnowed hashes of its token runs, each once,
 * sorted. Empty for code shorter than one run.
 */
export const sceneFingerprint = (source: string): number[] => {
  const tokens = sceneTokens(source);
  const runs = tokens.length - SHINGLE_TOKENS + 1;
  if (runs <= 0) {
    return [];
  }
  const hashes = Array.from({ length: runs }, (_, at) => hashRun(tokens, at));
  const kept = new Set<number>();
  if (hashes.length <= WINNOW_WINDOW) {
    kept.add(Math.min(...hashes));
  } else {
    for (let start = 0; start + WINNOW_WINDOW <= hashes.length; start += 1) {
      let smallest = hashes[start];
      for (let at = start + 1; at < start + WINNOW_WINDOW; at += 1) {
        smallest = Math.min(smallest, hashes[at]);
      }
      kept.add(smallest);
    }
  }
  return [...kept].sort((a, b) => a - b);
};

export interface IReferenceScene {
  id: string;
  fingerprint: readonly number[];
}

/**
 * Hashes found in `commonIn` or more of the references: the code FluidEQ's
 * scenes share with each other — their helper library, the scaffolding every
 * scene has — which belongs to no one scene and which anybody may use.
 */
export const COMMON_IN_REFERENCES = 3;

export interface IClosestReference {
  id: string;
  /** Share of the reference's own code, 0..1, that is in the scene. */
  coverage: number;
}

/**
 * The reference with the largest share of its own distinctive code inside
 * `candidate`, or undefined when none shares any.
 *
 * Measured as a share of the reference, not of the candidate, so a copy
 * padded with code that does nothing still carries the whole of what it
 * copied; and a borrowed function or two is a small share of any scene.
 */
export const closestReference = (
  candidate: readonly number[],
  references: readonly IReferenceScene[],
  commonIn = COMMON_IN_REFERENCES,
): IClosestReference | undefined => {
  const seenIn = new Map<number, number>();
  references.forEach((reference) => {
    new Set(reference.fingerprint).forEach((hash) =>
      seenIn.set(hash, (seenIn.get(hash) ?? 0) + 1),
    );
  });
  const present = new Set(candidate);
  let closest: IClosestReference | undefined;
  references.forEach((reference) => {
    const own = [...new Set(reference.fingerprint)].filter(
      (hash) => (seenIn.get(hash) ?? 0) < commonIn,
    );
    if (own.length === 0) {
      return;
    }
    const shared = own.filter((hash) => present.has(hash)).length;
    const coverage = shared / own.length;
    if (shared > 0 && (!closest || coverage > closest.coverage)) {
      closest = { id: reference.id, coverage };
    }
  });
  return closest;
};

/**
 * The share of a FluidEQ scene from which a member's scene is that scene
 * rather than one that took ideas from it: half. On the official collection
 * every copy renamed, retuned, reordered or padded carried 96% or more, while
 * taking one of a scene's helper functions stayed under half for 33 of the
 * 36 scenes, and taking two for 30. The rest are scenes whose whole look is
 * drawn by one or two functions, and taking those is taking the scene.
 */
export const COPY_COVERAGE = 0.5;

/** Whether `closest` is a copy of a FluidEQ scene, not a scene inspired by it. */
export const isOfficialCopy = (closest: IClosestReference | undefined) =>
  closest !== undefined && closest.coverage >= COPY_COVERAGE;
