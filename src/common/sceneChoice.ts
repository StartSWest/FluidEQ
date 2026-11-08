/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * A scene's choice (contract 9): one of two to eight named options, declared
 * among `pack.json`'s `params` as `{ "type": "choice", "options": [...] }`.
 *
 * The shader gets it exactly as it gets a slider - `uniform float
 * uParam_<id>` - holding the chosen option's number, 0 for the first, so
 * everything a slider already does reaches a choice unchanged: the stage
 * follows it, it is saved as `value`, Reset puts it back, a 3D world's
 * formulas read it as `p.<id>`. It counts among the eight controls, being
 * one of their uniforms.
 *
 * An older FluidEQ reads every `params` entry as a slider. Written with
 * `"min": 0` and `"max"` one less than its options (the server signs it so,
 * `memberpack.ts`), a choice there is a slider across the same numbers, and
 * a shader that rounds it still picks an option. This file imports nothing,
 * so the server checks choices with these very bytes
 * (`vendor-member-rules.mjs`).
 */

export const CHOICE_TYPE = 'choice';
export const MIN_CHOICE_OPTIONS = 2;
export const MAX_CHOICE_OPTIONS = 8;
/** An option's name, in any language: a short word, not a sentence. */
export const MAX_CHOICE_NAME_LENGTH = 40;

/** Whether a `params` entry declares a choice rather than a slider. */
export const isChoiceEntry = (value: unknown): boolean =>
  typeof value === 'object' &&
  value !== null &&
  (value as { type?: unknown }).type === CHOICE_TYPE;

/**
 * The option a value picks among `count`: the nearest, kept inside them. A
 * shader is handed this number, so a value saved between two options, or
 * past the last, still names one.
 */
export const choiceIndex = (value: unknown, count: number): number => {
  const read = typeof value === 'number' && Number.isFinite(value) ? value : 0;
  return Math.min(Math.max(0, count - 1), Math.max(0, Math.round(read)));
};
