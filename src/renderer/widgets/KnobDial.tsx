/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

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
 * The ring the value runs in, standing clear of the body by a gap of the
 * pane (Ivan, 2026-09-27: "separate the arc from the control a bit").
 */
const RING_R = 30;
/** The skirt, and the cap standing on it a step lighter. */
const BODY_R = 22;
const CAP_R = 14.5;
/** The marks at the travel's ends and its rest, just outside the ring. */
const MARK_R = 35.4;

const pointAt = (share: number, radius: number) => {
  const angle = ((SWEEP_START_DEG + (share / 100) * SWEEP_DEG) * Math.PI) / 180;
  return {
    x: CENTRE + radius * Math.cos(angle),
    y: CENTRE + radius * Math.sin(angle),
  };
};

interface IRingProps {
  className: string;
  /** The stretch of the ring drawn; unset, it takes its group's. */
  dash?: string;
}

/**
 * One ring of the dial. Every one is the same circle turned onto the sweep's
 * start, so the well, the value and the pointer agree by construction.
 */
const Ring = ({ className, dash }: IRingProps) => (
  <circle
    className={className}
    cx={CENTRE}
    cy={CENTRE}
    r={RING_R}
    pathLength="100"
    strokeDasharray={dash}
    transform={`rotate(${SWEEP_START_DEG} ${CENTRE} ${CENTRE})`}
  />
);

/**
 * The knob itself: what every dial in this app is drawn as - the EQ page's,
 * the preamp, every DSP stage's, the band popover's, the player's tone (Ivan,
 * 2026-09-26: "I want you to update all nobs in the entire app").
 *
 * Flat (2026-11-17, the one control theme): the travel is a well bent into
 * a ring, its hairline round it, the value laid in it in the solid accent,
 * and the body is a skirt with a cap on it, both cut out by the dial's edge,
 * with a line of the accent across both for the pointer. Before that it was a matte body on a
 * side wall with a turned finish and a lit rim, the value a neon tube in four
 * layers of light round a glass channel, and a glowing pointer - the one
 * Ivan picked on 2026-09-27, until every other control in the app went flat
 * and the dials were the last thing on the page with light in them.
 *
 * Every colour is a class, so the theme's shade and a scene's tint reach it
 * through their variables. Nothing is printed on the body: the reading stands
 * under the knob (`KnobView`).
 */
const KnobDial = ({
  progress,
  arcStart,
  arcLength,
  showsArc,
  detents,
}: IKnobDialProps) => {
  const dash = `${(75 * arcLength) / 100} 100`;
  // Negative, because a dash pattern offset backwards begins that far along
  // the path - which is how the arc starts at the centre of a bipolar range
  // instead of at its low end.
  const offset = -(75 * arcStart) / 100;

  return (
    <svg className="knob__dial" viewBox="0 0 72 72" aria-hidden="true">
      {detents.map((at) => {
        const { x, y } = pointAt(at, MARK_R);
        return <circle key={at} className="knob__mark" cx={x} cy={y} r="1.1" />;
      })}
      {/* The well: its hairline, then the well itself a step narrower, so the
          hairline shows round it and round its two rounded ends alike. */}
      <Ring className="knob__well-edge" dash="75 25" />
      <Ring className="knob__well" dash="75 25" />
      {showsArc && (
        <g
          className="knob__value"
          strokeDasharray={dash}
          strokeDashoffset={offset}
        >
          <Ring className="knob__fill" />
        </g>
      )}
      <circle className="knob__skirt" cx={CENTRE} cy={CENTRE} r={BODY_R} />
      <circle className="knob__cap" cx={CENTRE} cy={CENTRE} r={CAP_R} />
      {/* Drawn along +x and turned onto the value, the same 135° plus the
          sweep the ring is turned by, so the pointer and the value always
          point at the same place. */}
      <g
        transform={`rotate(${SWEEP_START_DEG + (progress / 100) * SWEEP_DEG} ${CENTRE} ${CENTRE})`}
      >
        <rect
          className="knob__pointer"
          x={CENTRE + 6}
          y={CENTRE - 1.25}
          width="14"
          height="2.5"
          rx="1.25"
        />
      </g>
    </svg>
  );
};

export default KnobDial;
