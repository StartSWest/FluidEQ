/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { readFileSync } from 'fs';
import path from 'path';
import {
  clampDspSettings,
  DSP_DEFAULTS,
  IRoomSettings,
} from '../../../common/dsp/chain';
import {
  CHAIN_PARAM_LEAD,
  CHAIN_ROOM_TRAILER,
  encodeChainSettings,
  isChainWirePayload,
} from '../../../common/dsp/chainWire';
import { portableDspChainSettings } from '../../../common/dsp/dspChainPresetFile';
import { chainRoom } from '../../../common/dsp/presets';
import {
  resetRoom,
  roomInShape,
  roomPresetSettings,
  roomShapeOf,
} from '../../../common/dsp/roomPresets';
import {
  readSavedRooms,
  roomShapesMatch,
  saveRoom,
} from '../../../renderer/dsp/savedRooms';

const upgraded: IRoomSettings = {
  ...DSP_DEFAULTS.room,
  enabled: true,
  rendererVersion: 2,
  earlyReflectionDb: -12,
  ambienceMix: 0.35,
  ambienceDecayS: 1.2,
  ambienceDampingHz: 4500,
  preservePosition: true,
  compareOriginal: true,
  sourceAlreadySpatial: true,
};
const settings = {
  ...DSP_DEFAULTS,
  room: upgraded,
  gameMode: true,
  normalizer: { mode: 'loudness' as const, truePeakDbtp: -2, targetLufs: -18 },
};
const wire = () => encodeChainSettings(settings);

beforeEach(() => window.localStorage.clear());

it('loads old Room shapes as renderer 1 without late ambience', () => {
  window.localStorage.setItem(
    'fluideq.dsp.savedRooms.v1',
    JSON.stringify([
      { id: 'room:old', name: 'Old room', shape: { sizeM: 7, walls: 0.3 } },
    ]),
  );
  const [saved] = readSavedRooms();
  expect(saved.shape).toMatchObject({
    sizeM: 7,
    walls: 0.3,
    rendererVersion: 1,
    earlyReflectionDb: 0,
    ambienceMix: 0,
    ambienceDecayS: 0.5,
    ambienceDampingHz: 6000,
    preservePosition: false,
  });
  expect(clampDspSettings({ room: {} }).room).toEqual(DSP_DEFAULTS.room);
});

it('normalizes invalid new fields without turning on the new renderer', () => {
  expect(
    clampDspSettings({
      room: {
        rendererVersion: 3,
        earlyReflectionDb: -100,
        ambienceMix: 2,
        ambienceDecayS: 0,
        ambienceDampingHz: Infinity,
        preservePosition: 'yes',
        compareOriginal: 1,
        sourceAlreadySpatial: null,
      },
    }).room,
  ).toMatchObject({
    rendererVersion: 1,
    earlyReflectionDb: -60,
    ambienceMix: 1,
    ambienceDecayS: 0.1,
    ambienceDampingHz: 6000,
    preservePosition: false,
    compareOriginal: false,
    sourceAlreadySpatial: false,
  });
  expect(clampDspSettings({ room: upgraded }).room).toEqual(upgraded);
});

it('saves sound shape, excludes runtime/source preferences and matches every new sound field', () => {
  const { saved, stored } = saveRoom('My space', upgraded);
  expect(stored).toBe(true);
  if (saved === undefined) {
    throw new Error('the room was not saved');
  }
  expect(saved.shape).toEqual(roomShapeOf(upgraded));
  expect(saved.shape).not.toHaveProperty('compareOriginal');
  expect(saved.shape).not.toHaveProperty('sourceAlreadySpatial');
  expect(readSavedRooms()[0]).toEqual(saved);
  expect(roomShapesMatch(saved.shape, upgraded)).toBe(true);
  const changes = {
    rendererVersion: 1,
    earlyReflectionDb: -20,
    ambienceMix: 0,
    ambienceDecayS: 0.5,
    ambienceDampingHz: 6000,
    preservePosition: false,
  };
  Object.entries(changes).forEach(([key, value]) => {
    expect(roomShapesMatch(saved.shape, { ...upgraded, [key]: value })).toBe(
      false,
    );
  });
});

it('profiles preserve listener and comparison choices while Reset clears all except power', () => {
  const listener = {
    ...upgraded,
    head: 'small' as const,
    correctHeadphones: false,
  };
  const shaped = roomInShape(
    listener,
    roomShapeOf(DSP_DEFAULTS.room),
    'custom',
  );
  [
    shaped,
    roomPresetSettings(listener, 'studio'),
    chainRoom(listener, { ...DSP_DEFAULTS.room, enabled: true }),
  ].forEach((room) => {
    expect(room).toMatchObject({
      head: 'small',
      correctHeadphones: false,
      compareOriginal: true,
      sourceAlreadySpatial: true,
      rendererVersion: 1,
      ambienceMix: 0,
      preservePosition: false,
    });
  });
  // Reset is the Reference room as it ships, the listener's own included.
  expect(resetRoom(listener)).toEqual({
    ...roomPresetSettings(DSP_DEFAULTS.room, 'referenceV2'),
    enabled: true,
  });
});

it('portable chain profiles strip temporary comparison and source preference', () => {
  expect(portableDspChainSettings(settings).room).toEqual({
    ...upgraded,
    compareOriginal: false,
    sourceAlreadySpatial: false,
  });
});

it('matches the real encoder fixture consumed by native tests', () => {
  const header = readFileSync(
    path.resolve(
      process.cwd(),
      'native/dsp-core/tests/room_contract_fixture.h',
    ),
    'utf8',
  );
  const numbers = header.split('{')[1].split('}')[0].split(',').map(Number);
  expect(wire()).toEqual(numbers);
});

it.each([false, true])(
  'coexists with normalizer and game mode %s without moving the leading layout',
  (gameMode) => {
    const old = encodeChainSettings({
      ...settings,
      room: DSP_DEFAULTS.room,
      gameMode,
    });
    const next = encodeChainSettings({ ...settings, gameMode });
    const base = CHAIN_PARAM_LEAD + DSP_DEFAULTS.eq.bands.length * 7;
    expect(next.slice(base, base + 4)).toEqual([2, -2, -18, Number(gameMode)]);
    expect(next).toHaveLength(base + 4 + CHAIN_ROOM_TRAILER);
    expect(isChainWirePayload(next)).toBe(true);
    expect(old).toHaveLength(base + 3 + Number(gameMode));
    // The previous decoder accepted exactly these three lengths.
    expect([base, base + 3, base + 4]).not.toContain(next.length);
  },
);

it('rejects unsupported versions, lengths, invalid bounds and nonfinite values', () => {
  const good = wire();
  const tag = good.length - CHAIN_ROOM_TRAILER;
  const invalid = [0, 2, 7, 1.5, -61, 1.01, 0.09, 999, 2, -1, 0.5];
  invalid.forEach((value, offset) => {
    [value, NaN, Infinity].forEach((bad) => {
      const next = [...good];
      next[tag + offset] = bad;
      expect(isChainWirePayload(next)).toBe(false);
    });
  });
  for (let length = tag + 1; length < good.length; length += 1) {
    expect(isChainWirePayload(good.slice(0, length))).toBe(false);
  }
  expect(isChainWirePayload([...good, 0])).toBe(false);
  [2, 0.5, NaN].forEach((flag) => {
    const next = [...good];
    next[tag - 1] = flag;
    expect(isChainWirePayload(next)).toBe(false);
  });
});

it.each([
  ['early reflections', 4],
  ['ambience mix', 5],
])('rejects a sparse Room trailer missing %s', (_name, offset) => {
  const good = wire();
  const sparse = [...good];
  const index = good.length - CHAIN_ROOM_TRAILER + Number(offset);
  delete sparse[index];
  expect(sparse).toHaveLength(good.length);
  expect(index in sparse).toBe(false);
  expect(isChainWirePayload(sparse)).toBe(false);
  // Zero is legitimate here, but an absent scalar must never become zero.
  sparse[index] = 0;
  expect(isChainWirePayload(sparse)).toBe(true);
});

it('requires every scalar to be present in legacy and extended snapshots', () => {
  const legacy = encodeChainSettings(DSP_DEFAULTS);
  [legacy.slice(0, -3), legacy, [...legacy, 1], wire()].forEach((good) => {
    expect(isChainWirePayload(good)).toBe(true);
    for (let index = 0; index < good.length; index += 1) {
      const sparse = [...good];
      delete sparse[index];
      expect({ index, accepted: isChainWirePayload(sparse) }).toEqual({
        index,
        accepted: false,
      });
    }
  });
});
