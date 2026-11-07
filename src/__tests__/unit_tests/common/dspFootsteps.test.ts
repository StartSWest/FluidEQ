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
  asFootstepsAlone,
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
  footstepsPresetOf,
  footstepsPresetSettings,
  footstepsSettingsOf,
} from '../../../common/dsp/footstepsPresets';
import {
  CHAIN_FOOTSTEPS_TAG,
  CHAIN_FOOTSTEPS_TRAILER,
  CHAIN_GAME_SCHEMA,
  CHAIN_GAME_TRAILER,
} from '../../../common/dsp/footstepsWire';
import {
  ENGINE_READS_NONE,
  engineReadsOf,
  lineForEngine,
} from '../../../common/dsp/engineLine';
import { DSP_PRESETS } from '../../../common/dsp/presets';
import { FOOTSTEPS_CATALOGUE } from '../../../common/dsp/stageCatalogues';
import {
  ENGINE_FOOTSTEPS_SINCE,
  ENGINE_GAME_SINCE,
  engineRunsFootsteps,
  engineRunsGame,
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

  it('names every kind in English with its games', () => {
    const kinds = FOOTSTEPS_PRESETS.filter(
      (preset) => preset.title === undefined,
    );
    expect(kinds.length).toBeGreaterThan(0);
    kinds.forEach((preset) => {
      expect(en).toHaveProperty([preset.labelKey]);
      expect(en).toHaveProperty([preset.hintKey ?? '']);
    });
  });

  it('names every title by the game’s own name', () => {
    const titles = FOOTSTEPS_PRESETS.filter(
      (preset) => preset.title !== undefined,
    );
    expect(titles.length).toBeGreaterThan(0);
    titles.forEach((preset) => expect(preset.title?.length).toBeGreaterThan(0));
  });

  it('lifts more the larger and louder the kind of game', () => {
    const [competitive, battle, tactical, story] = [
      'competitive',
      'battleRoyale',
      'tactical',
      'story',
    ].map((id) => FOOTSTEPS_CATALOGUE.settings(id, true));
    expect(battle?.lift).toBeGreaterThan(competitive?.lift ?? 1);
    expect(story?.lift).toBeLessThan(tactical?.lift ?? 0);
  });

  it('adds cues without riding the score in any fresh Game preset', () => {
    FOOTSTEPS_PRESETS.forEach(({ settings }) => {
      expect(settings.lift).toBeGreaterThan(0);
      expect(settings).toMatchObject({
        calm: 0,
        environment: 0,
        voices: 0,
        duck: false,
      });
    });
    DSP_PRESETS.filter(
      ({ group, id }) => group === 'gaming' && id !== 'game-night',
    ).forEach(({ settings }) => {
      expect(settings.normalizer.mode).toBe('off');
      expect(settings.master.enabled).toBe(false);
      expect(settings.dynamics.enabled).toBe(false);
      expect(settings.bassForge.enabled).toBe(false);
      expect(settings.bassPunch.enabled).toBe(false);
      expect(settings.dimension.enabled).toBe(false);
      expect(settings.eq.monoBelowHz).toBe(0);
      expect(
        settings.eq.bands.some((band) => band.enabled && band.dynamic),
      ).toBe(false);
      expect(settings.maximizer.driveDb).toBe(0);
      expect(settings.footsteps.enabled).toBe(true);
    });
    // An explicitly compressed low-volume profile still does what its name says.
    expect(
      DSP_PRESETS.find(({ id }) => id === 'game-night')?.settings.dynamics
        .enabled,
    ).toBe(true);
  });
});

describe('a stored Footsteps read back', () => {
  it('keeps deliberate processing even when its factory preset has changed', () => {
    const saved = {
      ...FOOTSTEPS_DEFAULTS,
      enabled: true,
      lift: 0.4,
      calm: 0.7,
      environment: -0.6,
      voices: 0.8,
      duck: true,
      heavy: true,
      useRoom: true,
    };
    expect(clampFootstepsSettings(saved)).toEqual(saved);
  });
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
        environment: -3,
        voices: 2,
      }),
    ).toEqual({
      enabled: true,
      isolate: false,
      presetId: '',
      lift: 1,
      calm: 0,
      heavy: false,
      environment: -1,
      voices: 1,
      duck: false,
      useRoom: false,
    });
  });

  it('reads a Footsteps saved before the filter’s other parts as having none of them', () => {
    // Tuned by hand when the filter was Footsteps alone: it has to sound as
    // it did, with no Environment and no Dialogue it never had.
    expect(
      clampFootstepsSettings({
        enabled: true,
        lift: 0.4,
        calm: 0.2,
        presetId: 'competitive',
      }),
    ).toEqual({
      ...FOOTSTEPS_DEFAULTS,
      enabled: true,
      lift: 0.4,
      calm: 0.2,
      environment: 0,
      voices: 0,
    });
  });
});

describe('the chains that turn it on', () => {
  it('are the three Gaming chains and the ten for kinds of game', () => {
    const on = DSP_PRESETS.filter(
      (preset) => preset.settings.footsteps.enabled,
    );
    expect(on.map((preset) => preset.id).sort()).toEqual([
      'game-blast',
      'game-cinematic',
      'game-dread',
      'game-impact',
      'game-night',
      'game-pinpoint',
      'game-speed',
      'game-stealth',
      'game-topdown',
      'game-worlds',
      'gaming',
      'gaming-competitive',
      'gaming-room',
    ]);
  });

  it('each play the Game filter profile they name, the Room’s copies saying so', () => {
    DSP_PRESETS.filter((preset) => preset.settings.footsteps.enabled).forEach(
      (preset) => {
        const { footsteps, room } = preset.settings;
        const named = footstepsPresetOf(footsteps.presetId);
        expect(named).toBeDefined();
        expect(footsteps).toEqual(
          named &&
            footstepsSettingsOf(named, true, {
              // Having the Room on is how a listener says they wear
              // headphones.
              useRoom: room.enabled,
            }),
        );
      },
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

  it('stands after a game word written off, with its eight values', () => {
    const line = encodeChainSettings(
      withFootsteps({
        isolate: true,
        lift: 0.4,
        calm: 0.2,
        heavy: true,
        environment: -0.6,
        voices: 0.5,
        duck: true,
      }),
    );
    const gameWord = chainWireLength(DSP_DEFAULTS.eq.bands.length);
    expect(line[gameWord]).toBe(0);
    expect(line.slice(gameWord + 1)).toEqual([
      CHAIN_FOOTSTEPS_TAG,
      CHAIN_GAME_SCHEMA,
      8,
      1,
      1,
      0.4,
      0.2,
      1,
      -0.6,
      0.5,
      1,
    ]);
    expect(isChainWirePayload(line)).toBe(true);
    expect(hasFootsteps(line)).toBe(true);
  });

  it('reaches engine 1.25 as Footsteps alone, the rest of the line kept', () => {
    const line = appendPresetTone(
      encodeChainSettings(
        withFootsteps({ isolate: true, lift: 0.4, calm: 0.2, voices: 0.5 }),
      ),
      tone,
    );
    const alone = asFootstepsAlone(line);
    const at = alone.indexOf(CHAIN_FOOTSTEPS_TAG);
    expect(alone.slice(at, at + CHAIN_FOOTSTEPS_TRAILER)).toEqual([
      CHAIN_FOOTSTEPS_TAG,
      1,
      4,
      1,
      1,
      0.4,
      0.2,
    ]);
    expect(alone).toHaveLength(
      line.length - (CHAIN_GAME_TRAILER - CHAIN_FOOTSTEPS_TRAILER),
    );
    expect(isChainWirePayload(alone)).toBe(true);
    expect(hasPresetTone(alone)).toBe(true);
    // Already Footsteps alone, or without the filter: nothing to cut.
    expect(asFootstepsAlone(alone)).toEqual(alone);
    const plain = encodeChainSettings({ ...DSP_DEFAULTS, enabled: true });
    expect(asFootstepsAlone(plain)).toEqual(plain);
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
    expect(curve).toBe(footsteps + CHAIN_GAME_TRAILER);
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
    // A schema no engine reads, and schema 1 claiming the Game filter's
    // eight fields.
    expect(isChainWirePayload(broken(at + 1, 3))).toBe(false);
    expect(isChainWirePayload(broken(at + 1, 1))).toBe(false);
    expect(isChainWirePayload(broken(at + 2, 4))).toBe(false);
    // Isolate, Lift, Heavy, Environment, Voices and Duck out of range.
    expect(isChainWirePayload(broken(at + 4, 2))).toBe(false);
    expect(isChainWirePayload(broken(at + 5, 1.5))).toBe(false);
    expect(isChainWirePayload(broken(at + 7, 2))).toBe(false);
    expect(isChainWirePayload(broken(at + 8, -1.5))).toBe(false);
    expect(isChainWirePayload(broken(at + 9, 1.5))).toBe(false);
    expect(isChainWirePayload(broken(at + 10, 0.5))).toBe(false);
    expect(isChainWirePayload(line.slice(0, -1))).toBe(false);
  });
});

describe('the engine that runs it', () => {
  it('is 1.25 and later for Footsteps, 1.26 and later for the whole filter', () => {
    expect(ENGINE_FOOTSTEPS_SINCE).toEqual([1, 25]);
    expect(engineRunsFootsteps('1.24.0.0')).toBe(false);
    expect(engineRunsFootsteps('1.25.0.0')).toBe(true);
    expect(engineRunsFootsteps(undefined)).toBe(false);
    expect(ENGINE_GAME_SINCE).toEqual([1, 26]);
    expect(engineRunsGame('1.25.0.0')).toBe(false);
    expect(engineRunsGame('1.26.0.0')).toBe(true);
    expect(engineRunsGame(undefined)).toBe(false);
  });

  it('gets the line it reads, and an older one never a trailer it would refuse the rack over', () => {
    const line = appendPresetTone(
      encodeChainSettings(withFootsteps({ voices: 0.5 })),
      tone,
    );
    expect(lineForEngine(line, engineReadsOf('1.27.0.0'))).toEqual(line);
    expect(lineForEngine(line, engineReadsOf('1.26.0.0'))).toEqual(line);
    expect(lineForEngine(line, engineReadsOf('1.25.0.0'))).toEqual(
      asFootstepsAlone(line),
    );
    const older = lineForEngine(line, engineReadsOf('1.24.0.0'));
    expect(hasFootsteps(older)).toBe(false);
    expect(hasPresetTone(older)).toBe(true);
    expect(lineForEngine(line, ENGINE_READS_NONE)).toEqual(older);
  });
});
