/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { DSP_DEFAULTS } from '../../../common/dsp/chain';
import { DSP_PRESETS } from '../../../common/dsp/presets';
import { DSP_PRESET_RECIPES } from '../../../common/dsp/presetRecipes';
import { isRoomPresetId } from '../../../common/dsp/roomPresets';
import {
  ROOM_TONE_SETS,
  roomToneSetOf,
  withRoomTone,
} from '../../../common/dsp/roomTone';

const preset = (id: string) => {
  const found = DSP_PRESETS.find((one) => one.id === id);
  if (found === undefined) {
    throw new Error(`no chain called ${id}`);
  }
  return found;
};

/** Each Room copy with the chain it copies. */
const COPIES: readonly (readonly [copy: string, chain: string])[] = [
  ['music-room', 'music'],
  ['movie-room', 'movie'],
  ['gaming-room', 'gaming'],
  ['gaming-competitive', 'gaming'],
];

describe("a Room copy keeps its chain's tone", () => {
  /**
   * The numbers are measured in `room_profiles_test.cpp`, which reads them
   * from a header generated from this table; these are written out so that
   * a change to them is a decision made twice.
   */
  it('has the two sets of bands as they were measured', () => {
    expect(
      ROOM_TONE_SETS.filled.map((band) => [
        band.type,
        band.frequency,
        band.gainDb,
        band.quality,
      ]),
    ).toEqual([
      ['LSC', 250, -2.5, 0.7],
      ['LSC', 50, -2, 0.7],
      ['PK', 1500, 3.5, 1.2],
      ['PK', 3800, -1.5, 2],
      ['HSC', 5000, 3, 0.7],
    ]);
    expect(
      ROOM_TONE_SETS.frontStage.map((band) => [
        band.type,
        band.frequency,
        band.gainDb,
        band.quality,
      ]),
    ).toEqual([
      ['LSC', 250, -1.5, 0.7],
      ['LSC', 50, -2.5, 0.7],
      ['PK', 1500, 4.5, 1.2],
      ['PK', 3900, -2, 2],
      ['HSC', 5000, 3, 0.7],
    ]);
  });

  it('chooses by whether the room spreads a record round the ring', () => {
    expect(roomToneSetOf('musicSpaceV2')).toBe('filled');
    expect(roomToneSetOf('cinemaV2')).toBe('filled');
    expect(roomToneSetOf('gameWorldV2')).toBe('frontStage');
    expect(roomToneSetOf('competitiveV2')).toBe('frontStage');
  });

  it('is the chain’s own rack EQ and tone, with the room’s bands after it', () => {
    COPIES.forEach(([copyId, chainId]) => {
      const copy = preset(copyId).settings;
      const chain = preset(chainId).settings;
      const room = copy.room.presetId;
      if (!isRoomPresetId(room)) {
        throw new Error(`${copyId} stands in no room`);
      }
      const tone = ROOM_TONE_SETS[roomToneSetOf(room)];
      expect({ copyId, bands: copy.eq.bands }).toEqual({
        copyId,
        bands: [...chain.eq.bands, ...tone],
      });
      // A rack resized and sized back comes from `sourceBands`: the room's
      // bands have to be in it, or the first resize drops them.
      expect(copy.eq.sourceBands).toEqual(copy.eq.bands);
      // On whether or not the chain's is: it carries the room's bands. A
      // chain's own rack EQ holds only its support now (`presetCurve.ts`), and
      // a chain with none has it off.
      expect(copy.eq.enabled).toBe(true);
      // No longer the catalogue's profile, so it does not claim to be.
      expect(copy.eq.presetId).toBe('');
      // Everything about the EQ that is not a band, or its switch, is the
      // chain's still.
      expect({
        ...copy.eq,
        bands: [],
        sourceBands: [],
        presetId: '',
        enabled: true,
      }).toEqual({
        ...chain.eq,
        bands: [],
        sourceBands: [],
        presetId: '',
        enabled: true,
      });
      // And the chain's tone is the copy's: both play the same curve in the
      // main EQ, after the rack and so after the Room.
      expect({ copyId, curve: preset(copyId).curve }).toEqual({
        copyId,
        curve: preset(chainId).curve,
      });
    });
  });

  it('covers every chain that has the Room, and no chain that has not', () => {
    expect(
      DSP_PRESET_RECIPES.filter((recipe) => recipe.room !== undefined)
        .map((recipe) => recipe.id)
        .sort(),
    ).toEqual(COPIES.map(([copy]) => copy).sort());
    DSP_PRESETS.filter((one) => !one.settings.room.enabled).forEach((one) => {
      const last = one.settings.eq.bands[one.settings.eq.bands.length - 1];
      expect({
        id: one.id,
        isTone:
          last?.frequency === 5000 &&
          last?.type === 'HSC' &&
          last?.gainDb === 3 &&
          one.settings.eq.bands.length > 15,
      }).toEqual({
        id: one.id,
        isTone: false,
      });
    });
  });

  it('copies its bands, so an edit to a chain never reaches the table', () => {
    const shaped = withRoomTone(DSP_DEFAULTS.eq, 'cinemaV2');
    const added = shaped.bands[shaped.bands.length - 1];
    expect(added).toEqual(ROOM_TONE_SETS.filled[4]);
    expect(added).not.toBe(ROOM_TONE_SETS.filled[4]);
  });
});
