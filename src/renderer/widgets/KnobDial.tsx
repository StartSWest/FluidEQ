/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { ReactNode, useId } from 'react';

interface IKnobDialProps {
  /** Where the dial stands, 0 to 100 (`dialGesture`). */
  progress: number;
  /** Where the lit arc starts and how far it runs, in the same hundred. */
  arcStart: number;
  arcLength: number;
  showsArc: boolean;
  /** What sits in the middle of the disc, if anything: a face and a number. */
  children?: ReactNode;
}

/**
 * The disc itself: what every knob in this app is drawn as.
 *
 * Slate, like everything else in the window. This was a turned aluminium knob
 * — a near-white body lit from the upper left, a chrome bevel, a black face —
 * and it was the one piece of metal in a flat blue interface: the eye went to
 * it before the EQ. The body is now the field rung of the same ladder every
 * control uses, one step lighter than the card, with the faintest top light
 * so it still reads as a disc rather than a printed circle. Only the pointer
 * and the arc carry colour, which is the part that means something.
 *
 * A big body under a thin bright ring, the ring held off the rim by a hair of
 * unlit panel (Ivan, 2026-09-21): the small body inside a thick far arc it
 * used to be read as a gauge with a knob in the middle of it rather than as
 * a knob.
 */
const KnobDial = ({
  progress,
  arcStart,
  arcLength,
  showsArc,
  children,
}: IKnobDialProps) => {
  // Two knobs can be on screen at once — a band's Q and the preamp — and SVG
  // gradient ids are document-global, so a fixed one would have the second
  // silently paint itself with the first one's metal.
  const ids = useId();

  return (
    <svg className="knob__dial" viewBox="0 0 72 72" aria-hidden="true">
      <defs>
        <radialGradient id={`${ids}-body`} cx="38%" cy="28%" r="80%">
          <stop offset="0%" className="knob__stop--body-top" />
          <stop offset="70%" className="knob__stop--body-mid" />
          <stop offset="100%" className="knob__stop--body-edge" />
        </radialGradient>
        {/* What the body casts on the panel: a soft ring of shade around its
            foot, the way one light from above leaves it. Painted rather than
            filtered — a filter on a dial that redraws on every pixel of a
            drag is repainted with it, and a page of them is a page of
            filters. */}
        <radialGradient id={`${ids}-cast`} cx="50%" cy="50%" r="50%">
          <stop offset="72%" className="knob__stop--cast" />
          <stop offset="100%" className="knob__stop--cast" stopOpacity="0" />
        </radialGradient>
        <linearGradient id={`${ids}-bevel`} x1="0" y1="0" x2="0" y2="1">
          {/* Mist above, mist below. The lower stop was black at 30%, which
              on a navy body is not a shaded edge — it is a dark ring drawn
              round the knob, and it read as a hole the knob sat in. */}
          <stop offset="0%" className="knob__stop--mist" stopOpacity="0.24" />
          <stop offset="55%" className="knob__stop--mist" stopOpacity="0.05" />
          <stop offset="100%" className="knob__stop--mist" stopOpacity="0.1" />
        </linearGradient>
      </defs>
      <circle
        className="knob__cast"
        cx="36"
        cy="37.5"
        r="31"
        fill={`url(#${ids}-cast)`}
      />
      <circle
        className="knob__track"
        cx="36"
        cy="36"
        r="32"
        pathLength="100"
        strokeDasharray="75 25"
        transform="rotate(135 36 36)"
      />
      {showsArc ? (
        <circle
          className="knob__value"
          cx="36"
          cy="36"
          r="32"
          pathLength="100"
          strokeDasharray={`${(75 * arcLength) / 100} 100`}
          // Negative, because a dash pattern offset backwards begins that
          // far along the path — which is how the arc starts at the centre
          // of a bipolar range instead of at its low end.
          strokeDashoffset={-(75 * arcStart) / 100}
          transform="rotate(135 36 36)"
        />
      ) : undefined}
      <circle
        className="knob__body"
        cx="36"
        cy="36"
        r="27"
        fill={`url(#${ids}-body)`}
      />
      <circle className="knob__rim" cx="36" cy="36" r="26.6" />
      <circle
        className="knob__bevel"
        cx="36"
        cy="36"
        r="25.8"
        stroke={`url(#${ids}-bevel)`}
      />
      {/* Drawn along the +x axis and rotated onto the value, which is the
          same 135°-plus-sweep the arcs above are rotated by — so the pointer
          and the filled arc always point at the same place by construction
          rather than by two calculations agreeing. */}
      <g transform={`rotate(${135 + (progress / 100) * 270} 36 36)`}>
        {/* A faint groove under the pointer, so the lit line has an edge to
            sit in rather than floating on the disc. */}
        <line className="knob__notch-groove" x1="53" y1="36" x2="60" y2="36" />
        <line className="knob__notch" x1="53" y1="36" x2="60" y2="36" />
      </g>
      {children}
    </svg>
  );
};

export default KnobDial;
