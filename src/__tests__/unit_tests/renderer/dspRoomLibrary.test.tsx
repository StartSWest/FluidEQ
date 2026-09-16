/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import '@testing-library/jest-dom';
import { fireEvent, render, screen } from '@testing-library/react';
import { DSP_DEFAULTS, IRoomSettings } from '../../../common/dsp/chain';
import en from '../../../common/i18n/en';
import DspRoomLibrary from '../../../renderer/dsp/DspRoomLibrary';
import {
  deleteSavedRoom,
  readSavedRooms,
  roomShapesMatch,
  saveRoom,
} from '../../../renderer/dsp/savedRooms';

const roomOf = (partial: Partial<IRoomSettings>): IRoomSettings => ({
  ...DSP_DEFAULTS.room,
  enabled: true,
  presetId: 'custom',
  ...partial,
});

const renderLibrary = (room: IRoomSettings, isDisabled = false) => {
  const onApply = jest.fn();
  render(
    <DspRoomLibrary room={room} isDisabled={isDisabled} onApply={onApply} />,
  );
  return { onApply };
};

describe('saved rooms', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it('keep the shape and nothing of the listener, clamped, and overwrite by name', () => {
    saveRoom(
      'Attic',
      roomOf({
        sizeM: 99,
        head: 'large',
        angles: [-20, 20, 0, -90, 90, -150, 150],
      }),
    );
    const [attic] = readSavedRooms();
    expect(attic.name).toBe('Attic');
    expect(attic.shape.sizeM).toBe(12);
    expect(attic.shape.angles[0]).toBe(-20);
    expect('head' in attic.shape).toBe(false);
    saveRoom('attic', roomOf({ sizeM: 5 }));
    const rooms = readSavedRooms();
    expect(rooms).toHaveLength(1);
    expect(rooms[0].shape.sizeM).toBe(5);
    expect(rooms[0].id).toBe(attic.id);
    expect(deleteSavedRoom(attic.id)).toHaveLength(0);
  });

  it('ignore what cannot be read', () => {
    window.localStorage.setItem(
      'fluideq.dsp.savedRooms.v1',
      '{"not":"a list"}',
    );
    expect(readSavedRooms()).toEqual([]);
    window.localStorage.setItem(
      'fluideq.dsp.savedRooms.v1',
      JSON.stringify([{ id: 'room:x', name: 'Bare' }, { name: 'nameless' }]),
    );
    expect(readSavedRooms().map((one) => one.name)).toEqual(['Bare']);
  });

  it('match a room by its shape alone', () => {
    const [{ shape }] = saveRoom('A', roomOf({ walls: 0.3 }));
    expect(roomShapesMatch(shape, roomOf({ walls: 0.3, head: 'small' }))).toBe(
      true,
    );
    expect(roomShapesMatch(shape, roomOf({ walls: 0.31 }))).toBe(false);
  });
});

describe('the saved rooms row', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it('lights the room in use, puts one back with a press, and removes one', () => {
    saveRoom('Attic', roomOf({ sizeM: 5 }));
    saveRoom('Garage', roomOf({ sizeM: 8 }));
    const { onApply } = renderLibrary(roomOf({ sizeM: 8 }));
    expect(screen.getByRole('button', { name: 'Garage' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    expect(screen.getByRole('button', { name: 'Attic' })).toHaveAttribute(
      'aria-pressed',
      'false',
    );
    fireEvent.click(screen.getByRole('button', { name: 'Attic' }));
    expect(onApply).toHaveBeenCalledWith(expect.objectContaining({ sizeM: 5 }));
    fireEvent.click(
      screen.getByRole('button', {
        name: `${en['dsp.room.deleteRoom']} Attic`,
      }),
    );
    expect(screen.queryByRole('button', { name: 'Attic' })).toBeNull();
    expect(readSavedRooms().map((one) => one.name)).toEqual(['Garage']);
  });

  it('names and saves the room as it stands', () => {
    renderLibrary(roomOf({ distanceM: 3 }));
    fireEvent.click(
      screen.getByRole('button', { name: en['dsp.room.saveRoom'] }),
    );
    const input = screen.getByRole('textbox', {
      name: en['dsp.room.savePlaceholder'],
    });
    fireEvent.change(input, { target: { value: 'Loft' } });
    fireEvent.click(
      screen.getByRole('button', { name: en['dsp.eqSave.save'] }),
    );
    expect(readSavedRooms()[0]).toEqual(
      expect.objectContaining({ name: 'Loft' }),
    );
    expect(readSavedRooms()[0].shape.distanceM).toBe(3);
    expect(screen.getByRole('button', { name: 'Loft' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
  });

  it('locks with the dials', () => {
    saveRoom('Attic', roomOf({ sizeM: 5 }));
    renderLibrary(roomOf({}), true);
    expect(
      screen.getByRole('button', { name: en['dsp.room.saveRoom'] }),
    ).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Attic' })).toBeDisabled();
  });
});
