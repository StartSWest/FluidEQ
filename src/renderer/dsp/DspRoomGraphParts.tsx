/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { IRoomSettings } from '../../common/dsp/chain';
import {
  clamp,
  emptiestAngle,
  IRoomScale,
  metres,
  polar,
  radiusOf,
  ROOM_GRAPH_CENTRE as CENTRE,
} from './roomGraphGeometry';
import { spaceOfDb } from './roomView';

/**
 * What the Room's picture is drawn from and nobody presses: the floor and
 * its walls, the two measurements, the listener, and the bodies of a speaker
 * and of the sub. `DspRoomGraph` owns everything that is pressed, dragged or
 * walked with the keys, and wraps these in the elements that are.
 */

interface IRoomBackdropProps {
  room: IRoomSettings;
  scale: IRoomScale;
  frontLabel: string;
}

/**
 * The room: walls drawn to its size, fading as they absorb and shining a
 * little while they are hard, the ring the speakers stand on, and the room's
 * side and the speakers' distance in metres, so the dials and the picture
 * agree.
 */
export const RoomBackdrop = ({
  room,
  scale,
  frontLabel,
}: IRoomBackdropProps) => {
  const { wallHalf } = scale;
  const wallLeft = CENTRE - wallHalf;
  const wallRight = CENTRE + wallHalf;
  const wallTop = CENTRE - wallHalf;
  const sizeLineY = CENTRE + wallHalf + 14;
  // The corners and the shine's inset follow the room: at 16 they turned a
  // room drawn small — one whose speakers stand well outside it — into a
  // lozenge with no corners left to read as a room.
  const corner = clamp(wallHalf * 0.16, 4, 16);
  const shineInset = clamp(wallHalf * 0.05, 2, 5);
  const ring = radiusOf(scale, room.distanceM);
  const wallAlpha = 0.16 + (1 - room.walls) * 0.6;
  // The shine is the sound coming back off the walls, so it is what Space
  // turns: at nothing there is no wall sound at all, whatever the walls are
  // made of, and the room goes dark inside its own outline. The wall line
  // itself stays put — it is the room's shape, and the picture is read for
  // that before anything else.
  const shineAlpha =
    (1 - room.walls) * 0.3 * (spaceOfDb(room.earlyReflectionDb) / 100);
  const distanceAngle = emptiestAngle(room.angles);
  const distanceStart = polar(distanceAngle, 24 * scale.glyph);
  const distanceEnd = polar(distanceAngle, ring - 4);
  const distanceMid = polar(distanceAngle, ring / 2 + 10);

  return (
    <>
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
        rx={corner}
        fill="url(#dsp-room-floor)"
      />
      {/* Hard walls shine back into the room; absorbing ones do not. */}
      <rect
        className="dsp-room-shine"
        x={wallLeft + shineInset}
        y={wallTop + shineInset}
        width={wallHalf * 2 - shineInset * 2}
        height={wallHalf * 2 - shineInset * 2}
        rx={Math.max(corner - 4, 2)}
        style={{ strokeOpacity: shineAlpha }}
      />
      <rect
        className="dsp-room-walls"
        x={wallLeft}
        y={wallTop}
        width={wallHalf * 2}
        height={wallHalf * 2}
        rx={corner}
        style={{ strokeOpacity: wallAlpha }}
      />
      {/* Front: the picture's compass, at the top of the frame rather than
          above the top wall. The wall moves with the room and a speaker
          standing outside a small one reaches past it — where this word used
          to sit, straight through the centre speaker's name. */}
      <text className="dsp-room-front" x={CENTRE} y={12} textAnchor="middle">
        {frontLabel}
      </text>
      <circle className="dsp-room-ring" cx={CENTRE} cy={CENTRE} r={ring} />
      {/* The speakers' distance, measured in the widest gap between them. */}
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
    </>
  );
};

/**
 * The listener, from above: the head, its nose to the front, the two ears.
 * It is drawn at the picture's own scale, so it shrinks with the room instead
 * of standing wider than the walls around it.
 */
export const RoomListener = ({ glyph }: { glyph: number }) => (
  <g
    className="dsp-room-head"
    transform={`translate(${CENTRE} ${CENTRE}) scale(${glyph})`}
  >
    <ellipse rx={15} ry={18} />
    <path d="M-9 -20 L0 -28 L9 -20" />
    <circle cx={-16} cy={0} r={4} />
    <circle cx={16} cy={0} r={4} />
  </g>
);

interface IRoomSpeakerBodyProps {
  code: string;
  angle: number;
  point: { x: number; y: number };
  label: { x: number; y: number };
  /** 0 asleep or muted, to 1 at full level. */
  glow: number;
  isMuted: boolean;
  isSoloed: boolean;
  isSelected: boolean;
}

/** A speaker on the ring, turned to face the listener, under its name. */
export const RoomSpeakerBody = ({
  code,
  angle,
  point,
  label,
  glow,
  isMuted,
  isSoloed,
  isSelected,
}: IRoomSpeakerBodyProps) => (
  <>
    <circle
      className="dsp-room-speaker-glow"
      cx={point.x}
      cy={point.y}
      r={14 + glow * 12}
      style={{ opacity: 0.18 + glow * 0.42 }}
    />
    <g transform={`translate(${point.x} ${point.y}) rotate(${angle + 180})`}>
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
      {isMuted ? (
        <path className="dsp-room-speaker-mute" d="M-13 18 L13 -18" />
      ) : undefined}
    </g>
    {isSoloed ? (
      <circle
        className="dsp-room-speaker-solo"
        cx={point.x}
        cy={point.y}
        r={21}
      />
    ) : undefined}
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
      {code}
    </text>
  </>
);

interface IRoomSubBodyProps {
  /** 0 while the stream has no subwoofer feed or the sub is muted. */
  glow: number;
  /** The picture's own scale, which the cabinet takes and its name does not. */
  glyph: number;
  isLit: boolean;
  isMuted: boolean;
  isSelected: boolean;
}

/**
 * The sub: on the floor by the front wall, where subs live. It has no
 * direction and no place on the ring, so it is not dragged; its glow is the
 * Sub dial's.
 */
export const RoomSubBody = ({
  glow,
  glyph,
  isLit,
  isMuted,
  isSelected,
}: IRoomSubBodyProps) => (
  <>
    {/* The cabinet shrinks with the room it stands in; its name is written at
        the same size as every other speaker's, so a small room does not get a
        label nobody can read. */}
    <g transform={`scale(${glyph})`}>
      {isSelected ? (
        <circle className="dsp-room-speaker-select" r={26} />
      ) : undefined}
      <circle
        className="dsp-room-speaker-glow"
        r={14 + glow * 12}
        style={{ opacity: isLit ? 0.18 + glow * 0.42 : 0 }}
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
      {isMuted ? (
        <path className="dsp-room-speaker-mute" d="M-16 16 L16 -16" />
      ) : undefined}
    </g>
    {/* Above the cabinet, which is away from the listener wherever the sub
        stands — every speaker's name is written on its far side. Below it,
        the name of a sub in the corner of a small room was written across
        the listener's head. */}
    <text
      className="dsp-room-speaker-name"
      y={-(15 * glyph + 12)}
      textAnchor="middle"
    >
      SUB
    </text>
  </>
);
