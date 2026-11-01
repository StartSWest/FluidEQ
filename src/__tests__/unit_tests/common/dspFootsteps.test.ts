/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * Footsteps on the app's side: its profiles, how a stored one is read back,
 * which chains turn it on, and its trailer on the rack's line — where it
 * stands (after the game word and the Room's, before the curve, as
 * `feq_chain_settings_decode` reads it) and how an older engine is spared it.
 */
import {
  DSP_DEFAULTS,
  IDspSettings,
  clampDspSettings,
} from '../../../common/dsp/chain';
import {
  CHAIN_ROOM_TAG,
  CHAIN_TONE_TAG,
  appendPresetTone,
  chainWireLength,
  encodeChainSettings,
  hasFootsteps,
  hasPresetTone,
  hasRoomTrailer,
  isChainWirePayload,
  legacyChainWithoutInactiveRoom,
  withoutFootsteps,
  withoutPresetTone,
} from '../../../common/dsp/chainWire';
import { FilterTypeEnum } from '../../../common/constants';
import { FOOTSTEPS_DEFAULTS } from '../../../common/dsp/footsteps';
import clampFootstepsSettings from '../../../common/dsp/footstepsClamp';
import {
  FOOTSTEPS_PRESETS,
  footstepsPresetSettings,
} from '../../../common/dsp/footstepsPresets';
import {
  CHAIN_FOOTSTEPS_TAG,
  CHAIN_FOOTSTEPS_TRAILER,
} from '../../../common/dsp/footstepsWire';
import { DSP_PRESETS } from '../../../common/dsp/presets';
import { FOOTSTEPS_CATALOGUE } from '../../../common/dsp/stageCatalogues';
import {
  ENGINE_FOOTSTEPS_SINCE,
  engineRunsFootsteps,
} from '../../../common/engineHealth';
import en from '../../../common/i18n/en';

const withFootsteps = (
  footsteps: Partial<IDspSettings['footsteps']>,
  more: Partial<IDspSettings> = {},
): IDspSettings =>
  clampDspSettings({
    ...DSP_DEFAULTS,
    enabled: true,
    ...more,
    footsteps: { ...DSP_DEFAULTS.footsteps, enabled: true, ...footsteps },
  });

const tone = {
  matched: true,
  bands: [
    { type: FilterTypeEnum.PK, frequency: 3150, gain: 2.8, quality: 1.4 },
  ],
};

describe('Footsteps profiles', () => {
  it('Competitive is what switching the stage on gives', () => {
    expect(footstepsPresetSettings('competitive', false)).toEqual(
      FOOTSTEPS_DEFAULTS,
    );
  });

  it('every one survives the rack clamp unchanged', () => {
    FOOTSTEPS_PRESETS.forEach((preset) => {
      const live = FOOTSTEPS_CATALOGUE.settings(preset.id, true);
      expect(
        clampDspSettings({ ...DSP_DEFAULTS, footsteps: live }).footsteps,
      ).toEqual(live);
    });
  });

  it('names and games every one in English', () => {
    FOOTSTEPS_PRESETS.forEach((preset) => {
      expect(en).toHaveProperty([preset.labelKey]);
      expect(en).toHaveProperty([preset.gamesKey]);
    });
  });

  it('lifts more the larger and louder the kind of game', () => {
    const [competitive, battle, tactical, story] = [
      'competitive',
      'battleRoyale',
      'tactical',
      'story',
    ].map((id) => FOOTSTEPS_CATALOGUE.settings(id, true));
    expect(battle?.lift).toBeGreaterThan(competitive?.lift ?? 1);
    expect(battle?.calm).toBeGreaterThan(competitive?.calm ?? 1);
    expect(story?.lift).toBeLessThan(tactical?.lift ?? 0);
  });
});

describe('a stored Footsteps read back', () => {
  it('reads a rack saved before the stage as one with it off', () => {
    expect(clampFootstepsSettings(undefined)).toEqual(FOOTSTEPS_DEFAULTS);
    expect(clampDspSettings({ enabled: true }).footsteps.enabled).toBe(false);
  });

  it('holds the dials to fractions and keeps a hand edit unnamed', () => {
    expect(
      clampFootstepsSettings({
        enabled: true,
        lift: 3,
        calm: -1,
        presetId: '',
      }),
    ).toEqual({
      enabled: true,
      isolate: false,
      presetId: '',
      lift: 1,
      calm: 0,
    });
  });
});

describe('the chains that turn it on', () => {
  it('are the three Gaming chains, at Competitive', () => {
    const on = DSP_PRESETS.filter(
      (preset) => preset.settings.footsteps.enabled,
    );
    expect(on.map((preset) => preset.id).sort()).toEqual([
      'gaming',
      'gaming-competitive',
      'gaming-room',
    ]);
    on.forEach((preset) =>
      expect(preset.settings.footsteps).toEqual(
        footstepsPresetSettings('competitive', true),
      ),
    );
  });
});

describe('Footsteps on the rack’s line', () => {
  it('leaves a rack without it the line it always was', () => {
    const line = encodeChainSettings({ ...DSP_DEFAULTS, enabled: true });
    expect(line).not.toContain(CHAIN_FOOTSTEPS_TAG);
    expect(line).toHaveLength(chainWireLength(DSP_DEFAULTS.eq.bands.length));
    const off = encodeChainSettings(
      withFootsteps({ enabled: false, lift: 0.3, calm: 0.9 }),
    );
    expect(off).toEqual(line);
  });

  it('stands after a game word written off, with its four values', () => {
    const line = encodeChainSettings(
      withFootsteps({ isolate: true, lift: 0.4, calm: 0.2 }),
    );
    const gameWord = chainWireLength(DSP_DEFAULTS.eq.bands.length);
    expect(line[gameWord]).toBe(0);
    expect(line.slice(gameWord + 1)).toEqual([
      CHAIN_FOOTSTEPS_TAG,
      1,
      4,
      1,
      1,
      0.4,
      0.2,
    ]);
    expect(isChainWirePayload(line)).toBe(true);
    expect(hasFootsteps(line)).toBe(true);
  });

  it('stands between the Room’s trailer and the curve', () => {
    const settings = withFootsteps(
      {},
      { gameMode: true, room: { ...DSP_DEFAULTS.room, rendererVersion: 2 } },
    );
    const line = appendPresetTone(encodeChainSettings(settings), tone);
    const room = line.indexOf(CHAIN_ROOM_TAG);
    const footsteps = line.indexOf(CHAIN_FOOTSTEPS_TAG);
    const curve = line.indexOf(CHAIN_TONE_TAG);
    expect(room).toBeGreaterThan(0);
    expect(footsteps).toBeGreaterThan(room);
    expect(curve).toBe(footsteps + CHAIN_FOOTSTEPS_TRAILER);
    expect(isChainWirePayload(line)).toBe(true);
    expect(hasRoomTrailer(line)).toBe(true);
    expect(hasPresetTone(line)).toBe(true);
  });

  it('keeps itself when the curve is taken off, and the curve when it is', () => {
    const line = appendPresetTone(
      encodeChainSettings(withFootsteps({}, { gameMode: true })),
      tone,
    );
    expect(hasFootsteps(withoutPresetTone(line))).toBe(true);
    const bare = withoutFootsteps(line);
    expect(hasFootsteps(bare)).toBe(false);
    expect(hasPresetTone(bare)).toBe(true);
    expect(isChainWirePayload(bare)).toBe(true);
  });

  it('gives an older engine back the line it knows', () => {
    const before = encodeChainSettings({ ...DSP_DEFAULTS, enabled: true });
    const line = encodeChainSettings(withFootsteps({}));
    // The game word was written only for the trailer to stand after.
    expect(withoutFootsteps(line)).toEqual(before);
    const gaming = encodeChainSettings(withFootsteps({}, { gameMode: true }));
    expect(withoutFootsteps(gaming)).toEqual(
      encodeChainSettings({ ...DSP_DEFAULTS, enabled: true, gameMode: true }),
    );
  });

  it('goes with the curve for an engine that cannot read the Room', () => {
    const line = appendPresetTone(encodeChainSettings(withFootsteps({})), tone);
    const legacy = legacyChainWithoutInactiveRoom(line);
    expect(legacy).toBeDefined();
    expect(legacy && hasFootsteps(legacy)).toBe(false);
  });

  it('is refused at the boundary when it is not one the engine reads', () => {
    const line = encodeChainSettings(withFootsteps({}));
    const at = line.indexOf(CHAIN_FOOTSTEPS_TAG);
    const broken = (index: number, value: number) => {
      const copy = [...line];
      copy[index] = value;
      return copy;
    };
    expect(isChainWirePayload(line)).toBe(true);
    expect(isChainWirePayload(broken(at + 1, 2))).toBe(false);
    expect(isChainWirePayload(broken(at + 5, 1.5))).toBe(false);
    expect(isChainWirePayload(broken(at + 4, 2))).toBe(false);
    expect(isChainWirePayload(line.slice(0, -1))).toBe(false);
  });
});

describe('the engine that runs it', () => {
  it('is 1.25 and later', () => {
    expect(ENGINE_FOOTSTEPS_SINCE).toEqual([1, 25]);
    expect(engineRunsFootsteps('1.24.0.0')).toBe(false);
    expect(engineRunsFootsteps('1.25.0.0')).toBe(true);
    expect(engineRunsFootsteps(undefined)).toBe(false);
  });
});
