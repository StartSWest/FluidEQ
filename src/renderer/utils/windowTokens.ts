/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * The names of the window's colour tokens on `:root`, in one place. The
 * theme's shades (`themeShade.ts`), a scene's tint (`sceneTintPalette.ts`)
 * and colours somebody picked (`pickedWindow.ts`) all write these, and every
 * stylesheet reads them. Imports nothing, so any of those can import it
 * without the others coming along.
 */

/** What things stand on: the floor, the panes and what sits on them. */
export const WINDOW_SURFACES = [
  '--surface-base',
  '--surface-panel',
  '--surface-block',
  '--surface-field',
  '--surface-field-end',
  '--surface-menu',
  '--surface-menu-top',
  '--surface-menu-face',
  '--surface-well',
  '--track-well',
] as const;

export type TWindowSurface = (typeof WINDOW_SURFACES)[number];

/** The hairlines, each a colour at the opacity its contrast needs. */
export const WINDOW_EDGES = [
  '--border-subtle',
  '--border-panel',
  '--border-menu',
] as const;

/** The accent in its four strengths. */
export const WINDOW_ACCENTS = [
  '--accent',
  '--accent-light',
  '--accent-dark',
  '--accent-darker',
] as const;

/** What says a thing is on. */
export const WINDOW_STATES = ['--active'] as const;

/**
 * The words on a filled accent and on a filled "on": the floor's colour
 * (the stylesheet's default, `_shippedTheme.scss`), or the white window's
 * dark ink on a light colour somebody picked (`filledFace`, `windowFill.ts`).
 */
export const WINDOW_LABELS = ['--on-accent', '--on-active'] as const;
