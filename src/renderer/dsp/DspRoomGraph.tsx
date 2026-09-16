/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { PointerEvent as ReactPointerEvent, useRef } from 'react';
import { IRoomSettings, ROOM_SPEAKERS } from '../../common/dsp/chain';
import { TranslationKey } from '../../common/i18n/en';
import { useTranslation } from '../utils/I18nContext';

interface IDspRoomGraphProps {
  room: IRoomSettings;
  /**
   * Which speakers the stream playing right now feeds, FL FR C SL SR RL RR:
   * a stereo stream feeds the front pair and nothing else, and a speaker
   * that gets nothing is drawn asleep so moving it is not expected to be
   * heard. All seven while nothing is known.
   */
  fed: readonly boolean[];
  /** Whether the stream carries a subwoofer feed; drawn asleep without. */
  subFed: boolean;
  /** Said under the room while some speakers are asleep. */
  fedHintKey?: TranslationKey;
  /** A speaker being dragged; angles arrive one at a time, whole degrees. */
  onAngle: (speaker: number, angleDeg: number) => void;
  onCommit: () => void;
  isDisabled: boolean;
  /** Dragging is a Plus thing; the picture is not. */
  canDrag: boolean;
}

const SPEAKER_NAMES = ['FL', 'FR', 'C', 'SL', 'SR', 'RL', 'RR'];
const SIZE = 400;
const CENTRE = SIZE / 2;
/**
 * The walls always frame the picture; the room's size sets how far the ring
 * sits from them. The margin outside holds the size's dimension line.
 */
const WALL_HALF = CENTRE - 26;
const RING_MIN = 58;
/** Leaves the labels outside the ring their own room inside the wall. */
const RING_MAX = WALL_HALF - 40;

const clamp = (value: number, low: number, high: number) =>
  Math.min(high, Math.max(low, value));

const metres = (value: number) => `${value.toFixed(1)} m`;

/**
 * Where the distance is measured: the middle of the widest gap between
 * speakers, so the line never runs under one however they are arranged.
 */
const emptiestAngle = (angles: readonly number[]): number => {
  const sorted = angles
    .map((angle) => ((angle % 360) + 360) % 360)
    .sort((a, b) => a - b);
  let bestStart = sorted[sorted.length - 1];
  let bestGap = sorted[0] + 360 - bestStart;
  for (let at = 1; at < sorted.length; at += 1) {
    const gap = sorted[at] - sorted[at - 1];
    if (gap > bestGap) {
      bestGap = gap;
      bestStart = sorted[at - 1];
    }
  }
  return bestStart + bestGap / 2;
};

/**
 * The room from above: the walls frame the picture, the listener sits in the
 * middle, and the speakers stand on a ring whose distance from the walls is
 * the room's size against the speakers' distance — a big room puts the ring
 * well inside the walls, a small one puts the speakers against them. The
 * walls fade as they absorb and shine a little while they are hard; the
 * room's side is measured along the bottom wall and the speakers' distance
 * behind the listener, in metres, so the dials and the picture agree. Every
 * speaker can be taken by the pointer and walked around the ring; the radius
 * is the Distance dial's, so a drag only changes the angle.
 */
const DspRoomGraph = ({
  room,
  fed,
  subFed,
  fedHintKey,
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
  const wallAlpha = 0.16 + (1 - room.walls) * 0.6;
  const shineAlpha = (1 - room.walls) * 0.3;

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
      // An asleep speaker stays where it is: a drag nobody can hear is a
      // drag that looks broken.
      if (isDisabled || !canDrag || !fed[speaker]) {
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

  const wallLeft = CENTRE - WALL_HALF;
  const wallRight = CENTRE + WALL_HALF;
  const wallTop = CENTRE - WALL_HALF;
  const wallBottom = CENTRE + WALL_HALF;
  const sizeLineY = wallBottom + 14;
  const subGlow = subFed ? clamp((room.subDb + 12) / 24, 0, 1) : 0;
  const distanceAngle = emptiestAngle(room.angles);
  const distanceStart = polar(distanceAngle, 24);
  const distanceEnd = polar(distanceAngle, ring - 4);
  const distanceMid = polar(distanceAngle, ring / 2 + 10);
  const speakers = Array.from({ length: ROOM_SPEAKERS }, (_unused, at) => {
    const angle = room.angles[at];
    return {
      at,
      angle,
      point: polar(angle, ring),
      label: polar(angle, ring + 28),
      glow: fed[at] ? clamp((room.levels[at] + 24) / 24, 0, 1) : 0,
      asleep: !fed[at],
    };
  });

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
          x={wallLeft}
          y={wallTop}
          width={WALL_HALF * 2}
          height={WALL_HALF * 2}
          rx={16}
          fill="url(#dsp-room-floor)"
        />
        {/* Hard walls shine back into the room; absorbing ones do not. */}
        <rect
          className="dsp-room-shine"
          x={wallLeft + 5}
          y={wallTop + 5}
          width={WALL_HALF * 2 - 10}
          height={WALL_HALF * 2 - 10}
          rx={12}
          style={{ strokeOpacity: shineAlpha }}
        />
        <rect
          className="dsp-room-walls"
          x={wallLeft}
          y={wallTop}
          width={WALL_HALF * 2}
          height={WALL_HALF * 2}
          rx={16}
          style={{ strokeOpacity: wallAlpha }}
        />
        {/* Front: named above the top wall, where the head's nose points. */}
        <text
          className="dsp-room-front"
          x={CENTRE}
          y={wallTop - 9}
          textAnchor="middle"
        >
          {t('dsp.room.front')}
        </text>
        <circle className="dsp-room-ring" cx={CENTRE} cy={CENTRE} r={ring} />
        {/* The speakers' distance, measured straight behind the listener. */}
        <g className="dsp-room-measure">
          <line
            x1={distanceStart.x}
            y1={distanceStart.y}
            x2={distanceEnd.x}
            y2={distanceEnd.y}
          />
          <text
            className="dsp-room-measure-size"
            x={distanceMid.x}
            y={distanceMid.y + 3.5}
            textAnchor="middle"
          >
            {metres(room.distanceM)}
          </text>
        </g>
        {/* The room's side, along the bottom wall. */}
        <g className="dsp-room-measure">
          <line x1={wallLeft} y1={sizeLineY} x2={wallRight} y2={sizeLineY} />
          <line
            x1={wallLeft}
            y1={sizeLineY - 4}
            x2={wallLeft}
            y2={sizeLineY + 4}
          />
          <line
            x1={wallRight}
            y1={sizeLineY - 4}
            x2={wallRight}
            y2={sizeLineY + 4}
          />
          <text
            className="dsp-room-measure-size"
            x={CENTRE}
            y={sizeLineY + 4}
            textAnchor="middle"
          >
            {metres(room.sizeM)}
          </text>
        </g>
        {/* Each speaker's direct path to the head, brighter the louder it is. */}
        {speakers.map(({ at, point, glow, asleep }) => (
          <line
            key={SPEAKER_NAMES[at]}
            className="dsp-room-path"
            x1={CENTRE}
            y1={CENTRE}
            x2={point.x}
            y2={point.y}
            style={{ opacity: asleep ? 0.03 : 0.06 + glow * 0.22 }}
          />
        ))}
        {/* Asleep ones first, so an awake speaker standing on top of one is
            the one drawn on top and the one the pointer takes. */}
        {[...speakers]
          .sort((a, b) => Number(b.asleep) - Number(a.asleep))
          .map(({ at, angle, point, label, glow, asleep }) => (
            <g
              key={SPEAKER_NAMES[at]}
              className={`dsp-room-speaker${
                canDrag && !isDisabled && !asleep ? ' can-drag' : ''
              }${asleep ? ' is-asleep' : ''}`}
              onPointerDown={onPointerDown(at)}
              onPointerMove={onPointerMove}
              onPointerUp={onPointerUp}
              onPointerCancel={onPointerUp}
            >
              <circle
                className="dsp-room-speaker-glow"
                cx={point.x}
                cy={point.y}
                r={14 + glow * 12}
                style={{ opacity: 0.18 + glow * 0.42 }}
              />
              <g
                transform={`translate(${point.x} ${point.y}) rotate(${
                  angle + 180
                })`}
              >
                <rect
                  className="dsp-room-speaker-box"
                  x={-11}
                  y={-16}
                  width={22}
                  height={32}
                  rx={5}
                />
                <circle className="dsp-room-speaker-driver" cy={5} r={5.5} />
                <circle className="dsp-room-speaker-tweeter" cy={-7} r={2.5} />
              </g>
              <text
                className="dsp-room-speaker-name"
                x={label.x}
                y={label.y + 3.5}
                textAnchor="middle"
              >
                {SPEAKER_NAMES[at]}
              </text>
            </g>
          ))}
        {/* The sub: on the floor by the front wall, where subs live. It has
            no direction and no place on the ring, so it is not dragged; its
            glow is the Sub dial's, and it sleeps while the stream has no
            subwoofer feed. */}
        <g
          className={`dsp-room-sub${subFed ? '' : ' is-asleep'}`}
          transform={`translate(${wallLeft + 44} ${wallTop + 44})`}
        >
          <circle
            className="dsp-room-speaker-glow"
            r={14 + subGlow * 12}
            style={{ opacity: subFed ? 0.18 + subGlow * 0.42 : 0 }}
          />
          <rect
            className="dsp-room-speaker-box"
            x={-15}
            y={-15}
            width={30}
            height={30}
            rx={5}
          />
          <circle className="dsp-room-speaker-driver" cy={1} r={8.5} />
          <circle className="dsp-room-speaker-tweeter" cx={9} cy={-9} r={2} />
          <text className="dsp-room-speaker-name" y={28} textAnchor="middle">
            SUB
          </text>
        </g>
        <g
          className="dsp-room-head"
          transform={`translate(${CENTRE} ${CENTRE})`}
        >
          <ellipse rx={15} ry={18} />
          <path d="M-9 -20 L0 -28 L9 -20" />
          <circle cx={-16} cy={0} r={4} />
          <circle cx={16} cy={0} r={4} />
        </g>
      </svg>
      <p className="dsp-room-graph-hint">
        {t(canDrag ? 'dsp.room.dragHint' : 'dsp.room.plusDragHint')}
      </p>
      {fedHintKey !== undefined ? (
        <p className="dsp-room-graph-fed" role="status">
          {t(fedHintKey)}
        </p>
      ) : undefined}
    </div>
  );
};

export default DspRoomGraph;
