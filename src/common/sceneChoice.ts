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

/**
 * The pictures an option may wear beside its name (`"icon"`), drawn by
 * FluidEQ from its own set (`SceneOptionIcon.tsx`): a scene names one, it
 * never ships a picture, so an option's icon is as safe as its name.
 */
export const CHOICE_ICONS = [
  'bars',
  'wave',
  'circle',
  'ring',
  'dots',
  'grid',
  'star',
  'sparkle',
  'sun',
  'moon',
  'cloud',
  'snow',
  'drop',
  'flame',
  'leaf',
  'flower',
  'heart',
  'spiral',
  'square',
  'triangle',
  'diamond',
  'mountain',
  'bolt',
  'eye',
] as const;

export type TChoiceIcon = (typeof CHOICE_ICONS)[number];

/** Colours an option may show as a little chip (`"swatch"`): one to four. */
export const MAX_CHOICE_SWATCH = 4;

// Named apart from every other vendored module's: the server bundles them into
// one scope (`tools/bundle-functions.mjs`).
const SWATCH_HEX = /^#[0-9a-f]{6}$/i;

export const isChoiceIcon = (value: unknown): value is TChoiceIcon =>
  typeof value === 'string' &&
  (CHOICE_ICONS as readonly string[]).includes(value);

/**
 * What an option shows beside its name: an icon from FluidEQ's set and a
 * chip of up to four colours, each left out where it is not one this
 * version draws - an option is still its name without them.
 */
export const readChoiceLook = (
  option: unknown,
): { icon?: TChoiceIcon; swatch?: string[] } => {
  if (typeof option !== 'object' || option === null) {
    return {};
  }
  const { icon, swatch } = option as { icon?: unknown; swatch?: unknown };
  const colours = Array.isArray(swatch)
    ? swatch
        .filter(
          (entry): entry is string =>
            typeof entry === 'string' && SWATCH_HEX.test(entry),
        )
        .slice(0, MAX_CHOICE_SWATCH)
        .map((entry) => entry.toLowerCase())
    : [];
  return {
    ...(isChoiceIcon(icon) ? { icon } : {}),
    ...(colours.length ? { swatch: colours } : {}),
  };
};
