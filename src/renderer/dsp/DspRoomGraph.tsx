/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { PointerEvent as ReactPointerEvent, useRef } from 'react';
import { IRoomSettings, ROOM_SPEAKERS } from '../../common/dsp/chain';
import { useTranslation } from '../utils/I18nContext';

interface IDspRoomGraphProps {
  room: IRoomSettings;
  /** A speaker being dragged; angles arrive one at a time, whole degrees. */
  onAngle: (speaker: number, angleDeg: number) => void;
  onCommit: () => void;
  isDisabled: boolean;
  /** Dragging is a Plus thing; the picture is not. */
  canDrag: boolean;
}

const SPEAKER_NAMES = ['FL', 'FR', 'C', 'SL', 'SR', 'RL', 'RR'];
const SIZE = 320;
const CENTRE = SIZE / 2;
/** The walls always frame the picture; the room's size sets how far the ring sits from them. */
const WALL_HALF = CENTRE - 22;
const RING_MIN = 46;
const RING_MAX = WALL_HALF - 26;

const clamp = (value: number, low: number, high: number) =>
  Math.min(high, Math.max(low, value));

/**
 * The room from above: the walls frame the picture, the listener sits in the
 * middle, and the speakers stand on a ring whose distance from the walls is
 * the room's size against the speakers' distance — a big room puts the ring
 * well inside the walls, a small one puts the speakers against them. The
 * walls fade as they absorb. Every speaker can be taken by the pointer and
 * walked around the ring; the radius is the Distance dial's, so a drag only
 * changes the angle.
 */
const DspRoomGraph = ({
  room,
  onAngle,
  onCommit,
  isDisabled,
  canDrag,
}: IDspRoomGraphProps) => {
  const { t } = useTranslation();
  const svgRef = useRef<SVGSVGElement | null>(null);
  const dragging = useRef<number | null>(null);
  const ring = clamp(
    (room.distanceM / (room.sizeM / 2)) * WALL_HALF,
    RING_MIN,
    RING_MAX,
  );
  const wallAlpha = 0.14 + (1 - room.walls) * 0.55;

  const polar = (angleDeg: number, radius: number) => {
    const radians = (angleDeg * Math.PI) / 180;
    return {
      x: CENTRE + radius * Math.sin(radians),
      y: CENTRE - radius * Math.cos(radians),
    };
  };

  const angleAt = (event: ReactPointerEvent<SVGElement>): number => {
    const svg = svgRef.current;
    if (!svg) {
      return 0;
    }
    const box = svg.getBoundingClientRect();
    const x = ((event.clientX - box.left) / box.width) * SIZE - CENTRE;
    const y = ((event.clientY - box.top) / box.height) * SIZE - CENTRE;
    return Math.round((Math.atan2(x, -y) * 180) / Math.PI);
  };

  const onPointerDown =
    (speaker: number) => (event: ReactPointerEvent<SVGElement>) => {
      if (isDisabled || !canDrag) {
        return;
      }
      dragging.current = speaker;
      event.currentTarget.setPointerCapture(event.pointerId);
    };
  const onPointerMove = (event: ReactPointerEvent<SVGElement>) => {
    if (dragging.current === null) {
      return;
    }
    onAngle(dragging.current, angleAt(event));
  };
  const onPointerUp = (event: ReactPointerEvent<SVGElement>) => {
    if (dragging.current === null) {
      return;
    }
    event.currentTarget.releasePointerCapture(event.pointerId);
    dragging.current = null;
    onCommit();
  };

  return (
    <div className={`dsp-room-graph${isDisabled ? ' is-off' : ''}`}>
      <svg
        ref={svgRef}
        className="dsp-room-svg"
        viewBox={`0 0 ${SIZE} ${SIZE}`}
        role="img"
        aria-label={t('dsp.room.graphLabel')}
      >
        <defs>
          <radialGradient id="dsp-room-floor" cx="50%" cy="50%" r="62%">
            <stop offset="0" className="dsp-room-floor-in" />
            <stop offset="1" className="dsp-room-floor-out" />
          </radialGradient>
        </defs>
        <rect
          className="dsp-room-floor"
          x={CENTRE - WALL_HALF}
          y={CENTRE - WALL_HALF}
          width={WALL_HALF * 2}
          height={WALL_HALF * 2}
          rx={14}
          fill="url(#dsp-room-floor)"
        />
        <rect
          className="dsp-room-walls"
          x={CENTRE - WALL_HALF}
          y={CENTRE - WALL_HALF}
          width={WALL_HALF * 2}
          height={WALL_HALF * 2}
          rx={14}
          style={{ strokeOpacity: wallAlpha }}
        />
        <circle className="dsp-room-ring" cx={CENTRE} cy={CENTRE} r={ring} />
        <line
          className="dsp-room-axis"
          x1={CENTRE}
          y1={CENTRE - WALL_HALF + 6}
          x2={CENTRE}
          y2={CENTRE - ring}
        />
        {Array.from({ length: ROOM_SPEAKERS }, (_unused, speaker) => {
          const angle = room.angles[speaker];
          const { x, y } = polar(angle, ring);
          const label = polar(angle, ring + 24);
          const level = room.levels[speaker];
          const glow = clamp((level + 24) / 24, 0, 1);
          return (
            <g
              key={SPEAKER_NAMES[speaker]}
              className={`dsp-room-speaker${
                canDrag && !isDisabled ? ' can-drag' : ''
              }`}
              onPointerDown={onPointerDown(speaker)}
              onPointerMove={onPointerMove}
              onPointerUp={onPointerUp}
              onPointerCancel={onPointerUp}
            >
              <circle
                className="dsp-room-speaker-glow"
                cx={x}
                cy={y}
                r={12 + glow * 10}
                style={{ opacity: 0.18 + glow * 0.42 }}
              />
              <g transform={`translate(${x} ${y}) rotate(${angle + 180})`}>
                <rect
                  className="dsp-room-speaker-box"
                  x={-9}
                  y={-13}
                  width={18}
                  height={26}
                  rx={4}
                />
                <circle className="dsp-room-speaker-driver" cy={4} r={4.5} />
                <circle className="dsp-room-speaker-tweeter" cy={-6} r={2} />
              </g>
              <text
                className="dsp-room-speaker-name"
                x={label.x}
                y={label.y + 3}
                textAnchor="middle"
              >
                {SPEAKER_NAMES[speaker]}
              </text>
            </g>
          );
        })}
        <g
          className="dsp-room-head"
          transform={`translate(${CENTRE} ${CENTRE})`}
        >
          <ellipse rx={13} ry={16} />
          <path d="M-8 -18 L0 -25 L8 -18" />
          <circle cx={-14} cy={0} r={3.5} />
          <circle cx={14} cy={0} r={3.5} />
        </g>
      </svg>
      <p className="dsp-room-graph-hint">
        {t(canDrag ? 'dsp.room.dragHint' : 'dsp.room.plusDragHint')}
      </p>
    </div>
  );
};

export default DspRoomGraph;
