/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * Plus's mark: a pass - a ticket with a plus on it - drawn in one line in
 * the colour of the words beside it, like every other glyph in Scenes. Plus
 * is a pass to every scene in the gallery. It replaced a filled gradient
 * tile Ivan found wrong for the place (2026-11-28).
 *
 * Decoration always: whatever it stands beside says "Plus" in words.
 */
export default function PlusMark({ className }: { className?: string }) {
  return (
    <svg
      className={`plus-mark${className ? ` ${className}` : ''}`}
      viewBox="0 0 16 16"
      aria-hidden="true"
      focusable="false"
    >
      <path d="M2.5 5.2a.9.9 0 0 1 .9-.9h9.2a.9.9 0 0 1 .9.9v1.2a1.6 1.6 0 0 0 0 3.2v1.2a.9.9 0 0 1-.9.9H3.4a.9.9 0 0 1-.9-.9V9.6a1.6 1.6 0 0 0 0-3.2z" />
      <path d="M8 6.5v3M6.5 8h3" />
    </svg>
  );
}
