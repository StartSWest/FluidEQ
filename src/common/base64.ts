/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

const PLUS = 43;
const SLASH = 47;
const EQUALS = 61;

const isLetter = (code: number) =>
  (code >= 65 && code <= 90) || // A-Z
  (code >= 97 && code <= 122) || // a-z
  (code >= 48 && code <= 57) || // 0-9
  code === PLUS ||
  code === SLASH;

/**
 * Whether `value` is standard base64: one or more of its 64 letters, then at
 * most two `=`.
 *
 * Read a character at a time, never with `/^[A-Za-z0-9+/]+={0,2}$/`: V8
 * keeps a backtracking entry for every character that expression matches,
 * and a 3D model at the size a scene may carry (6 MB, some 8.4 million
 * characters) ran it out of stack. Checking the scene then threw a
 * RangeError instead of answering (CI, every run of 2026-09-30); a signed
 * pack's payload is longer still.
 */
const isBase64 = (value: unknown): value is string => {
  if (typeof value !== 'string') {
    return false;
  }
  let end = value.length;
  if (end > 0 && value.charCodeAt(end - 1) === EQUALS) {
    end -= 1;
  }
  if (end > 0 && value.charCodeAt(end - 1) === EQUALS) {
    end -= 1;
  }
  if (end === 0) {
    return false;
  }
  for (let i = 0; i < end; i += 1) {
    if (!isLetter(value.charCodeAt(i))) {
      return false;
    }
  }
  return true;
};

export default isBase64;
