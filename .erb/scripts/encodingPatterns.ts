/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU General Public License version 3 or later.
*/

/**
 * The signatures of UTF-8 text that went through the wrong decoder.
 *
 * Pure so the patterns can be held to a positive control in Jest: a check
 * that only ever reports "unmangled" cannot be told apart from one that
 * matches nothing, and the first version of these patterns did exactly that
 * for the em-dashes that prompted them. `check-encoding.ts` is the script;
 * this is the part of it that can be proven.
 */

/**
 * A C1 control character, which is the loudest half of the signature.
 *
 * A 3-byte UTF-8 character -- every dash, curly quote and ellipsis in this
 * tree -- is E2 followed by two continuation bytes in 80-BF. Mis-decoded as
 * Latin-1 the lead becomes `a-circumflex` (U+00E2) and BOTH continuations
 * become codepoints in U+0080-U+009F, which is the C1 control block: no
 * printable character, no keyboard, and nothing any of this project's ten
 * locales contains. One anywhere in a source file means the bytes went through
 * the wrong decoder.
 *
 * The first version of this looked for the lead character instead and matched
 * U+00C2/U+00C3 only, which is what a mangled TWO-byte character starts with.
 * It therefore missed every mangled em-dash -- the nine that prompted the
 * script. Its own positive control caught that, which is the whole argument
 * for writing one.
 */
export const C1_CONTROL = /[\u0080-\u009f]/;

/**
 * The other half: a mangled two-byte character, whose tail can be printable.
 *
 * `middle dot` is C2 B7, and mis-decoded it is U+00C2 followed by U+00B7 --
 * a real, printable character, so `C1_CONTROL` never sees it. That exact case
 * had been sitting in a `title` attribute in the karaoke workspace. The lead
 * is restricted to the two characters a mangled 2-byte sequence can start
 * with, so ordinary accented prose does not trip it.
 */
export const MANGLED_PAIR = /[\u00c2\u00c3][\u0080-\u00bf]/;

/**
 * What a continuation byte 80-BF turns into under CP1252, not Latin-1.
 *
 * The two patterns above assume Latin-1, where 80-9F stay control codes.
 * Windows PowerShell 5.1's `Get-Content` reads a BOM-less file in the system
 * ANSI code page, which on every Windows machine this project has been built
 * on is CP1252 -- and CP1252 gives 80-9F PRINTABLE characters. The em-dash's
 * two continuation bytes 80 94 come back as U+20AC and U+201D, so the dash
 * reads as the three characters `a-circumflex, euro sign, right double
 * quote`, none of them in the C1 block and none of them paired the way
 * `MANGLED_PAIR` expects. That is what `Get-Content | Add-Content -Encoding
 * utf8` did to thirty em-dashes in one document while `typecheck:encoding`
 * reported the whole tree clean; the file happened to be untracked, and the
 * same edit to any tracked source would have passed.
 *
 * The class is the CP1252 image of 80-BF: the twenty-seven printable
 * replacements for 80-9F (five positions are undefined and come back as the
 * control codes `C1_CONTROL` already sees) plus A0-BF, which CP1252 and
 * Latin-1 agree on.
 */
const CP1252_TAIL =
  '[\\u0080-\\u00bf' +
  '\\u20ac\\u201a\\u0192\\u201e\\u2026\\u2020\\u2021\\u02c6\\u2030\\u0160\\u2039\\u0152\\u017d' +
  '\\u2018\\u2019\\u201c\\u201d\\u2022\\u2013\\u2014\\u02dc\\u2122\\u0161\\u203a\\u0153\\u017e\\u0178]';

/**
 * A UTF-8 lead byte followed by the CP1252 image of its continuation bytes.
 *
 * Tight on purpose: a 3-byte lead (U+00E2, `a-circumflex`) has to be followed
 * by TWO tail characters and a 4-byte lead (U+00F0, `eth`) by three, which is
 * what an intact mangled sequence looks like and what no French or Portuguese
 * word does -- `âme` and `pâte` put a plain letter after the circumflex. A
 * 2-byte lead (U+00C2/U+00C3) needs only one tail character, but only from
 * the CP1252-specific part of the class: the A0-BF half is `MANGLED_PAIR`'s
 * already, and the 80-9F half is exactly where `capital E circumflex` (C3 8A)
 * turns into `A-tilde` followed by `S with caron` (U+0160) with nothing
 * unprintable left to catch.
 */
export const CP1252_MANGLED = new RegExp(
  `\\u00e2${CP1252_TAIL}{2}|\\u00f0${CP1252_TAIL}{3}|[\\u00c2\\u00c3]${CP1252_TAIL.replace(
    '\\u0080-\\u00bf',
    '',
  )}`,
);

/** Every signature, in the order they were added. None may be dropped. */
export const MANGLED_SIGNATURES: ReadonlyArray<RegExp> = [
  C1_CONTROL,
  MANGLED_PAIR,
  CP1252_MANGLED,
];

/** True when the line carries any of the signatures. */
export const isMangledLine = (line: string): boolean =>
  MANGLED_SIGNATURES.some((signature) => signature.test(line));
