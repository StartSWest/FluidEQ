/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { DSP_DEFAULTS, IRoomSettings } from '../../../common/dsp/chain';
import { roomPresetSettings } from '../../../common/dsp/roomPresets';
import {
  deleteSavedRoom,
  readSavedRooms,
  SAVED_ROOM_NAME_MAX,
  saveRoom,
  uniqueRoomName,
} from '../../../renderer/dsp/savedRooms';

const roomOf = (room: Partial<IRoomSettings> = {}): IRoomSettings => ({
  ...DSP_DEFAULTS.room,
  enabled: true,
  ...room,
});

beforeEach(() => {
  window.localStorage.clear();
  jest.restoreAllMocks();
});

describe('a name for a saved room', () => {
  it('is the name asked for while nobody has it', () => {
    expect(uniqueRoomName('  Den  ', ['Attic'])).toBe('Den');
    expect(uniqueRoomName('   ', ['Attic'])).toBe('');
  });

  it('is numbered where a room already has it, whatever the capitals', () => {
    expect(uniqueRoomName('den', ['Den'])).toBe('den (2)');
    expect(uniqueRoomName('Den', ['den', 'DEN (2)'])).toBe('Den (3)');
    // A name that is already numbered counts on from its stem.
    expect(uniqueRoomName('Den (2)', ['Den', 'Den (2)'])).toBe('Den (3)');
  });

  it('gives up letters, never the number, to stay inside the limit', () => {
    const long = 'x'.repeat(SAVED_ROOM_NAME_MAX);
    const numbered = uniqueRoomName(long, [long]);
    expect(numbered).toHaveLength(SAVED_ROOM_NAME_MAX);
    expect(numbered.endsWith(' (2)')).toBe(true);
    expect(uniqueRoomName(long, [long, numbered]).endsWith(' (3)')).toBe(true);
  });
});

describe('saving a room', () => {
  it('keeps the room that already had the name, shape and id and all', () => {
    const first = saveRoom('Den', roomOf({ walls: 0.3 }));
    const second = saveRoom(' den ', roomOf({ walls: 0.9 }));
    expect(first.stored && second.stored).toBe(true);
    expect(second.saved?.name).toBe('den (2)');
    const rooms = readSavedRooms();
    expect(rooms.map((room) => [room.name, room.shape.walls])).toEqual([
      ['Den', 0.3],
      ['den (2)', 0.9],
    ]);
    expect(rooms[0].id).toBe(first.saved?.id);
    expect(rooms[0].id).not.toBe(rooms[1].id);
  });

  it('keeps a classic room and a new one side by side, each on its own renderer', () => {
    saveRoom('Old', roomPresetSettings(roomOf(), 'club'));
    saveRoom('New', roomPresetSettings(roomOf(), 'liveVenueV2'));
    expect(
      readSavedRooms().map((room) => [
        room.name,
        room.shape.rendererVersion,
        room.shape.ambienceMix,
      ]),
    ).toEqual([
      ['Old', 1, 0],
      ['New', 2, 0.6],
    ]);
  });

  it('saves nothing for no name, and says so', () => {
    const result = saveRoom('   ', roomOf());
    expect(result).toEqual({ rooms: [], saved: undefined, stored: false });
    expect(readSavedRooms()).toEqual([]);
  });

  /**
   * A full quota or a locked profile throws. The save did not happen, so it
   * is not reported as one — and the rooms that were there are still the
   * list, not one longer.
   */
  it('reports a save storage refused, and leaves the list as it was', () => {
    saveRoom('Den', roomOf());
    jest.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('QuotaExceededError');
    });
    const result = saveRoom('Attic', roomOf({ walls: 0.1 }));
    expect(result.stored).toBe(false);
    expect(result.saved).toBeUndefined();
    expect(result.rooms.map((room) => room.name)).toEqual(['Den']);
  });

  it('reads an unreadable list as none, and saving then starts a new one', () => {
    window.localStorage.setItem('fluideq.dsp.savedRooms.v1', '{not json');
    expect(readSavedRooms()).toEqual([]);
    expect(saveRoom('Den', roomOf()).stored).toBe(true);
    expect(readSavedRooms().map((room) => room.name)).toEqual(['Den']);
  });
});

describe('deleting a saved room', () => {
  it('removes that room and no other', () => {
    const { saved } = saveRoom('Den', roomOf());
    saveRoom('Attic', roomOf());
    expect(deleteSavedRoom(saved?.id ?? '').map((room) => room.name)).toEqual([
      'Attic',
    ]);
  });

  it('keeps the list when storage refuses the write', () => {
    const { saved } = saveRoom('Den', roomOf());
    jest.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('locked');
    });
    expect(deleteSavedRoom(saved?.id ?? '').map((room) => room.name)).toEqual([
      'Den',
    ]);
  });
});
