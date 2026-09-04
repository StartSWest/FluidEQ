/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU General Public License version 3 or later.
*/

/**
 * The one chevron.
 *
 * Every control that opens a list — a select, the Voicing pick, a folding
 * section — draws this: the same stroked path the EQ toolbar's split buttons
 * carry, so a combo and a button that opens a menu say "opens" with one
 * glyph. They used to draw three different ones at three sizes: a filled
 * triangle, a hand-written chevron, and a chevron that pointed sideways and
 * swung down. `App.scss` sizes and colours it under `.chevron` and turns it
 * over while the list is open.
 */
const Chevron = ({ className = '' }: { className?: string }) => (
  <svg
    className={`chevron${className ? ` ${className}` : ''}`}
    viewBox="0 0 16 16"
    aria-hidden="true"
    focusable="false"
  >
    <path d="M4 6.5l4 4 4-4" />
  </svg>
);

export default Chevron;
