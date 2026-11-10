/** @jest-environment node */
/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * A game's own sound on the output, and the music sound back when the game
 * is over (Ivan, 2026-11-02), against real profile files in a folder of their
 * own: the copy, its origin and the loan are files every other path reads,
 * so the test reads them the same way.
 */
import fs from 'fs';
import os from 'os';
import path from 'path';
import ChannelEnum from '../../../common/channels';
import {
  FilterTypeEnum,
  getDefaultState,
  IDeviceProfileAssignment,
  IDeviceProfileSettings,
  IPresetV2,
  IState,
} from '../../../common/constants';
import { DSP_DEFAULTS } from '../../../common/dsp/chain';
import {
  gameCurveVoicing,
  gameCurveVoicingId,
} from '../../../common/dsp/gameCurves';
import { DSP_PRESETS } from '../../../common/dsp/presets';
import { ErrorCode } from '../../../common/errors';
import type { TGameSeed } from '../../../common/gaming';
import { flushPendingWrites } from '../../../main/asyncWriter';
import {
  deletePreset,
  doesPresetExist,
  fetchPreset,
  readPresetText,
  safePresetFileName,
  savePreset,
} from '../../../main/flush';
import {
  createGameLoans,
  createYoursGamingProfiles,
  gameCopyFromSeed,
  gameCopyName,
  gameOriginName,
  returnGameLoans,
  withGameMode,
} from '../../../main/gameSound';
import { registerGameSoundIpc } from '../../../main/ipc/gameSound';
import onWindowMessage from '../../../main/ipc/windowMessages';
import createMainSession, {
  type IMainSession,
} from '../../../main/mainSession';
import putPresetInState from '../../../main/presetIntoState';
import { getAutomaticPresetName } from '../../../main/profileStore';
import gameSeedFor from '../../../renderer/games/gameSeed';

jest.mock('../../../main/ipc/windowMessages', () => ({
  __esModule: true,
  default: jest.fn(),
}));
jest.mock('../../../main/deviceProfileSettings', () => ({
  saveDeviceProfileSettings: jest.fn(async () => undefined),
}));

type THandler = (event: { reply: jest.Mock }, arg: unknown) => unknown;

const OUTPUT = 'speakers';
const OTHER = 'headset';

const assignment = (
  deviceId: string,
  presetName: string,
): IDeviceProfileAssignment => ({
  deviceId,
  deviceName: deviceId,
  deviceGuid: `{${deviceId}}`,
  presetName,
});

const competitiveChain = (() => {
  const preset = DSP_PRESETS.find((each) => each.id === 'gaming-competitive');
  if (!preset) {
    throw new Error('the Competitive gaming chain is gone');
  }
  return preset;
})();

const readySeed: TGameSeed = {
  kind: 'rack',
  dsp: competitiveChain.settings,
  gameCurve: gameCurveVoicingId('competitive'),
};

/** A music sound with something of its own in every part a copy could take. */
const musicSound = (): IPresetV2 => ({
  preAmp: -4,
  isAutoPreAmpOn: false,
  filters: {
    a: {
      id: 'a',
      frequency: 120,
      gain: 5,
      quality: 1,
      type: FilterTypeEnum.PK,
    },
  },
  dsp: { ...DSP_DEFAULTS, presetId: 'rock' },
});

describe('the loans kept on disk', () => {
  let dir: string;
  beforeEach(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'fluideq-game-loans-'));
  });
  afterEach(async () => {
    // Every write a test started lands before its folder goes, or it lands
    // in the next test's turn.
    await flushPendingWrites();
    fs.rmSync(dir, { recursive: true, force: true });
  });

  it('are read back by the next launch, and an unreadable entry is left out', async () => {
    const loans = createGameLoans(dir);
    await loans.set(OUTPUT, { gameId: 'cs2', musicPresetName: 'Music' });
    await flushPendingWrites();
    const file = path.join(dir, 'game-sound.json');
    const kept = JSON.parse(fs.readFileSync(file, 'utf8'));
    kept.loans[OTHER] = { gameId: '', musicPresetName: 'Gone' };
    fs.writeFileSync(file, JSON.stringify(kept));
    const next = createGameLoans(dir);
    expect(next.entries()).toEqual([
      [OUTPUT, { gameId: 'cs2', musicPresetName: 'Music' }],
    ]);
  });

  it('are none on a first run', () => {
    expect(createGameLoans(dir).entries()).toEqual([]);
  });

  it('give every output left on a game its own profile back at launch', async () => {
    const loans = createGameLoans(dir);
    await loans.set(OUTPUT, { gameId: 'cs2', musicPresetName: 'Music' });
    await loans.set(OTHER, { gameId: 'cs2', musicPresetName: 'Headset' });
    const settings: IDeviceProfileSettings = {
      version: 1,
      assignments: {
        [OUTPUT]: assignment(OUTPUT, gameCopyName('cs2')),
        // Somebody picked a profile of their own here while the game played.
        [OTHER]: assignment(OTHER, 'Picked'),
      },
    };
    expect(returnGameLoans(loans, settings)).toBe(true);
    expect(settings.assignments[OUTPUT].presetName).toBe('Music');
    expect(settings.assignments[OTHER].presetName).toBe('Picked');
    expect(loans.entries()).toEqual([]);
  });
});

describe('a game’s copy as its Gaming profile makes it', () => {
  it('is a new profile’s sound with the chain and its game curve, Game mode on', () => {
    const copy = gameCopyFromSeed(musicSound(), readySeed, undefined);
    expect(copy?.dsp?.presetId).toBe('gaming-competitive');
    expect(copy?.dsp?.gameMode).toBe(true);
    expect(copy?.voicing).toEqual(
      gameCurveVoicing(gameCurveVoicingId('competitive')),
    );
    // Nothing of the music's tuning, only the listener's Auto normalize.
    expect(copy?.filters).not.toEqual(musicSound().filters);
    expect(copy?.preAmp).not.toBe(-4);
    expect(copy?.isAutoPreAmpOn).toBe(false);
  });

  it('gives Heroes its own voicing and offers Wide Stage only with Room enabled', () => {
    const rack = {
      ...DSP_DEFAULTS,
      room: { ...DSP_DEFAULTS.room, enabled: true },
    };
    const seed = gameSeedFor('ready:hots', rack);
    if (!seed) {
      throw new Error('The Heroes profile is missing');
    }
    const copy = gameCopyFromSeed(musicSound(), seed, undefined);
    expect(copy?.voicing).toEqual(gameCurveVoicing(gameCurveVoicingId('hots')));
    expect(copy?.dsp).toMatchObject({
      gameMode: true,
      normalizer: { mode: 'off' },
      master: { enabled: false },
      footsteps: { enabled: true, lift: 0.23, useRoom: false, duck: false },
      room: { enabled: true, presetId: 'wideStageV2', preservePosition: true },
      dynamics: { enabled: false },
      dimension: { enabled: false },
    });
    expect(gameSeedFor('ready:hots', DSP_DEFAULTS)).toMatchObject({
      gameCurve: gameCurveVoicingId('hots'),
      dsp: { room: { enabled: false }, footsteps: { lift: 0.35 } },
    });
    expect(gameSeedFor('ready:lol', rack)).toMatchObject({
      gameCurve: gameCurveVoicingId('moba'),
      dsp: { room: { enabled: true }, footsteps: { lift: 0.6 } },
    });
    expect(gameSeedFor('ready:dota2', rack)).toMatchObject({
      gameCurve: gameCurveVoicingId('moba'),
      dsp: { room: { enabled: true }, footsteps: { lift: 0.6 } },
    });
  });

  it('is one of the listener’s own whole, with Game mode on, or nothing once it is gone', () => {
    const own = musicSound();
    expect(
      gameCopyFromSeed(musicSound(), { kind: 'yours', id: 'x' }, own),
    ).toEqual(withGameMode(own));
    expect(
      gameCopyFromSeed(musicSound(), { kind: 'yours', id: 'x' }, undefined),
    ).toBeUndefined();
  });
});

describe('the listener’s own Gaming profiles', () => {
  let dir: string;
  beforeEach(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'fluideq-gaming-profiles-'));
  });
  afterEach(async () => {
    // Every write a test started lands before its folder goes, or it lands
    // in the next test's turn.
    await flushPendingWrites();
    fs.rmSync(dir, { recursive: true, force: true });
  });

  it('are kept, listed by name, renamed, updated and deleted', async () => {
    const yours = createYoursGamingProfiles(dir);
    const zulu = await yours.save('Zulu', 'Counter-Strike 2', musicSound());
    const alpha = await yours.save('  Alpha  ', 'Cyberpunk 2077', musicSound());
    await flushPendingWrites();
    expect(yours.list().map((each) => each.name)).toEqual(['Alpha', 'Zulu']);
    await yours.rename(zulu.id, 'Bravo');
    await yours.update(alpha.id, { ...musicSound(), preAmp: -9 });
    await flushPendingWrites();
    expect(yours.list().map((each) => each.name)).toEqual(['Alpha', 'Bravo']);
    expect(yours.sound(alpha.id)?.preAmp).toBe(-9);
    yours.remove(zulu.id);
    expect(yours.list().map((each) => each.id)).toEqual([alpha.id]);
  });

  it('refuses a profile with no name, and an id that is not one of theirs', async () => {
    const yours = createYoursGamingProfiles(dir);
    await expect(yours.save('   ', 'Game', musicSound())).rejects.toThrow();
    expect(() => yours.remove('../game-sound')).toThrow();
    expect(yours.sound('../../secrets')).toBeUndefined();
  });
});

describe('the game sound messages', () => {
  let root: string;
  let state: IState;
  let session: IMainSession;
  let settings: IDeviceProfileSettings;
  let loans: ReturnType<typeof createGameLoans>;
  let handlers: Map<string, THandler>;
  const handleError = jest.fn();
  const handleUpdate = jest.fn(async () => undefined);
  const notifyOutputStateChanged = jest.fn();
  const createEmptyProfileForActiveDevice = jest.fn();

  const dirOf = (deviceId: string) => {
    const dir = path.join(root, 'outputs', deviceId);
    fs.mkdirSync(dir, { recursive: true });
    return dir;
  };
  const presetDirForDevice = jest.fn(dirOf);

  /** The live sound, as main's profile store builds it from the state. */
  const getCurrentPreset = (): IPresetV2 => ({
    dsp: state.dsp,
    preAmp: state.preAmp,
    filters: state.filters,
    isAutoPreAmpOn: state.isAutoPreAmpOn,
    voicing: state.voicing,
  });

  /** One message, and everything it queued, finished. */
  const send = async (channel: ChannelEnum, args: unknown[] = []) => {
    const handler = handlers.get(channel);
    if (!handler) {
      throw new Error(`nothing listens on ${channel}`);
    }
    const event = { reply: jest.fn() };
    await handler(event, args);
    await queue;
    await flushPendingWrites();
    return event;
  };
  const expectTunedParts = (reply: jest.Mock, result: string[]) =>
    expect(reply).toHaveBeenCalledWith(ChannelEnum.GAME_SOUND_TUNED, {
      result,
    });

  let queue: Promise<void> = Promise.resolve();

  beforeEach(async () => {
    jest.clearAllMocks();
    root = fs.mkdtempSync(path.join(os.tmpdir(), 'fluideq-game-ipc-'));
    state = getDefaultState();
    session = { activeAudioDeviceId: OUTPUT } as IMainSession;
    settings = {
      version: 1,
      assignments: { [OUTPUT]: assignment(OUTPUT, 'Music') },
    };
    await savePreset('Music', musicSound(), dirOf(OUTPUT));
    putPresetInState(state, session, musicSound());
    loans = createGameLoans(root);
    handlers = new Map();
    queue = Promise.resolve();
    jest
      .mocked(onWindowMessage)
      .mockImplementation((channel: string, handler: unknown) => {
        handlers.set(channel, handler as THandler);
        return () => handlers.delete(channel);
      });
    registerGameSoundIpc({
      state,
      session,
      deviceProfileSettings: settings,
      userDataDir: root,
      presetDirForDevice,
      loans,
      yours: createYoursGamingProfiles(root),
      runProfileMutation: (work) => {
        queue = queue.then(work);
        return queue;
      },
      attachPresetToActiveDevice: (presetName) => {
        settings.assignments[session.activeAudioDeviceId] = assignment(
          session.activeAudioDeviceId,
          presetName,
        );
      },
      createEmptyProfileForActiveDevice,
      getCurrentPreset,
      hydrateActiveConvolution: jest.fn(),
      notifyOutputStateChanged,
      handleUpdate,
      handleError,
    });
  });

  afterEach(async () => {
    await flushPendingWrites().catch(() => undefined);
    fs.rmSync(root, { recursive: true, force: true });
  });

  it('puts a game’s own sound on, made from its profile, and keeps the music sound to give back', async () => {
    await send(ChannelEnum.GAME_SOUND_LOAD, ['cs2', readySeed]);
    const copy = gameCopyName('cs2');
    expect(settings.assignments[OUTPUT].presetName).toBe(copy);
    expect(loans.get(OUTPUT)).toEqual({
      gameId: 'cs2',
      musicPresetName: 'Music',
    });
    expect(state.dsp?.presetId).toBe('gaming-competitive');
    expect(state.dsp?.gameMode).toBe(true);
    expect(doesPresetExist(gameOriginName('cs2'), dirOf(OUTPUT))).toBe(true);
    expect(handleError).not.toHaveBeenCalled();
    const snapshot = await send(ChannelEnum.GAME_SOUND_STATE);
    expect(snapshot.reply).toHaveBeenCalledWith(ChannelEnum.GAME_SOUND_STATE, {
      result: expect.objectContaining({
        gameId: 'cs2',
        profile: { name: copy, voicing: state.voicing, voicingBypassed: false },
      }),
    });
  });

  it('lends the same music sound to a second game in a row', async () => {
    await send(ChannelEnum.GAME_SOUND_LOAD, ['cs2', readySeed]);
    await send(ChannelEnum.GAME_SOUND_LOAD, ['cyberpunk', readySeed]);
    expect(loans.get(OUTPUT)).toEqual({
      gameId: 'cyberpunk',
      musicPresetName: 'Music',
    });
  });

  it('gives the music sound back on Unload', async () => {
    await send(ChannelEnum.GAME_SOUND_LOAD, ['cs2', readySeed]);
    await send(ChannelEnum.GAME_SOUND_UNLOAD);
    expect(settings.assignments[OUTPUT].presetName).toBe('Music');
    expect(state.dsp?.presetId).toBe('rock');
    expect(state.preAmp).toBe(-4);
    expect(loans.entries()).toEqual([]);
    const snapshot = await send(ChannelEnum.GAME_SOUND_STATE);
    expect(snapshot.reply).toHaveBeenCalledWith(ChannelEnum.GAME_SOUND_STATE, {
      result: expect.objectContaining({
        gameId: undefined,
        profile: {
          name: 'Music',
          voicing: state.voicing,
          voicingBypassed: false,
        },
      }),
    });
  });

  it('keeps the live sound as a profile to come back to when the output had none', async () => {
    delete settings.assignments[OUTPUT];
    await send(ChannelEnum.GAME_SOUND_LOAD, ['cs2', readySeed]);
    const kept = getAutomaticPresetName(OUTPUT);
    expect(loans.get(OUTPUT)?.musicPresetName).toBe(kept);
    expect(fetchPreset(kept, dirOf(OUTPUT)).dsp?.presetId).toBe('rock');
  });

  it('starts an empty profile when the music profile was deleted while the game played', async () => {
    await send(ChannelEnum.GAME_SOUND_LOAD, ['cs2', readySeed]);
    // Deleted the way the profile picker deletes one.
    await deletePreset('Music', dirOf(OUTPUT));
    await send(ChannelEnum.GAME_SOUND_UNLOAD);
    expect(createEmptyProfileForActiveDevice).toHaveBeenCalledTimes(1);
    expect(loans.entries()).toEqual([]);
  });

  it('puts Game mode back on a copy that was switched to off', async () => {
    await send(ChannelEnum.GAME_SOUND_LOAD, ['cs2', readySeed]);
    await send(ChannelEnum.GAME_SOUND_UNLOAD);
    const copy = gameCopyName('cs2');
    const kept = fetchPreset(copy, dirOf(OUTPUT));
    await savePreset(
      copy,
      { ...kept, dsp: { ...DSP_DEFAULTS, ...kept.dsp, gameMode: false } },
      dirOf(OUTPUT),
    );
    await send(ChannelEnum.GAME_SOUND_LOAD, ['cs2', readySeed]);
    expect(state.dsp?.gameMode).toBe(true);
  });

  it('keeps an older saved game edit until Reset to Profile applies the current factory gains', async () => {
    const seed = gameSeedFor('ready:hots', DSP_DEFAULTS);
    if (!seed) {
      throw new Error('Missing Heroes factory seed');
    }
    const id = 'hots';
    const dir = dirOf(OUTPUT);
    const name = gameCopyName(id);
    await send(ChannelEnum.GAME_SOUND_LOAD, [id, seed]);
    await send(ChannelEnum.GAME_SOUND_UNLOAD);
    const kept = fetchPreset(name, dir);
    const oldDsp = {
      ...DSP_DEFAULTS,
      ...kept.dsp,
      gameMode: true,
      normalizer: {
        mode: 'loudness' as const,
        targetLufs: -18,
        truePeakDbtp: -3,
      },
    };
    await savePreset(name, { ...kept, dsp: oldDsp }, dir);
    await send(ChannelEnum.GAME_SOUND_LOAD, [id, seed]);
    expect(state.dsp?.normalizer).toEqual(oldDsp.normalizer);

    await send(ChannelEnum.GAME_SOUND_RESET, [id, seed]);
    expect(state.dsp).toMatchObject({
      gameMode: true,
      normalizer: { mode: 'off' },
      master: { enabled: false },
      footsteps: { lift: 0.35, duck: false },
    });
    expect(fetchPreset(name, dir).dsp?.normalizer.mode).toBe('off');
  });

  it('answers a saved game during startup, then compares its unchanged files once an output is selected', async () => {
    const id = 'game-startup-123456';
    const copy = gameCopyName(id);
    const origin = gameOriginName(id);
    const dir = dirOf(OUTPUT);
    await savePreset(origin, musicSound(), dir);
    await savePreset(copy, { ...musicSound(), filters: {} }, dir);
    const readFiles = () =>
      [copy, origin].map((name) => readPresetText(name, dir));
    const before = readFiles();
    session.activeAudioDeviceId = createMainSession().activeAudioDeviceId;

    const early = await send(ChannelEnum.GAME_SOUND_TUNED, [id]);
    expectTunedParts(early.reply, []);
    expect(presetDirForDevice).not.toHaveBeenCalled();
    expect(handleError).not.toHaveBeenCalled();
    session.activeAudioDeviceId = OUTPUT;
    const ready = await send(ChannelEnum.GAME_SOUND_TUNED, [id]);
    expectTunedParts(ready.reply, ['mainEq']);
    expect(readFiles()).toEqual(before);
    expect(handleUpdate).not.toHaveBeenCalled();
  });

  it('still rejects a malformed game id before an output is selected', async () => {
    session.activeAudioDeviceId = createMainSession().activeAudioDeviceId;
    const event = await send(ChannelEnum.GAME_SOUND_TUNED, ['  ']);
    expect(handleError).toHaveBeenCalledWith(
      event,
      ChannelEnum.GAME_SOUND_TUNED,
      ErrorCode.INVALID_PARAMETER,
    );
    expect(presetDirForDevice).not.toHaveBeenCalled();
  });

  it('reports an unreadable origin instead of calling the copy untouched', async () => {
    const id = 'game-corrupt-123456';
    const dir = dirOf(OUTPUT);
    const name = safePresetFileName(gameOriginName(id));
    if (!name) {
      throw new Error('Expected a valid game origin fixture name');
    }
    await savePreset(gameCopyName(id), musicSound(), dir);
    fs.writeFileSync(path.join(dir, name), '{broken fixture');

    const event = await send(ChannelEnum.GAME_SOUND_TUNED, [id]);
    expect(handleError).toHaveBeenCalledWith(
      event,
      ChannelEnum.GAME_SOUND_TUNED,
      ErrorCode.FAILURE,
    );
    expect(event.reply).not.toHaveBeenCalled();
    expect(fs.readFileSync(path.join(dir, name), 'utf8')).toBe(
      '{broken fixture',
    );
  });

  it('says which parts were tuned, and none once the game is saved as a profile', async () => {
    await send(ChannelEnum.GAME_SOUND_LOAD, ['cs2', readySeed]);
    const untouched = await send(ChannelEnum.GAME_SOUND_TUNED, ['cs2']);
    expectTunedParts(untouched.reply, []);
    state.dsp = {
      ...DSP_DEFAULTS,
      ...state.dsp,
      footsteps: { ...DSP_DEFAULTS.footsteps, enabled: true, lift: 0.2 },
    };
    const tuned = await send(ChannelEnum.GAME_SOUND_TUNED, ['cs2']);
    expectTunedParts(tuned.reply, ['footsteps']);
    await send(ChannelEnum.GAMING_PROFILE_SAVE, [
      'cs2',
      'My steps',
      'Counter-Strike 2',
    ]);
    const saved = await send(ChannelEnum.GAME_SOUND_TUNED, ['cs2']);
    expectTunedParts(saved.reply, []);
    expect(handleError).not.toHaveBeenCalled();
  });

  it('gives the music sound back before deleting a playing game, and takes its files', async () => {
    await send(ChannelEnum.GAME_SOUND_LOAD, ['cs2', readySeed]);
    await send(ChannelEnum.GAME_SOUND_DELETE, ['cs2']);
    expect(settings.assignments[OUTPUT].presetName).toBe('Music');
    expect(loans.entries()).toEqual([]);
    expect(doesPresetExist(gameCopyName('cs2'), dirOf(OUTPUT))).toBe(false);
    expect(doesPresetExist(gameOriginName('cs2'), dirOf(OUTPUT))).toBe(false);
  });

  it('refuses a game id with a control character, and a seed main cannot make a copy from', async () => {
    await send(ChannelEnum.GAME_SOUND_LOAD, ['cs2\u0000', readySeed]);
    await send(ChannelEnum.GAME_SOUND_LOAD, ['cs2', { kind: 'chain' }]);
    expect(handleError).toHaveBeenCalledTimes(2);
    expect(handleError).toHaveBeenLastCalledWith(
      expect.anything(),
      ChannelEnum.GAME_SOUND_LOAD,
      ErrorCode.INVALID_PARAMETER,
    );
    expect(settings.assignments[OUTPUT].presetName).toBe('Music');
  });
});
