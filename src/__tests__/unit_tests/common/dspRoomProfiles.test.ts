/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { readFileSync } from 'fs';
import path from 'path';
import { clampDspSettings, DSP_DEFAULTS } from '../../../common/dsp/chain';
import {
  encodeChainSettings,
  hasRoomTrailer,
  isChainWirePayload,
} from '../../../common/dsp/chainWire';
import {
  ROOM_FEATURED_LIST,
  roomPresetSettings,
} from '../../../common/dsp/roomPresets';
import {
  ROOM_PROFILE_FIXTURE_VALUES,
  roomProfilesFixture,
} from '../../../common/dsp/roomProfilesFixture';
import de from '../../../common/i18n/de';
import en from '../../../common/i18n/en';

/**
 * `room_profiles_test.cpp` measures the featured rooms through the shipped
 * head — four rates, three streams, both bufferings — and it reads them from
 * `room_profiles_fixture.h`. A room retuned in the app and not regenerated
 * there is an engine test measuring a room nobody can choose, so this holds
 * the header to the table byte for byte.
 */
it('is the table the engine measures', () => {
  const header = readFileSync(
    path.resolve(
      process.cwd(),
      'native/dsp-core/tests/room_profiles_fixture.h',
    ),
    'utf8',
  );
  expect(header).toBe(roomProfilesFixture());
  // And the header says what it holds: every featured room, of as many
  // numbers each as `settings_of` reads — then the tone bands of the rooms
  // the rack's Room copies stand in, five bands of four numbers each.
  const tables = header.split('inline constexpr RoomToneFixture');
  expect(tables).toHaveLength(2);
  const rowsOf = (table: string) =>
    table.split('\n').filter((line) => line.startsWith('  {"'));
  const rows = rowsOf(tables[0]);
  expect(rows).toHaveLength(ROOM_FEATURED_LIST.length);
  const tones = rowsOf(tables[1]);
  expect(tones.map((row) => row.split('"')[1]).sort()).toEqual([
    'cinemaV2',
    'competitiveV2',
    'gameWorldV2',
    'musicSpaceV2',
  ]);
  tones.forEach((row) => {
    expect(row.match(/\{-?\d[^{}]*\}/g)).toHaveLength(5);
  });
  rows.forEach((row) => {
    expect(row.split('{')[2].split('}')[0].split(',')).toHaveLength(
      ROOM_PROFILE_FIXTURE_VALUES,
    );
  });
});

it('every featured room survives the clamp unchanged and goes on the wire with its trailer', () => {
  ROOM_FEATURED_LIST.forEach(({ id }) => {
    const room = roomPresetSettings(
      { ...DSP_DEFAULTS.room, enabled: true },
      id,
    );
    expect(clampDspSettings({ ...DSP_DEFAULTS, room }).room).toEqual(room);
    const wire = encodeChainSettings({ ...DSP_DEFAULTS, room });
    expect({ id, valid: isChainWirePayload(wire) }).toEqual({
      id,
      valid: true,
    });
    // The new renderer rides the tagged trailer; an engine older than it is
    // refused the rack rather than handed a room it would render wrongly.
    expect({ id, trailer: hasRoomTrailer(wire) }).toEqual({
      id,
      trailer: true,
    });
  });
});

it('names every featured room and says what it is for, in words that exist', () => {
  ROOM_FEATURED_LIST.forEach(({ labelKey, purposeKey }) => {
    [en, de].forEach((locale) => {
      const words = locale as Record<string, string | undefined>;
      expect(words[labelKey]).toEqual(expect.any(String));
      expect(words[purposeKey ?? '']).toEqual(expect.any(String));
    });
  });
});
