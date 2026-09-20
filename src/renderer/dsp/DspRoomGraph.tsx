/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import {
  KeyboardEvent as ReactKeyboardEvent,
  PointerEvent as ReactPointerEvent,
  useRef,
} from 'react';
import { IRoomSettings, ROOM_SPEAKERS } from '../../common/dsp/chain';
import { roomSolo } from '../../common/dsp/roomSpeakers';
import { useTranslation } from '../utils/I18nContext';
import {
  RoomBackdrop,
  RoomListener,
  RoomSpeakerBody,
  RoomSubBody,
} from './DspRoomGraphParts';
import {
  clamp,
  metres,
  polar,
  radiusOf,
  ROOM_GRAPH_CENTRE as CENTRE,
  ROOM_GRAPH_SIZE as SIZE,
  wallHalfOf,
  wrapAngle,
} from './roomGraphGeometry';
import {
  ROOM_PICKS,
  ROOM_SPEAKER_CODES,
  roomSpeakerNameKey,
  TRoomPick,
} from './roomSpeakerNames';

interface IDspRoomGraphProps {
  room: IRoomSettings;
  /**
   * Which speakers the stream playing right now feeds, FL FR C SL SR RL RR:
   * a stereo stream feeds the front pair and nothing else, and a speaker
   * that gets nothing is drawn asleep so moving it is not expected to be
   * heard. All seven while nothing is known.
   */
  fed: readonly boolean[];
  /**
   * Which of those are worked out from a stereo pair rather than fed by a
   * channel of their own: drawn dashed, so a filled ring never reads as a
   * surround source.
   */
  derived: readonly boolean[];
  /** Whether the stream carries a subwoofer feed; drawn asleep without. */
  subFed: boolean;
  /** The speaker whose pane is open beside the picture; the sub is 'sub'. */
  selected: TRoomPick;
  /**
   * The speaker to show in the pane: on the press itself, before any travel,
   * so the pane is already that speaker's while it is being dragged.
   */
  onSelect: (which: TRoomPick) => void;
  /**
   * A speaker moving, by the pointer or the arrow keys; whole degrees, one
   * at a time. `mirrored` is the plain move: the speaker's pair goes with
   * it, mirrored across the front. Shift or Ctrl held makes it false and the
   * speaker moves alone.
   */
  onAngle: (speaker: number, angleDeg: number, mirrored: boolean) => void;
  /** Travel began: what to go back to if the drag is called off. */
  onDragStart: () => void;
  /** Escape, or the pointer taken away mid-drag: back to where it began. */
  onDragCancel: () => void;
  onCommit: () => void;
  isDisabled: boolean;
  /** Dragging is a Plus thing; the picture is not. */
  canDrag: boolean;
}

const SPEAKER_NAMES = ROOM_SPEAKER_CODES;
/** A press that travels less than this is a press, not a drag. */
const PRESS_TRAVEL_PX = 4;
/** Degrees a key walks the selected speaker: clockwise is to the right. */
const KEY_TURNS: Record<string, number | undefined> = {
  ArrowLeft: -1,
  ArrowRight: 1,
  PageDown: -10,
  PageUp: 10,
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
 *
 * One stop for the keyboard, like a toolbar: Tab lands on the selected
 * speaker, up and down choose another, left and right walk it round the ring
 * a degree at a time (Page Up and Down, ten). It used to be a picture
 * (`role="img"`), which told a screen reader there was nothing inside to
 * operate, and no speaker could be reached without a mouse.
 */
const DspRoomGraph = ({
  room,
  fed,
  derived,
  subFed,
  selected,
  onSelect,
  onAngle,
  onDragStart,
  onDragCancel,
  onCommit,
  isDisabled,
  canDrag,
}: IDspRoomGraphProps) => {
  const { t } = useTranslation();
  const svgRef = useRef<SVGSVGElement | null>(null);
  const nodes = useRef(new Map<TRoomPick, SVGGElement>());
  /**
   * The press in hand. `speaker` is set where the press may become a drag —
   * an awake speaker, with Plus — and `moved` once it has travelled.
   */
  const press = useRef<{
    x: number;
    y: number;
    speaker: number | null;
    moved: boolean;
  } | null>(null);
  const wallHalf = wallHalfOf(room.sizeM);

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

  /** Whether this speaker may be moved: Plus, the room on, sound reaching it. */
  const movable = (which: TRoomPick): which is number =>
    typeof which === 'number' && canDrag && !isDisabled && fed[which];

  const onPointerDown =
    (which: TRoomPick) => (event: ReactPointerEvent<SVGGElement>) => {
      if (isDisabled) {
        return;
      }
      // The pane is this speaker's from the press, not from the release: a
      // drag has no release until it is over, and the pane is what shows the
      // angle while it moves. Only an awake speaker, with Plus, may go on to
      // be dragged — a drag nobody can hear looks broken.
      onSelect(which);
      press.current = {
        x: event.clientX,
        y: event.clientY,
        speaker: movable(which) ? which : null,
        moved: false,
      };
      event.currentTarget.setPointerCapture(event.pointerId);
    };
  const onPointerMove = (event: ReactPointerEvent<SVGGElement>) => {
    const held = press.current;
    if (held === null || held.speaker === null) {
      return;
    }
    if (!held.moved) {
      if (
        Math.hypot(event.clientX - held.x, event.clientY - held.y) <
        PRESS_TRAVEL_PX
      ) {
        return;
      }
      held.moved = true;
      onDragStart();
    }
    onAngle(
      held.speaker,
      angleAt(event),
      !(event.shiftKey || event.ctrlKey || event.metaKey),
    );
  };
  /**
   * The end of a press, however it ends. Released, a drag is kept; called
   * off — Escape, a cancelled pointer, the capture taken away — it goes back
   * to where it began, so nothing is left half-moved and nothing is left
   * dragging.
   */
  const endPress = (keep: boolean) => {
    const held = press.current;
    press.current = null;
    if (held === null || !held.moved) {
      return;
    }
    if (keep) {
      onCommit();
    } else {
      onDragCancel();
    }
  };
  const onPointerUp = (event: ReactPointerEvent<SVGGElement>) => {
    // A cancelled pointer has already lost its capture, and releasing a
    // capture that is not held throws for a pointer that is gone.
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    endPress(true);
  };

  const onKeyDown =
    (which: TRoomPick) => (event: ReactKeyboardEvent<SVGGElement>) => {
      if (isDisabled) {
        return;
      }
      if (event.key === 'Escape' && press.current?.moved === true) {
        event.preventDefault();
        endPress(false);
        return;
      }
      if (event.key === 'Enter' || event.key === ' ') {
        // Space would scroll the page under the picture.
        event.preventDefault();
        onSelect(which);
        return;
      }
      if (event.key === 'ArrowUp' || event.key === 'ArrowDown') {
        event.preventDefault();
        const at = ROOM_PICKS.indexOf(which);
        const step = event.key === 'ArrowDown' ? 1 : -1;
        const next =
          ROOM_PICKS[(at + step + ROOM_PICKS.length) % ROOM_PICKS.length];
        onSelect(next);
        nodes.current.get(next)?.focus();
        return;
      }
      const turn = KEY_TURNS[event.key];
      if (turn !== undefined && movable(which)) {
        event.preventDefault();
        onAngle(
          which,
          wrapAngle(room.angles[which] + turn),
          !(event.shiftKey || event.ctrlKey || event.metaKey),
        );
        onCommit();
      }
    };

  /** What a screen reader says of a speaker: its name, place and state. */
  const spoken = (which: TRoomPick): string => {
    const isSub = which === 'sub';
    const isFed = isSub ? subFed : fed[which];
    return [
      t(roomSpeakerNameKey(which)),
      isSub ? undefined : `${room.angles[which]}°`,
      isSub ? undefined : metres(room.distances[which]),
      room.mutes[isSub ? ROOM_SPEAKERS : which]
        ? t('dsp.room.speaker.isMuted')
        : undefined,
      isFed ? undefined : t('dsp.room.speaker.isUnfed'),
      !isSub && derived[which] ? t('dsp.room.speaker.isDerived') : undefined,
    ]
      .filter((part) => part !== undefined)
      .join(', ');
  };

  const callOff = () => endPress(false);
  /**
   * What makes a drawn speaker a control. One stop for Tab — the selected
   * speaker — and the arrows reach the rest.
   */
  const handleOf = (which: TRoomPick) => ({
    ref: (node: SVGGElement | null) => {
      if (node === null) {
        nodes.current.delete(which);
      } else {
        nodes.current.set(which, node);
      }
    },
    tabIndex: !isDisabled && selected === which ? 0 : -1,
    isPressed: selected === which,
    label: spoken(which),
    onPointerDown: onPointerDown(which),
    onKeyDown: onKeyDown(which),
  });
  const subHandle = handleOf('sub');

  const wallLeft = CENTRE - wallHalf;
  const wallTop = CENTRE - wallHalf;
  // The sub keeps to its corner: deeper in a big room, tucked right into it
  // in a small one, where the front-left speaker stands at the wall.
  const subInset = clamp(wallHalf * 0.25, 30, 44);
  const subGlow = subFed ? clamp((room.subDb + 12) / 24, 0, 1) : 0;
  const { mutes } = room;
  // The speaker heard alone, if the mutes spell one: ringed, so a solo reads
  // as a solo and not as six separate mutes.
  const solo = roomSolo(mutes);
  const speakers = Array.from({ length: ROOM_SPEAKERS }, (_unused, at) => {
    const angle = room.angles[at];
    return {
      at,
      angle,
      point: polar(angle, radiusOf(room, room.distances[at])),
      label: polar(angle, radiusOf(room, room.distances[at]) + 28),
      glow:
        fed[at] && !mutes[at] ? clamp((room.levels[at] + 24) / 24, 0, 1) : 0,
      asleep: !fed[at],
      worked: derived[at] === true,
      muted: mutes[at] === true,
      soloed: solo === at,
      isSelected: selected === at,
      handle: handleOf(at),
    };
  });

  return (
    <div className={`dsp-room-graph${isDisabled ? ' is-off' : ''}`}>
      <svg
        ref={svgRef}
        className="dsp-room-svg"
        viewBox={`0 0 ${SIZE} ${SIZE}`}
        role="group"
        aria-label={t('dsp.room.graphLabel')}
      >
        <RoomBackdrop room={room} frontLabel={t('dsp.room.front')} />
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
            ({
              at,
              angle,
              point,
              label,
              glow,
              asleep,
              worked,
              muted,
              soloed,
              isSelected,
              handle,
            }) => (
              <g
                key={SPEAKER_NAMES[at]}
                className={`dsp-room-speaker${
                  canDrag && !isDisabled && !asleep ? ' can-drag' : ''
                }${asleep ? ' is-asleep' : ''}${worked ? ' is-derived' : ''}${
                  muted ? ' is-muted' : ''
                }${soloed ? ' is-soloed' : ''}${
                  isSelected ? ' is-selected' : ''
                }`}
                ref={handle.ref}
                role="button"
                tabIndex={handle.tabIndex}
                aria-pressed={handle.isPressed}
                aria-disabled={isDisabled}
                aria-label={handle.label}
                onPointerDown={handle.onPointerDown}
                onPointerMove={onPointerMove}
                onPointerUp={onPointerUp}
                onPointerCancel={callOff}
                onLostPointerCapture={callOff}
                onKeyDown={handle.onKeyDown}
              >
                <RoomSpeakerBody
                  code={SPEAKER_NAMES[at]}
                  angle={angle}
                  point={point}
                  label={label}
                  glow={glow}
                  isMuted={muted}
                  isSoloed={soloed}
                  isSelected={isSelected}
                />
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
          ref={subHandle.ref}
          role="button"
          tabIndex={subHandle.tabIndex}
          aria-pressed={subHandle.isPressed}
          aria-disabled={isDisabled}
          aria-label={subHandle.label}
          onPointerDown={subHandle.onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={callOff}
          onLostPointerCapture={callOff}
          onKeyDown={subHandle.onKeyDown}
        >
          <RoomSubBody
            glow={subGlow}
            isLit={subFed && !mutes[ROOM_SPEAKERS]}
            isMuted={mutes[ROOM_SPEAKERS] === true}
            isSelected={selected === 'sub'}
          />
        </g>
        <RoomListener />
      </svg>
      <p className="dsp-room-graph-hint">
        {t(canDrag ? 'dsp.room.dragHint' : 'dsp.room.plusDragHint')}
      </p>
    </div>
  );
};

export default DspRoomGraph;
