/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * When a scene's control is shown in the Studio (contract 9): `"showWhen":
 * { "<choice id>": [option numbers] }` on any control shows it only while
 * each named choice stands on one of its listed options - a single colour
 * for a "One colour" mode, a palette for "Gradient" and "Rainbow". Hidden, a
 * control keeps its value and still reaches the shader: it is put away, not
 * switched off. A FluidEQ before contract 9 ignores the key and shows every
 * control. This file imports nothing, so the server keeps it with these very
 * bytes (`vendor-member-rules.mjs`).
 */

/** Choices a control may depend on at once; more is not a rule anyone reads. */
export const MAX_SHOW_WHEN_KEYS = 2;
const CHOICE_ID = /^[a-z][a-z0-9_]{0,23}$/;

export type TShowWhen = Readonly<Record<string, readonly number[]>>;

/**
 * A control's rule, or nothing: each key a control id, each value the option
 * numbers (0 to 7) that show it. A key that is not one is left out, and a
 * rule with nothing left is no rule - the control is always shown.
 */
export const readShowWhen = (value: unknown): TShowWhen | undefined => {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return undefined;
  }
  const rule: Record<string, number[]> = {};
  Object.entries(value as Record<string, unknown>).forEach(([id, options]) => {
    if (
      Object.keys(rule).length >= MAX_SHOW_WHEN_KEYS ||
      !CHOICE_ID.test(id) ||
      !Array.isArray(options)
    ) {
      return;
    }
    const picks = options.filter(
      (at): at is number => Number.isInteger(at) && at >= 0 && at < 8,
    );
    if (picks.length) {
      rule[id] = [...new Set(picks)].sort((a, b) => a - b);
    }
  });
  return Object.keys(rule).length ? rule : undefined;
};

/** Whether a rule is whole as its author wrote it: the Studio's check. */
export const isWholeShowWhen = (value: unknown): boolean =>
  value === undefined ||
  (typeof value === 'object' &&
    value !== null &&
    !Array.isArray(value) &&
    Object.keys(value).length <= MAX_SHOW_WHEN_KEYS &&
    Object.entries(value as Record<string, unknown>).every(
      ([id, options]) =>
        CHOICE_ID.test(id) &&
        Array.isArray(options) &&
        options.length > 0 &&
        options.every((at) => Number.isInteger(at) && at >= 0 && at < 8),
    ));

/**
 * Whether a control with `rule` is shown while the choices stand at
 * `values`. A rule naming a control that is not a choice of this scene
 * hides nothing, so a typo never makes a control unreachable.
 */
export const isShownBy = (
  rule: TShowWhen | undefined,
  values: Readonly<Record<string, number>>,
  choiceIds: ReadonlySet<string>,
): boolean =>
  !rule ||
  Object.entries(rule).every(
    ([id, options]) =>
      !choiceIds.has(id) || options.includes(Math.round(values[id] ?? 0)),
  );
