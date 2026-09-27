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
 * A measurement's figure is 10px text: about this wide per character, with
 * this much clear line either side of it and this far from its middle to its
 * top and bottom.
 */
const FIGURE_CHAR = 5.6;
const FIGURE_CLEAR = 4;
const FIGURE_HALF_HEIGHT = 5;

/**
 * How far along a measurement's line, either side of its figure, the line
 * breaks so the figure stands in the gap — a drawing's dimension, and no
 * halo: a halo in any one colour was a dark box on a floor of another.
 */
const figureBreak = (figure: string, angleDeg: number) => {
  const radians = (angleDeg * Math.PI) / 180;
  const across = Math.abs(Math.sin(radians));
  const along = Math.abs(Math.cos(radians));
  const byWidth = (figure.length * FIGURE_CHAR) / 2 + FIGURE_CLEAR;
  const byHeight = FIGURE_HALF_HEIGHT + FIGURE_CLEAR;
  return Math.min(
    across > 0 ? byWidth / across : Infinity,
    along > 0 ? byHeight / along : Infinity,
  );
};

/** A measurement's line from `from` to `to` out along `angleDeg`, broken at `at`. */
const MeasureLine = ({
  angleDeg,
  from,
  to,
  at,
  gap,
}: {
  angleDeg: number;
  from: number;
  to: number;
  at: number;
  gap: number;
}) => (
  <>
    {[
      [from, at - gap],
      [at + gap, to],
    ]
      .filter(([start, end]) => end - start > 1)
      .map(([start, end]) => {
        const a = polar(angleDeg, start);
        const b = polar(angleDeg, end);
        return <line key={start} x1={a.x} y1={a.y} x2={b.x} y2={b.y} />;
      })}
  </>
);

/**
 * The room: walls drawn to its size, fading as they absorb, the floor lit a
 * little while they are hard, the ring the speakers stand on, and the room's
 * side and the speakers' distance in metres, so the dials and the picture
 * agree. Flat, like every plot in the app: no radial floor, no blurred shine
 * (Ivan, 2026-09-26: "make room box also flat and nice").
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
  // The corners follow the room, and stay small: a room drawn small — one
  // whose speakers stand well outside it — must keep corners to read as a
  // room, and a large one is not a rounded card.
  const corner = clamp(wallHalf * 0.04, 2, 4);
  const ring = radiusOf(scale, room.distanceM);
  const wallAlpha = 0.16 + (1 - room.walls) * 0.6;
  // The sound coming back off the walls, as the floor's light: what Space
  // turns, so at nothing there is none, whatever the walls are made of. It
  // was a blurred second outline inside the wall, a double border. The wall
  // line itself stays put — it is the room's shape, and the picture is read
  // for that before anything else.
  const reflection =
    (1 - room.walls) * 0.12 * (spaceOfDb(room.earlyReflectionDb) / 100);
  const distanceAngle = emptiestAngle(room.angles);
  const distanceFigure = metres(room.distanceM);
  const distanceAt = ring / 2 + 10;
  const distanceMid = polar(distanceAngle, distanceAt);
  const sizeFigure = metres(room.sizeM);
  const sizeGap = figureBreak(sizeFigure, 90);

  return (
    <>
      <rect
        className="dsp-room-floor"
        x={wallLeft}
        y={wallTop}
        width={wallHalf * 2}
        height={wallHalf * 2}
        rx={corner}
      />
      <rect
        className="dsp-room-reflection"
        x={wallLeft}
        y={wallTop}
        width={wallHalf * 2}
        height={wallHalf * 2}
        rx={corner}
        style={{ fillOpacity: reflection }}
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
        <MeasureLine
          angleDeg={distanceAngle}
          from={24 * scale.glyph}
          to={ring - 4}
          at={distanceAt}
          gap={figureBreak(distanceFigure, distanceAngle)}
        />
        <text x={distanceMid.x} y={distanceMid.y + 3.5} textAnchor="middle">
          {distanceFigure}
        </text>
      </g>
      {/* The room's side, along the bottom wall. */}
      <g className="dsp-room-measure">
        <line
          x1={wallLeft}
          y1={sizeLineY}
          x2={CENTRE - sizeGap}
          y2={sizeLineY}
        />
        <line
          x1={CENTRE + sizeGap}
          y1={sizeLineY}
          x2={wallRight}
          y2={sizeLineY}
        />
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
        <text x={CENTRE} y={sizeLineY + 3.5} textAnchor="middle">
          {sizeFigure}
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
  level: number;
  isMuted: boolean;
  isSoloed: boolean;
  isSelected: boolean;
}

/**
 * How much of the accent a cabinet's face takes at full level. Its level was a
 * blurred halo round the cabinet, lit cyan whatever the window's colours; the
 * face itself fills instead, flat, and inside its own edge.
 */
const LEVEL_FILL = 0.36;

/** A speaker on the ring, turned to face the listener, under its name. */
export const RoomSpeakerBody = ({
  code,
  angle,
  point,
  label,
  level,
  isMuted,
  isSoloed,
  isSelected,
}: IRoomSpeakerBodyProps) => (
  <>
    <g transform={`translate(${point.x} ${point.y}) rotate(${angle + 180})`}>
      <rect
        className="dsp-room-speaker-box"
        x={-11}
        y={-16}
        width={22}
        height={32}
        rx={3}
      />
      <rect
        className="dsp-room-speaker-level"
        x={-11}
        y={-16}
        width={22}
        height={32}
        rx={3}
        style={{ fillOpacity: level * LEVEL_FILL }}
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
  level: number;
  /** The picture's own scale, which the cabinet takes and its name does not. */
  glyph: number;
  isLit: boolean;
  isMuted: boolean;
  isSelected: boolean;
}

/**
 * The sub: on the floor by the front wall, where subs live. It has no
 * direction and no place on the ring, so it is not dragged; its level is the
 * Sub dial's.
 */
export const RoomSubBody = ({
  level,
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
      <rect
        className="dsp-room-speaker-box"
        x={-15}
        y={-15}
        width={30}
        height={30}
        rx={3}
      />
      <rect
        className="dsp-room-speaker-level"
        x={-15}
        y={-15}
        width={30}
        height={30}
        rx={3}
        style={{ fillOpacity: isLit ? level * LEVEL_FILL : 0 }}
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
