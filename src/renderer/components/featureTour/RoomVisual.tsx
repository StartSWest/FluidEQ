/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026> <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { useTranslation } from '../../utils/I18nContext';

/**
 * The Room, as the card draws it: a room from above, seven speakers on a
 * ring around a head, the sub by the front wall, each speaker's path to the
 * ears. Drawn here rather than captured so the words are the reader's and
 * the picture stays sharp from a 1440-wide window to a 4K one.
 */
const SIZE = 400;
const CENTRE = SIZE / 2;
const WALL_HALF = 166;
const RING = 118;
const SPEAKERS: { name: string; angle: number }[] = [
  { name: 'FL', angle: -30 },
  { name: 'FR', angle: 30 },
  { name: 'C', angle: 0 },
  { name: 'SL', angle: -100 },
  { name: 'SR', angle: 100 },
  { name: 'RL', angle: -140 },
  { name: 'RR', angle: 140 },
];

const polar = (angleDeg: number, radius: number) => {
  const radians = (angleDeg * Math.PI) / 180;
  return {
    x: CENTRE + radius * Math.sin(radians),
    y: CENTRE - radius * Math.cos(radians),
  };
};

export default function RoomVisual() {
  const { t } = useTranslation();
  const wallLeft = CENTRE - WALL_HALF;
  const wallTop = CENTRE - WALL_HALF;
  return (
    <svg
      className="room-visual"
      viewBox={`0 0 ${SIZE} ${SIZE}`}
      role="img"
      aria-label={t('tour.room.imageAlt')}
    >
      <defs>
        <radialGradient id="room-visual-floor" cx="50%" cy="50%" r="62%">
          <stop offset="0" className="room-visual__floor-in" />
          <stop offset="1" className="room-visual__floor-out" />
        </radialGradient>
        <filter
          id="room-visual-glow"
          x="-60%"
          y="-60%"
          width="220%"
          height="220%"
        >
          <feGaussianBlur stdDeviation="7" />
        </filter>
      </defs>
      <rect
        className="room-visual__floor"
        x={wallLeft}
        y={wallTop}
        width={WALL_HALF * 2}
        height={WALL_HALF * 2}
        rx={18}
        fill="url(#room-visual-floor)"
      />
      <rect
        className="room-visual__shine"
        x={wallLeft + 6}
        y={wallTop + 6}
        width={WALL_HALF * 2 - 12}
        height={WALL_HALF * 2 - 12}
        rx={14}
      />
      <rect
        className="room-visual__walls"
        x={wallLeft}
        y={wallTop}
        width={WALL_HALF * 2}
        height={WALL_HALF * 2}
        rx={18}
      />
      <text
        className="room-visual__front"
        x={CENTRE}
        y={wallTop - 10}
        textAnchor="middle"
      >
        {t('dsp.room.front')}
      </text>
      <circle className="room-visual__ring" cx={CENTRE} cy={CENTRE} r={RING} />
      {SPEAKERS.map(({ name, angle }) => {
        const point = polar(angle, RING);
        return (
          <line
            key={`path-${name}`}
            className="room-visual__path"
            x1={CENTRE}
            y1={CENTRE}
            x2={point.x}
            y2={point.y}
          />
        );
      })}
      {/* The sub, by the front wall. */}
      <g
        className="room-visual__speaker"
        transform={`translate(${wallLeft + 40} ${wallTop + 40})`}
      >
        <circle
          className="room-visual__glow"
          r={20}
          filter="url(#room-visual-glow)"
        />
        <rect
          className="room-visual__box"
          x={-14}
          y={-14}
          width={28}
          height={28}
          rx={5}
        />
        <circle className="room-visual__driver" cy={1} r={8} />
        <circle className="room-visual__tweeter" cx={8} cy={-8} r={2} />
        <text className="room-visual__name" y={27} textAnchor="middle">
          SUB
        </text>
      </g>
      {SPEAKERS.map(({ name, angle }) => {
        const point = polar(angle, RING);
        const label = polar(angle, RING + 27);
        return (
          <g key={name} className="room-visual__speaker">
            <circle
              className="room-visual__glow"
              cx={point.x}
              cy={point.y}
              r={22}
              filter="url(#room-visual-glow)"
            />
            <g
              transform={`translate(${point.x} ${point.y}) rotate(${angle + 180})`}
            >
              <rect
                className="room-visual__box"
                x={-11}
                y={-16}
                width={22}
                height={32}
                rx={5}
              />
              <circle className="room-visual__driver" cy={5} r={5.5} />
              <circle className="room-visual__tweeter" cy={-7} r={2.5} />
            </g>
            <text
              className="room-visual__name"
              x={label.x}
              y={label.y + 3.5}
              textAnchor="middle"
            >
              {name}
            </text>
          </g>
        );
      })}
      <g
        className="room-visual__head"
        transform={`translate(${CENTRE} ${CENTRE})`}
      >
        <ellipse rx={15} ry={18} />
        <path d="M-9 -20 L0 -28 L9 -20" />
        <circle cx={-16} cy={0} r={4} />
        <circle cx={16} cy={0} r={4} />
      </g>
    </svg>
  );
}
