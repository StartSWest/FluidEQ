/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { useId } from 'react';

interface IKnobDialProps {
  /** Where the dial stands, 0 to 100 (`dialGesture`). */
  progress: number;
  /** Where the lit arc starts and how far it runs, in the same hundred. */
  arcStart: number;
  arcLength: number;
  showsArc: boolean;
  /** Where the dial's marks stand round the scale, 0 to 100 of its sweep. */
  detents: readonly number[];
}

/** The sweep runs 270° from the lower left. */
const SWEEP_START_DEG = 135;
const SWEEP_DEG = 270;
const CENTRE = 36;
/**
 * The tube stands clear of the body, a gap of the pane between them (Ivan,
 * 2026-09-27: "separate the arc from the control a bit").
 */
const TUBE_R = 30.2;
const BODY_R = 25;
/** The beads at the travel's ends and its rest, just outside the tube. */
const BEAD_R = 35.6;
/**
 * The lit tube, drawn from its widest and faintest light to its white core
 * (`Knob.scss` gives each its width and strength).
 */
const NEON_LAYERS = ['far', 'near', 'tube', 'core'] as const;

const pointAt = (share: number, radius: number) => {
  const angle = ((SWEEP_START_DEG + (share / 100) * SWEEP_DEG) * Math.PI) / 180;
  return {
    x: CENTRE + radius * Math.cos(angle),
    y: CENTRE + radius * Math.sin(angle),
  };
};

interface ITubeRingProps {
  className: string;
  /** The stretch of the ring drawn; unset, it takes its group's. */
  dash?: string;
}

/**
 * One ring of the tube. Every one is the same circle turned onto the sweep's
 * start, so the glass, the light and the pointer agree by construction.
 */
const TubeRing = ({ className, dash }: ITubeRingProps) => (
  <circle
    className={className}
    cx={CENTRE}
    cy={CENTRE}
    r={TUBE_R}
    pathLength="100"
    strokeDasharray={dash}
    transform={`rotate(${SWEEP_START_DEG} ${CENTRE} ${CENTRE})`}
  />
);

/**
 * The knob itself: what every dial in this app is drawn as — the EQ page's,
 * the preamp, every DSP stage's, the player's tone (Ivan, 2026-09-26: "I want
 * you to update all nobs in the entire app").
 *
 * The one Ivan picked on 2026-09-27 from five after real gear (the RME
 * ADI-2's matte knob with its ring of light) and then from three ways of
 * making it neon ("make it better, like a neon"): a matte body standing on
 * its side wall, and the value as a lit tube hugging it — a white core, the
 * accent round it, a soft light round that — with a short neon line on the
 * body for the pointer and a glass bead at each place it can stand. The unlit
 * rest of the tube is glass, so the travel reads at rest as well.
 *
 * The light is painted in layers rather than filtered: a filter on a dial
 * that redraws on every pixel of a drag is repainted with it, and a page of
 * them is a page of filters. Every colour is a class, so the theme's shade
 * and a scene's tint reach it through their variables. Nothing is printed on
 * the body: the reading stands under the knob (`KnobView`).
 */
const KnobDial = ({
  progress,
  arcStart,
  arcLength,
  showsArc,
  detents,
}: IKnobDialProps) => {
  // SVG gradient ids are document-global and a page holds many of these; a
  // fixed one would have the second paint itself with the first one's light.
  const ids = useId();
  const dash = `${(75 * arcLength) / 100} 100`;
  // Negative, because a dash pattern offset backwards begins that far along
  // the path — which is how the arc starts at the centre of a bipolar range
  // instead of at its low end.
  const offset = -(75 * arcStart) / 100;

  return (
    <svg className="knob__dial" viewBox="0 0 72 72" aria-hidden="true">
      <defs>
        <linearGradient id={`${ids}-body`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" className="knob__stop--body-lit" />
          <stop offset="1" className="knob__stop--body-foot" />
        </linearGradient>
        {/* The light catching the body's upper rim, gone by its foot. */}
        <linearGradient id={`${ids}-rim`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" className="knob__stop--rim" />
          <stop offset="0.6" className="knob__stop--rim" stopOpacity="0" />
        </linearGradient>
        {/* The matte top's turned finish: fine rings, barely there. */}
        <radialGradient
          id={`${ids}-turned`}
          cx="50%"
          cy="50%"
          r="5%"
          spreadMethod="repeat"
        >
          <stop offset="0" className="knob__stop--turned" stopOpacity="0" />
          <stop offset="0.5" className="knob__stop--turned" />
          <stop offset="1" className="knob__stop--turned" stopOpacity="0" />
        </radialGradient>
      </defs>
      {detents.map((at) => {
        const { x, y } = pointAt(at, BEAD_R);
        return (
          <circle key={at} className="knob__bead" cx={x} cy={y} r="1.25" />
        );
      })}
      <TubeRing className="knob__channel" dash="75 25" />
      <TubeRing className="knob__glass" dash="75 25" />
      <TubeRing className="knob__glass-line" dash="75 25" />
      {/* The lit stretch is the group's, and its four layers of light take
          it from there: one arc, however many strokes it is drawn in. */}
      {showsArc && (
        <g
          className="knob__value"
          strokeDasharray={dash}
          strokeDashoffset={offset}
        >
          {NEON_LAYERS.map((layer) => (
            <TubeRing
              key={layer}
              className={`knob__neon knob__neon--${layer}`}
            />
          ))}
        </g>
      )}
      {/* The edge's own colour, softly, under the wall and the body: their
          outline feathered outwards. */}
      <circle
        className="knob__edge-glow"
        cx={CENTRE}
        cy={CENTRE + 2.2}
        r={BODY_R}
      />
      <circle className="knob__edge-glow" cx={CENTRE} cy={CENTRE} r={BODY_R} />
      <circle className="knob__wall" cx={CENTRE} cy={CENTRE + 2.2} r={BODY_R} />
      <circle
        className="knob__body"
        cx={CENTRE}
        cy={CENTRE}
        r={BODY_R}
        fill={`url(#${ids}-body)`}
      />
      <circle
        cx={CENTRE}
        cy={CENTRE}
        r={BODY_R - 0.7}
        fill={`url(#${ids}-turned)`}
      />
      {/* The outline itself: a soft band on the body's edge, not a line. */}
      <circle className="knob__edge" cx={CENTRE} cy={CENTRE} r={BODY_R} />
      <circle
        className="knob__rim"
        cx={CENTRE}
        cy={CENTRE}
        r={BODY_R - 0.9}
        stroke={`url(#${ids}-rim)`}
      />
      {/* Drawn along +x and turned onto the value, the same 135° plus the
          sweep the tube is turned by, so the pointer and the light always
          point at the same place. */}
      <g
        transform={`rotate(${SWEEP_START_DEG + (progress / 100) * SWEEP_DEG} ${CENTRE} ${CENTRE})`}
      >
        <rect
          className="knob__pointer-glow"
          x={CENTRE + 12.4}
          y={CENTRE - 2.6}
          width="10.2"
          height="5.2"
          rx="2.6"
        />
        <rect
          className="knob__pointer"
          x={CENTRE + 13.4}
          y={CENTRE - 1.2}
          width="8.2"
          height="2.4"
          rx="1.2"
        />
        <rect
          className="knob__pointer-core"
          x={CENTRE + 14.2}
          y={CENTRE - 0.5}
          width="6.6"
          height="1"
          rx="0.5"
        />
      </g>
    </svg>
  );
};

export default KnobDial;
