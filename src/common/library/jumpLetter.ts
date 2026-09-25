/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { normalizeForSearch } from './grouping';

/**
 * The letter rail's buttons, in order. `#` collects everything that does not
 * start with a Latin letter once folded — digits, and every script this app
 * is translated into. One bucket rather than none: a library of Japanese
 * album titles should still have somewhere to jump to.
 */
export const JUMP_LETTERS = [
  '#',
  ...'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split(''),
] as const;

/**
 * Which rail button a title belongs under. Accent-folded first, so "Ángel"
 * files under A rather than under `#`. Shared by the store, which answers
 * where each letter starts, and the rail, which lights the centre's letter —
 * two readings of one rule would light one letter and jump to another.
 */
export const jumpLetterOf = (title: string): string => {
  const first = normalizeForSearch(title).charAt(0).toUpperCase();
  return first >= 'A' && first <= 'Z' ? first : '#';
};
