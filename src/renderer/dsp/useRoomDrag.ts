/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { useRef } from 'react';
import type { IRoomSettings } from '../../common/dsp/chain';

/**
 * Each speaker's mirror across the front: left with right, the centre with
 * nobody. A plain move takes the pair, so a layout stays symmetric without
 * a second drag that never quite lands on the same angle.
 */
const ROOM_MIRROR = [1, 0, -1, 4, 3, 6, 5];

interface IRoomDrag {
  /** A speaker moving: `mirrored` takes its pair along, mirrored. */
  turn: (speaker: number, angleDeg: number, mirrored: boolean) => void;
  onDragStart: () => void;
  onDragCancel: () => void;
  onCommit: () => void;
}

/**
 * What a speaker dragged round the room's picture (`DspRoomGraph`) does on
 * the Room's page: its pair goes with it, Escape goes back to the room the
 * drag began in, name and all, and the result is a room of the listener's
 * own.
 *
 * `shape` is the card's own edit of the room's shape, which marks it Custom
 * and remembers what it was edited away from for Restore; `restore` puts a
 * whole room back as it was.
 */
const useRoomDrag = (
  room: IRoomSettings,
  shape: (next: Partial<IRoomSettings>) => void,
  restore: (room: IRoomSettings) => void,
  onCommit: () => void,
): IRoomDrag => {
  /** The room a drag began in, to go back to if it is called off. */
  const dragOrigin = useRef<IRoomSettings | null>(null);
  return {
    turn: (speaker, angleDeg, mirrored) => {
      const pair = mirrored ? ROOM_MIRROR[speaker] : -1;
      shape({
        angles: room.angles.map((angle, at) => {
          if (at === speaker) {
            return angleDeg;
          }
          return at === pair ? -angleDeg : angle;
        }),
      });
    },
    onDragStart: () => {
      dragOrigin.current = room;
    },
    onDragCancel: () => {
      // A drag called off has not happened.
      if (dragOrigin.current !== null) {
        restore(dragOrigin.current);
        onCommit();
      }
      dragOrigin.current = null;
    },
    onCommit: () => {
      dragOrigin.current = null;
      onCommit();
    },
  };
};

export default useRoomDrag;
