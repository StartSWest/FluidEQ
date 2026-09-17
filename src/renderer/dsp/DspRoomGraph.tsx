/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { PointerEvent as ReactPointerEvent, ReactNode, useRef } from 'react';
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
  /** FL FR C SL SR RL RR then the sub: drawn muted, still selectable. */
  mutes: readonly boolean[];
  /** The speaker whose panel is open, if any; the sub is 'sub'. */
  selected: TRoomPick | null;
  /** A press without a drag: the speaker (or the sub) to set, or nothing. */
  onSelect: (which: TRoomPick | null) => void;
  /** The panel for the selected speaker, drawn under the picture. */
  children?: ReactNode;
  /** A speaker being dragged; angles arrive one at a time, whole degrees. */
  /**
   * A drag. `mirrored` is the plain drag: the speaker's pair goes with it,
   * mirrored across the front. Shift or Ctrl held makes it false and the
   * speaker moves alone.
   */
  onAngle: (speaker: number, angleDeg: number, mirrored: boolean) => void;
  onCommit: () => void;
  isDisabled: boolean;
  /** Dragging is a Plus thing; the picture is not. */
  canDrag: boolean;
}

export type TRoomPick = number | 'sub';

const SPEAKER_NAMES = ['FL', 'FR', 'C', 'SL', 'SR', 'RL', 'RR'];
/** A press that travels less than this is a press, not a drag. */
const PRESS_TRAVEL_PX = 4;
const SIZE = 400;
const CENTRE = SIZE / 2;
/**
 * The walls grow with the room. A 12 m room fills the frame and a 2 m room
 * stands well inside it, and the ring keeps its true proportion between
 * the head and the walls — so Size and Distance no longer look like the
 * same dial: one moves the walls, the other moves the speakers within them.
 * Square-root rather than straight, so the small rooms, which are the ones
 * people sit in, keep enough wall to hold seven speakers and their names;
 * the margin outside the largest holds the size's dimension line.
 */
const WALL_MAX = CENTRE - 26;
const WALL_MIN = 104;
const SIZE_MIN_M = 2;
const SIZE_MAX_M = 12;
const RING_MIN = 58;

const clamp = (value: number, low: number, high: number) =>
  Math.min(high, Math.max(low, value));

const wallHalfOf = (sizeM: number) =>
  WALL_MIN +
  (WALL_MAX - WALL_MIN) *
    Math.sqrt(clamp((sizeM - SIZE_MIN_M) / (SIZE_MAX_M - SIZE_MIN_M), 0, 1));

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
 * The room from above: the walls are drawn to the room's size, the listener
 * sits in the middle, and the speakers stand on a ring at their distance in
 * the same scale — a big room fills the frame with the ring well inside its
 * walls, a small one stands inside the frame with the speakers near them. The
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
  mutes,
  selected,
  onSelect,
  children,
  onAngle,
  onCommit,
  isDisabled,
  canDrag,
}: IDspRoomGraphProps) => {
  const { t } = useTranslation();
  const svgRef = useRef<SVGSVGElement | null>(null);
  const dragging = useRef<number | null>(null);
  const pressed = useRef<{ which: TRoomPick; x: number; y: number } | null>(
    null,
  );
  const moved = useRef(false);
  const wallHalf = wallHalfOf(room.sizeM);
  /**
   * A distance in metres to a radius in the picture, in the room's own
   * scale, kept between the head and the labels' room inside the wall.
   */
  const radiusOf = (distanceM: number) =>
    clamp(
      (distanceM / (room.sizeM / 2)) * wallHalf,
      RING_MIN,
      Math.max(RING_MIN, wallHalf - 40),
    );
  const ring = radiusOf(room.distanceM);
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
    (which: TRoomPick) => (event: ReactPointerEvent<SVGElement>) => {
      if (isDisabled) {
        return;
      }
      // Every press is a candidate for the panel; only a press on an awake
      // speaker, with Plus, is a candidate for a drag — an asleep speaker
      // stays where it is, because a drag nobody can hear looks broken.
      pressed.current = { which, x: event.clientX, y: event.clientY };
      moved.current = false;
      event.currentTarget.setPointerCapture(event.pointerId);
      if (typeof which === 'number' && canDrag && fed[which]) {
        dragging.current = which;
      }
    };
  const onPointerMove = (event: ReactPointerEvent<SVGElement>) => {
    const start = pressed.current;
    if (start === null) {
      return;
    }
    if (
      !moved.current &&
      Math.hypot(event.clientX - start.x, event.clientY - start.y) <
        PRESS_TRAVEL_PX
    ) {
      return;
    }
    moved.current = true;
    if (dragging.current !== null) {
      onAngle(
        dragging.current,
        angleAt(event),
        !(event.shiftKey || event.ctrlKey || event.metaKey),
      );
    }
  };
  const onPointerUp = (event: ReactPointerEvent<SVGElement>) => {
    const start = pressed.current;
    if (start === null) {
      return;
    }
    // A cancelled pointer has already lost its capture, and releasing a
    // capture that is not held throws for a pointer that is gone.
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    pressed.current = null;
    const wasDragging = dragging.current !== null;
    dragging.current = null;
    if (!moved.current) {
      onSelect(selected === start.which ? null : start.which);
      return;
    }
    if (wasDragging) {
      onCommit();
    }
  };

  const wallLeft = CENTRE - wallHalf;
  const wallRight = CENTRE + wallHalf;
  const wallTop = CENTRE - wallHalf;
  const wallBottom = CENTRE + wallHalf;
  // The sub keeps to its corner: deeper in a big room, tucked right into it
  // in a small one, where the front-left speaker stands at the wall.
  const subInset = clamp(wallHalf * 0.25, 30, 44);
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
      point: polar(angle, radiusOf(room.distances[at])),
      label: polar(angle, radiusOf(room.distances[at]) + 28),
      glow:
        fed[at] && !mutes[at] ? clamp((room.levels[at] + 24) / 24, 0, 1) : 0,
      asleep: !fed[at],
      muted: mutes[at] === true,
      isSelected: selected === at,
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
          width={wallHalf * 2}
          height={wallHalf * 2}
          rx={16}
          fill="url(#dsp-room-floor)"
        />
        {/* Hard walls shine back into the room; absorbing ones do not. */}
        <rect
          className="dsp-room-shine"
          x={wallLeft + 5}
          y={wallTop + 5}
          width={wallHalf * 2 - 10}
          height={wallHalf * 2 - 10}
          rx={12}
          style={{ strokeOpacity: shineAlpha }}
        />
        <rect
          className="dsp-room-walls"
          x={wallLeft}
          y={wallTop}
          width={wallHalf * 2}
          height={wallHalf * 2}
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
          .map(
            ({ at, angle, point, label, glow, asleep, muted, isSelected }) => (
              <g
                key={SPEAKER_NAMES[at]}
                className={`dsp-room-speaker${
                  canDrag && !isDisabled && !asleep ? ' can-drag' : ''
                }${asleep ? ' is-asleep' : ''}${muted ? ' is-muted' : ''}${
                  isSelected ? ' is-selected' : ''
                }`}
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
                  <circle
                    className="dsp-room-speaker-tweeter"
                    cy={-7}
                    r={2.5}
                  />
                  {muted ? (
                    <path
                      className="dsp-room-speaker-mute"
                      d="M-13 18 L13 -18"
                    />
                  ) : undefined}
                </g>
                {isSelected ? (
                  <circle
                    className="dsp-room-speaker-select"
                    cx={point.x}
                    cy={point.y}
                    r={24}
                  />
                ) : undefined}
                <text
                  className="dsp-room-speaker-name"
                  x={label.x}
                  y={label.y + 3.5}
                  textAnchor="middle"
                >
                  {SPEAKER_NAMES[at]}
                </text>
              </g>
            ),
          )}
        {/* The sub: on the floor by the front wall, where subs live. It has
            no direction and no place on the ring, so it is not dragged; its
            glow is the Sub dial's, and it sleeps while the stream has no
            subwoofer feed. */}
        <g
          className={`dsp-room-sub${subFed ? '' : ' is-asleep'}${
            mutes[ROOM_SPEAKERS] ? ' is-muted' : ''
          }${selected === 'sub' ? ' is-selected' : ''}`}
          transform={`translate(${wallLeft + subInset} ${wallTop + subInset})`}
          onPointerDown={onPointerDown('sub')}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
        >
          {selected === 'sub' ? (
            <circle className="dsp-room-speaker-select" r={26} />
          ) : undefined}
          <circle
            className="dsp-room-speaker-glow"
            r={14 + subGlow * 12}
            style={{
              opacity:
                subFed && !mutes[ROOM_SPEAKERS] ? 0.18 + subGlow * 0.42 : 0,
            }}
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
          {mutes[ROOM_SPEAKERS] ? (
            <path className="dsp-room-speaker-mute" d="M-16 16 L16 -16" />
          ) : undefined}
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
      {children}
    </div>
  );
};

export default DspRoomGraph;
