/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * Two small pictures for the Room's Sound rows, drawn from the settings so
 * a dial is seen as well as read: where the crossover splits the bass from
 * the speakers, and which speakers the music upmix lights.
 */

interface IRoomCrossoverGlyphProps {
  crossoverHz: number;
  isManaged: boolean;
}

const GLYPH_WIDTH = 84;
const GLYPH_HEIGHT = 30;
const HZ_MIN = 40;
const HZ_MAX = 200;

/** The crossover's place along the glyph, 40 Hz at the left, 200 at the right. */
const crossoverX = (hz: number) =>
  8 +
  ((Math.log(Math.min(HZ_MAX, Math.max(HZ_MIN, hz))) - Math.log(HZ_MIN)) /
    (Math.log(HZ_MAX) - Math.log(HZ_MIN))) *
    (GLYPH_WIDTH - 16);

/**
 * The split: the sub's low band on the left, the speakers' band on the right,
 * meeting where the crossover sits. Full range draws one band across.
 */
export const RoomCrossoverGlyph = ({
  crossoverHz,
  isManaged,
}: IRoomCrossoverGlyphProps) => {
  const x = crossoverX(crossoverHz);
  const top = 6;
  const bottom = GLYPH_HEIGHT - 5;
  const knee = 10;
  const low = `M2 ${top} H${x - knee} C${x - 2} ${top} ${x - 2} ${bottom} ${
    x + knee
  } ${bottom} H${GLYPH_WIDTH - 2}`;
  const high = `M2 ${bottom} H${x - knee} C${x - 2} ${bottom} ${x - 2} ${top} ${
    x + knee
  } ${top} H${GLYPH_WIDTH - 2}`;
  return (
    <svg
      className={`dsp-room-glyph dsp-room-glyph--crossover${
        isManaged ? '' : ' is-flat'
      }`}
      viewBox={`0 0 ${GLYPH_WIDTH} ${GLYPH_HEIGHT}`}
      aria-hidden="true"
    >
      <line
        className="dsp-room-glyph__floor"
        x1={2}
        y1={bottom}
        x2={GLYPH_WIDTH - 2}
        y2={bottom}
      />
      {isManaged ? (
        <>
          <path className="dsp-room-glyph__low" d={low} />
          <path className="dsp-room-glyph__high" d={high} />
          <line
            className="dsp-room-glyph__mark"
            x1={x}
            y1={top - 3}
            x2={x}
            y2={bottom + 2}
          />
        </>
      ) : (
        <path
          className="dsp-room-glyph__high"
          d={`M2 ${top} H${GLYPH_WIDTH - 2}`}
        />
      )}
    </svg>
  );
};

interface IRoomRingGlyphProps {
  isFilled: boolean;
  amount: number;
}

const RING_SIZE = 34;
const RING_CENTRE = RING_SIZE / 2;
const RING_RADIUS = 12;
/** FL FR C SL SR RL RR, as on the card. */
const RING_ANGLES = [-30, 30, 0, -100, 100, -140, 140];

/**
 * The ring of seven: the front pair always lit, the other five lit by the
 * amount while the room is filled and hollow while music stays in front.
 */
export const RoomRingGlyph = ({ isFilled, amount }: IRoomRingGlyphProps) => (
  <svg
    className="dsp-room-glyph dsp-room-glyph--ring"
    viewBox={`0 0 ${RING_SIZE} ${RING_SIZE}`}
    aria-hidden="true"
  >
    <circle
      className="dsp-room-glyph__ring"
      cx={RING_CENTRE}
      cy={RING_CENTRE}
      r={RING_RADIUS}
    />
    {RING_ANGLES.map((angle, at) => {
      const radians = (angle * Math.PI) / 180;
      const lit = at < 2 || isFilled;
      return (
        <circle
          key={angle}
          className={`dsp-room-glyph__dot${lit ? ' is-lit' : ''}`}
          cx={RING_CENTRE + RING_RADIUS * Math.sin(radians)}
          cy={RING_CENTRE - RING_RADIUS * Math.cos(radians)}
          r={2.6}
          style={
            at >= 2 && isFilled
              ? { opacity: 0.35 + Math.min(1, Math.max(0, amount)) * 0.65 }
              : undefined
          }
        />
      );
    })}
    <circle
      className="dsp-room-glyph__head"
      cx={RING_CENTRE}
      cy={RING_CENTRE}
      r={3}
    />
  </svg>
);
