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
  ROOM_CLASSIC_LIST,
  ROOM_FEATURED_LIST,
  ROOM_PRESET_GROUPS,
  ROOM_PRESET_LIST,
  ROOM_PRESET_SHAPES,
  roomOnNewRenderer,
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
    ROOM_CLASSIC_LIST.forEach((preset) =>
      expect(ROOM_PRESET_GROUPS).toContain(preset.group),
    );
    expect(ROOM_PRESET_LIST).toEqual([
      ...ROOM_FEATURED_LIST,
      ...ROOM_CLASSIC_LIST,
    ]);
  });

  /**
   * The engine logs the index and an old engine reads it: the twelve that
   * stood before the featured rooms keep their places for good, and the six
   * featured rooms come after `custom`, never between.
   */
  it('keeps every old wire index, and puts the featured rooms after custom', () => {
    expect(ROOM_PRESETS).toEqual([
      'studio',
      'livingRoom',
      'cinema',
      'frontStage',
      'nearField',
      'homeTheatre',
      'gaming',
      'concertHall',
      'jazzClub',
      'club',
      'openAir',
      'custom',
      'referenceV2',
      'musicSpaceV2',
      'cinemaV2',
      'gameWorldV2',
      'competitiveV2',
      'liveVenueV2',
      'closeUpV2',
      'wideStageV2',
      'allAroundV2',
      'balconyV2',
      'nightCinemaV2',
      'conductorV2',
      'rearGuardV2',
    ]);
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
    const table = ROOM_CLASSIC_LIST.map((preset) => [
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

  /**
   * The classic rooms are the first renderer's and none of its new fields:
   * what they sounded like is what they sound like.
   */
  it('leaves every classic room on the first renderer, untouched by the new fields', () => {
    ROOM_CLASSIC_LIST.forEach(({ id, shape }) => {
      expect({
        id,
        rendererVersion: shape.rendererVersion,
        earlyReflectionDb: shape.earlyReflectionDb,
        ambienceMix: shape.ambienceMix,
        preservePosition: shape.preservePosition,
      }).toEqual({
        id,
        rendererVersion: 1,
        earlyReflectionDb: 0,
        ambienceMix: 0,
        preservePosition: false,
      });
    });
  });

  it('puts every featured room on the new renderer, each keeping the speakers in place', () => {
    // The picker's order, which is not the wire's: by what somebody came
    // for, each room beside the one it is a turn of.
    expect(ROOM_FEATURED_LIST.map((preset) => preset.id)).toEqual([
      'referenceV2',
      'musicSpaceV2',
      'wideStageV2',
      'allAroundV2',
      'closeUpV2',
      'cinemaV2',
      'nightCinemaV2',
      'gameWorldV2',
      'competitiveV2',
      'rearGuardV2',
      'liveVenueV2',
      'balconyV2',
      'conductorV2',
    ]);
    // Every featured id is on the wire, once.
    ROOM_FEATURED_LIST.forEach(({ id }) => {
      expect(ROOM_PRESETS.filter((wire) => wire === id)).toHaveLength(1);
    });
    ROOM_FEATURED_LIST.forEach(({ id, shape, purposeKey, collection }) => {
      expect({ id, version: shape.rendererVersion }).toEqual({
        id,
        version: 2,
      });
      expect({ id, keeps: shape.preservePosition }).toEqual({
        id,
        keeps: true,
      });
      expect(collection).toBe('featured');
      expect(purposeKey).toBeDefined();
      // Restrained: no featured room turns the sub up by more than 1 dB.
      expect(shape.subDb).toBeLessThanOrEqual(1);
    });
  });

  it('gives Reference and Competitive no tail at all, and Competitive no walls', () => {
    const { referenceV2, competitiveV2, gameWorldV2 } = ROOM_PRESET_SHAPES;
    expect(referenceV2.ambienceMix).toBe(0);
    expect(competitiveV2.ambienceMix).toBe(0);
    expect(competitiveV2.earlyReflectionDb).toBe(-60);
    // A stereo game stays on the front stage: spreading it would invent
    // positions the game never sent.
    expect(gameWorldV2.musicUpmix).toBe(false);
    expect(competitiveV2.musicUpmix).toBe(false);
    expect(referenceV2.musicUpmix).toBe(false);
  });

  it('applies a featured room whole, and leaves the listener and the source choices', () => {
    const listener = {
      ...DSP_DEFAULTS.room,
      enabled: true,
      head: 'large' as const,
      correctHeadphones: false,
      compareOriginal: true,
      sourceAlreadySpatial: true,
      mutes: [true, false, false, false, false, false, false, false],
    };
    const venue = roomPresetSettings(listener, 'liveVenueV2');
    expect(venue).toMatchObject({
      presetId: 'liveVenueV2',
      head: 'large',
      correctHeadphones: false,
      compareOriginal: true,
      sourceAlreadySpatial: true,
      rendererVersion: 2,
      musicUpmix: true,
    });
    // The room's own: a mute left over from the last room does not follow.
    expect(venue.mutes).toEqual(DSP_DEFAULTS.room.mutes);
  });

  /**
   * Asked for, never assumed: the same room and speakers on the new renderer,
   * the walls as loud as the first renderer plays them, no tail — and no
   * longer the preset it came from, because it no longer sounds like it.
   */
  it('moves a classic room to the new renderer only when asked, and calls it custom', () => {
    const club = roomPresetSettings(
      { ...DSP_DEFAULTS.room, enabled: true },
      'club',
    );
    const moved = roomOnNewRenderer(club);
    expect(moved).toMatchObject({
      presetId: 'custom',
      rendererVersion: 2,
      earlyReflectionDb: 0,
      ambienceMix: 0,
      preservePosition: true,
      sizeM: club.sizeM,
      walls: club.walls,
      subDb: club.subDb,
    });
    expect(moved.angles).toEqual(club.angles);
    expect(club.rendererVersion).toBe(1);
  });
});
