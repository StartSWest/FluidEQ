/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import type { KeyboardEvent } from 'react';
import type { TPresetBrowse } from './usePresetBrowse';

/**
 * Whether a key is the star's: Ctrl+D, or Cmd+D on a Mac, where Ctrl is a
 * different key altogether. The field holds the caret while searching, so a
 * bare letter would only type; Chromium's bookmark key is free in Electron.
 */
export const isStarKey = (
  event: Pick<
    KeyboardEvent,
    'key' | 'ctrlKey' | 'metaKey' | 'altKey' | 'shiftKey'
  >,
  onMac: boolean,
): boolean =>
  event.key.toLowerCase() === 'd' &&
  (onMac ? event.metaKey && !event.ctrlKey : event.ctrlKey && !event.metaKey) &&
  !event.altKey &&
  !event.shiftKey;

/** A key that types something, which the field takes from anywhere. */
const typesText = (event: KeyboardEvent) =>
  event.key.length === 1 &&
  event.key !== ' ' &&
  !event.ctrlKey &&
  !event.metaKey &&
  !event.altKey;

/**
 * The plate's panel keys, answered from anywhere in it (design A's notes):
 * a letter goes into the field, which needs no click; Up and Down walk the
 * rows and stop at the ends; Enter plays the row the keys are on; Ctrl+D
 * stars it; Escape clears what is typed and only then closes — that last
 * press is `useWaveMenu`'s, which steps aside for any key handled here.
 *
 * The keys walk an active row while the caret stays in the field, so typing
 * on never needs a click back; a row reached with Tab is the active one, and
 * the arrows then move the focus with it.
 */
const presetMenuKeyDown =
  (browse: TPresetBrowse, onMac: boolean) =>
  (event: KeyboardEvent<HTMLElement>) => {
    const { rows, activeIndex } = browse;
    const input = browse.inputRef.current;
    const active = activeIndex >= 0 ? rows[activeIndex] : undefined;
    // The field or the panel itself, rather than one of its buttons.
    const fromPanel =
      event.target === input || event.target === event.currentTarget;
    if (isStarKey(event, onMac)) {
      event.preventDefault();
      if (active?.isStarrable) {
        browse.edits.toggle(active.id);
      }
      return;
    }
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      if (rows.length === 0) {
        return;
      }
      const step = event.key === 'ArrowDown' ? 1 : -1;
      const from = activeIndex < 0 && step < 0 ? 0 : activeIndex + step;
      const next = Math.max(0, Math.min(rows.length - 1, from));
      browse.setActiveIndex(next);
      browse.noteKeys();
      if (!fromPanel) {
        document
          .getElementById(browse.rowId(next))
          ?.focus({ preventScroll: true });
      }
      return;
    }
    // A row, a star, the foot or Undo with the focus answers Enter itself,
    // as any button does.
    if (event.key === 'Enter' && active && fromPanel) {
      event.preventDefault();
      browse.play(active.id);
      return;
    }
    if (event.key === 'Escape' && browse.query !== '') {
      event.preventDefault();
      browse.setQuery('');
      input?.focus({ preventScroll: true });
      return;
    }
    // Typing from anywhere: the field takes the focus before the key lands,
    // so the letter is typed into it.
    if (input && event.target !== input && typesText(event)) {
      input.focus({ preventScroll: true });
    }
  };

export default presetMenuKeyDown;
