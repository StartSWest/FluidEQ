/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import {
  clampDspSettings,
  DSP_DEFAULTS,
  ROOM_PRESETS,
} from '../../../common/dsp/chain';
import {
  isRoomPresetId,
  ROOM_PRESET_GROUPS,
  ROOM_PRESET_LIST,
  ROOM_PRESET_SHAPES,
  roomPresetSettings,
} from '../../../common/dsp/roomPresets';

describe('room presets', () => {
  it('every one is a room the engine accepts unchanged', () => {
    ROOM_PRESET_LIST.forEach((preset) => {
      expect(isRoomPresetId(preset.id)).toBe(true);
      const live = roomPresetSettings(
        { ...DSP_DEFAULTS.room, enabled: true },
        preset.id,
      );
      const clamped = clampDspSettings({ ...DSP_DEFAULTS, room: live }).room;
      expect({ id: preset.id, clamped }).toEqual({
        id: preset.id,
        clamped: live,
      });
    });
  });

  it('every one is on the wire, in a group the picker knows, once', () => {
    const ids = ROOM_PRESET_LIST.map((preset) => preset.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids.length).toBe(ROOM_PRESETS.length - 1);
    ids.forEach((id) => expect(ROOM_PRESETS).toContain(id));
    ROOM_PRESET_LIST.forEach((preset) =>
      expect(ROOM_PRESET_GROUPS).toContain(preset.group),
    );
  });

  /**
   * A room is a place: the speakers stand inside it, the head in the middle,
   * so no speaker is farther than half the side. And the rooms that claim a
   * size order really are in that order.
   */
  it('keeps the speakers inside the walls, and sizes the rooms as named', () => {
    ROOM_PRESET_LIST.forEach((preset) => {
      expect({
        id: preset.id,
        inside: preset.shape.distanceM <= preset.shape.sizeM / 2,
      }).toEqual({ id: preset.id, inside: true });
      expect(preset.shape.angles).toHaveLength(7);
      expect(preset.shape.levels).toHaveLength(7);
      // A preset stands every speaker on its ring.
      expect(preset.shape.distances).toEqual(
        Array.from({ length: 7 }, () => preset.shape.distanceM),
      );
      // Left speakers on the left, right on the right, centre ahead.
      expect(preset.shape.angles[0]).toBeLessThan(0);
      expect(preset.shape.angles[1]).toBeGreaterThan(0);
      expect(preset.shape.angles[2]).toBe(0);
      expect(preset.shape.angles[3]).toBeLessThan(0);
      expect(preset.shape.angles[5]).toBeLessThan(preset.shape.angles[3]);
    });
    const { nearField, studio, livingRoom, homeTheatre, cinema, concertHall } =
      ROOM_PRESET_SHAPES;
    expect(nearField.sizeM).toBeLessThan(studio.sizeM);
    expect(studio.sizeM).toBeLessThan(livingRoom.sizeM);
    expect(livingRoom.sizeM).toBeLessThan(homeTheatre.sizeM);
    expect(homeTheatre.sizeM).toBeLessThan(cinema.sizeM);
    expect(cinema.sizeM).toBeLessThanOrEqual(concertHall.sizeM);
    // Open air has no walls to reflect; the club's are the hardest.
    expect(ROOM_PRESET_SHAPES.openAir.walls).toBe(1);
    expect(ROOM_PRESET_SHAPES.club.walls).toBeLessThan(
      ROOM_PRESET_SHAPES.jazzClub.walls,
    );
  });

  it('leaves the listener alone and puts its name on the room', () => {
    const custom = {
      ...DSP_DEFAULTS.room,
      enabled: true,
      presetId: 'custom' as const,
      head: 'small' as const,
      correctHeadphones: false,
      angles: [-20, 20, 0, -90, 90, -150, 150],
    };
    const club = roomPresetSettings(custom, 'club');
    expect(club.presetId).toBe('club');
    expect(club.head).toBe('small');
    expect(club.correctHeadphones).toBe(false);
    expect(club.subDb).toBe(4);
    // Its own arrays: editing the result must not edit the shape table.
    club.angles[0] = 1;
    expect(ROOM_PRESET_SHAPES.club.angles[0]).toBe(-30);
  });

  /**
   * The same eleven rooms, pinned by value: `room_presets_test.cpp` runs the
   * engine's room through this exact table, so a room retuned here is retuned
   * there in the same commit or the two tests describe different rooms.
   */
  it('is the table the engine test runs', () => {
    const table = ROOM_PRESET_LIST.map((preset) => [
      preset.id,
      preset.shape.sizeM,
      preset.shape.walls,
      preset.shape.distanceM,
      preset.shape.centreDb,
      preset.shape.subDb,
    ]);
    expect(table).toEqual([
      ['studio', 3.2, 0.8, 1.4, 0, 0],
      ['livingRoom', 4.2, 0.55, 1.8, 0, 0],
      ['frontStage', 4.2, 0.6, 2, 0, 0],
      ['homeTheatre', 5.5, 0.45, 2.6, 1, 1.5],
      ['cinema', 9, 0.35, 4, 1.5, 2],
      ['gaming', 4.5, 0.5, 1.8, 0, 1],
      ['concertHall', 12, 0.2, 5, 0, -2],
      ['jazzClub', 5, 0.4, 2.2, 0, 1],
      ['club', 6, 0.15, 2.5, 0, 4],
      ['nearField', 2.4, 0.9, 0.9, 0, 0],
      ['openAir', 12, 1, 3, 0, -1],
    ]);
  });
});
