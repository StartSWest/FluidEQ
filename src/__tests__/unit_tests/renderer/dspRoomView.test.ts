/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { DSP_DEFAULTS, IRoomSettings } from '../../../common/dsp/chain';
import {
  ROOM_PRESET_SHAPES,
  roomInShape,
  roomPresetSettings,
} from '../../../common/dsp/roomPresets';
import {
  forgetRoomSource,
  rememberRoomSource,
  roomRestoreSource,
  trackRoomEdit,
} from '../../../renderer/dsp/roomProfileMemory';
import {
  dbOfSpace,
  isRoomPlaying,
  roomFeedOf,
  spaceOfDb,
} from '../../../renderer/dsp/roomView';

describe('what a stream feeds', () => {
  it('lights every speaker while nothing is known: not playing is not silence', () => {
    (['idle', 'unknown', 'off', 'no-head'] as const).forEach((state) => {
      const feed = roomFeedOf(state);
      expect({ state, fed: feed.fed, note: feed.noteKey }).toEqual({
        state,
        fed: Array(7).fill(true),
        note: undefined,
      });
      expect(isRoomPlaying(state)).toBe(false);
    });
  });

  it('feeds the front pair alone from plain stereo, and no sub', () => {
    const feed = roomFeedOf('front-stage');
    expect(feed.fed).toEqual([true, true, false, false, false, false, false]);
    expect(feed.derived).toEqual(Array(7).fill(false));
    expect(feed.subFed).toBe(false);
  });

  /**
   * Expanded stereo reaches all seven, five of them worked out from the pair
   * — and still has no subwoofer channel: a filled ring is not a surround
   * source, and the Sub's level has nothing to turn.
   */
  it('marks the five that stereo expansion works out, and still has no sub channel', () => {
    const feed = roomFeedOf('music');
    expect(feed.fed).toEqual(Array(7).fill(true));
    expect(feed.derived).toEqual([false, false, true, true, true, true, true]);
    expect(feed.subFed).toBe(false);
    expect(isRoomPlaying('music')).toBe(true);
  });

  it('feeds five and the sub on 5.1, all seven and the sub on 7.1', () => {
    expect(roomFeedOf('5.1').fed).toEqual([
      true,
      true,
      true,
      true,
      true,
      false,
      false,
    ]);
    expect(roomFeedOf('5.1').subFed).toBe(true);
    expect(roomFeedOf('7.1').fed).toEqual(Array(7).fill(true));
    expect(roomFeedOf('7.1').derived).toEqual(Array(7).fill(false));
    expect(roomFeedOf('7.1').subFed).toBe(true);
  });
});

describe('Space, as a percentage of a level in dB', () => {
  it('is exactly off at 0 and the full walls at 100', () => {
    expect(dbOfSpace(0)).toBe(-60);
    expect(spaceOfDb(-60)).toBe(0);
    expect(dbOfSpace(100)).toBe(0);
    expect(spaceOfDb(0)).toBe(100);
  });

  it('rises with every step and comes back to the step it was set from', () => {
    let last = dbOfSpace(0);
    for (let percent = 1; percent <= 100; percent += 1) {
      const db = dbOfSpace(percent);
      expect(db).toBeGreaterThan(last);
      expect(spaceOfDb(db)).toBe(percent);
      last = db;
    }
  });

  it('reads a level under its floor as on and as quiet as it goes, never off', () => {
    expect(spaceOfDb(-48)).toBe(1);
    expect(spaceOfDb(-59.9)).toBe(1);
  });

  it('shows every featured room a percentage that stores back as the room has it', () => {
    Object.values(ROOM_PRESET_SHAPES)
      .filter((shape) => shape.rendererVersion === 2)
      .forEach((shape) => {
        const percent = spaceOfDb(shape.earlyReflectionDb);
        expect(
          Math.abs(dbOfSpace(percent) - shape.earlyReflectionDb),
        ).toBeLessThan(0.2);
      });
  });
});

describe('what Restore has to go back to', () => {
  const room = (next: Partial<IRoomSettings> = {}): IRoomSettings => ({
    ...DSP_DEFAULTS.room,
    enabled: true,
    ...next,
  });

  beforeEach(() => forgetRoomSource());

  it('is the built-in room an edit came from, while the room is that edit', () => {
    const cinema = roomPresetSettings(room(), 'cinemaV2');
    const edited = { ...cinema, walls: 0.9, presetId: 'custom' as const };
    trackRoomEdit(cinema, edited);
    expect(roomRestoreSource(edited)?.presetId).toBe('cinemaV2');
    // A second edit is still an edit of that room.
    const again = { ...edited, sizeM: 6 };
    trackRoomEdit(edited, again);
    expect(roomRestoreSource(again)?.presetId).toBe('cinemaV2');
  });

  it('is nothing for a custom room nobody remembers making', () => {
    expect(roomRestoreSource(room({ presetId: 'custom', sizeM: 7 }))).toBe(
      undefined,
    );
  });

  /**
   * A rack preset, an import or Reset puts a different room on the card. It
   * is custom and it is not the card's last edit, so the card does not offer
   * to restore a profile that room never was.
   */
  it('is nothing once something else has replaced the room', () => {
    const cinema = roomPresetSettings(room(), 'cinemaV2');
    const edited = { ...cinema, walls: 0.9, presetId: 'custom' as const };
    trackRoomEdit(cinema, edited);
    const replaced = room({ presetId: 'custom', sizeM: 9, walls: 0.2 });
    expect(roomRestoreSource(replaced)).toBe(undefined);
  });

  it('is nothing for a room that is still a preset', () => {
    const cinema = roomPresetSettings(room(), 'cinemaV2');
    rememberRoomSource({ presetId: 'cinemaV2', shape: cinema });
    expect(roomRestoreSource(cinema)).toBe(undefined);
  });

  it('is the saved room an edit came from, by its own name', () => {
    const shape = ROOM_PRESET_SHAPES.jazzClub;
    const standing = roomInShape(room(), shape, 'custom');
    const edited = { ...standing, subDb: 3 };
    trackRoomEdit(standing, edited, {
      presetId: 'custom',
      name: 'Den',
      shape,
    });
    expect(roomRestoreSource(edited)).toMatchObject({
      presetId: 'custom',
      name: 'Den',
    });
  });

  it('keeps its own copy of the shape it remembers', () => {
    const cinema = roomPresetSettings(room(), 'cinemaV2');
    const edited = { ...cinema, walls: 0.9, presetId: 'custom' as const };
    trackRoomEdit(cinema, edited);
    const remembered = roomRestoreSource(edited);
    remembered?.shape.angles.splice(0, 1, 99);
    expect(ROOM_PRESET_SHAPES.cinemaV2.angles[0]).toBe(-30);
  });
});
