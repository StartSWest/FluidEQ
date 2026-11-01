/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * Presets put on by the core: a picker's pick on the output being edited,
 * written once with its curve and its rack together, and the playing
 * output's rack following a switch of engine with nobody at the window. A
 * song's lent rack stays lent, the hold Equalizer APO puts on a rack is kept
 * by the core, and the edit generation never moves — the window's song
 * memory reads a new one as a replaced editor.
 */
import { ipcMain } from 'electron';
import ChannelEnum from 'common/channels';
import { getDefaultState, IState } from 'common/constants';
import type { TAudioEngine } from 'common/audioEngine';
import { DSP_DEFAULTS, IDspSettings } from 'common/dsp/chain';
import { dspPresetSettings } from 'common/dsp/presets';
import { ErrorCode } from 'common/errors';
import type { IKeptFile } from 'core/files/keptFile';
import createMainSession from 'main/mainSession';
import { createPresetPicks } from 'main/presetPicks';
import registerPresetPicksIpc from 'main/ipc/presetPicks';
import type { TReplySink } from 'main/updatePath';

jest.mock('electron', () => ({ ipcMain: { on: jest.fn() } }));
jest.mock('electron-log', () => ({ error: jest.fn(), info: jest.fn() }));

const factory = (id: string): IDspSettings => {
  const settings = dspPresetSettings(id, DSP_DEFAULTS);
  if (!settings) {
    throw new Error(`${id} missing`);
  }
  return settings;
};
const GAMING = factory('gaming');
const MUSIC = factory('music');
const PLAYING_GAMING = { profileId: 'dsp:gaming', intensity: 1 };
const MAIN = {
  id: 'main',
  name: 'Speakers',
  guid: '{main}',
  isDefault: true,
  isActive: true,
};
const SECOND = { ...MAIN, id: 'second', guid: '{second}', isDefault: false };

/** A kept file held in memory. */
const keptHold = (value = ''): IKeptFile<string> => {
  let held = value;
  return {
    read: () => held,
    keep: (next) => {
      const changed = next !== held;
      held = next;
      return changed;
    },
    onChange: () => () => undefined,
  };
};

const setUp = ({
  engine = 'fluid',
  dsp = { ...DSP_DEFAULTS, enabled: false },
  held = '',
  refuse = false,
}: {
  engine?: TAudioEngine | null;
  dsp?: IDspSettings;
  held?: string;
  refuse?: boolean;
} = {}) => {
  const state: IState = { ...getDefaultState(), dsp };
  const session = createMainSession();
  session.audioEngine = engine;
  session.activeAudioDeviceId = MAIN.id;
  session.activeAudioDevice = MAIN;
  session.playbackAudioDevice = MAIN;
  session.outputEditGeneration = 4;
  const rackHold = keptHold(held);
  /** What the update path was handed, read as it was asked. */
  const updates: { voicing: unknown; dsp: unknown; audible: unknown }[] = [];
  const update = jest.fn(async (sink: TReplySink, label: string) => {
    updates.push({
      voicing: state.voicing,
      dsp: state.dsp,
      audible: session.outputDspOverrides?.get(session.activeAudioDeviceId),
    });
    sink.reply(
      label,
      refuse ? { errorCode: ErrorCode.FAILURE } : { result: undefined },
    );
  });
  /** The main output's own sound, as its profile holds it. */
  const mainSound = { dsp: GAMING, voicing: PLAYING_GAMING };
  /** As `IProfilesIpc.openPlayingOutput`: loads it only where it is not open. */
  const openPlayingOutput = jest.fn(async () => {
    if (session.activeAudioDeviceId !== MAIN.id) {
      session.activeAudioDeviceId = MAIN.id;
      session.activeAudioDevice = MAIN;
      session.outputEditGeneration = (session.outputEditGeneration ?? 0) + 1;
      Object.assign(state, mainSound);
    }
    return true;
  });
  const deps = {
    state,
    session,
    savedChains: () => [],
    rackHold,
    applyingLayer: jest.fn(),
    update,
    runProfileMutation: (work: () => Promise<void>) => work(),
    openPlayingOutput,
    writeLegacyRack: jest.fn(async () => undefined),
    tellWindow: jest.fn(),
  };
  const picks = createPresetPicks(deps);
  const replies: [string, unknown][] = [];
  const sink: TReplySink = {
    reply: (channel, payload) => {
      replies.push([channel, payload]);
    },
  };
  return { state, session, rackHold, updates, deps, picks, sink, replies };
};

describe('a picker’s pick, put on by the core', () => {
  it('puts the curve and the rack on together, writes them once, and keeps the editor’s generation', async () => {
    const { picks, sink, replies, state, session, updates, deps } = setUp();
    await picks.pick(
      { id: 'gaming', quick: true, deviceId: MAIN.id },
      sink,
      'pick',
    );

    // One write, made with both in place: the rack never plays under the
    // curve before it.
    expect(updates).toEqual([
      {
        voicing: expect.objectContaining({ profileId: 'dsp:gaming' }),
        dsp: expect.objectContaining({ presetId: 'gaming', enabled: true }),
        audible: expect.objectContaining({ presetId: 'gaming', enabled: true }),
      },
    ]);
    expect(replies).toEqual([['pick', { result: undefined }]]);
    expect(state.dsp).toBe(session.outputDspOverrides?.get(MAIN.id));
    expect(deps.applyingLayer).toHaveBeenCalledWith('voicing');
    expect(session.outputEditGeneration).toBe(4);
    expect(deps.writeLegacyRack).toHaveBeenCalledTimes(1);
    // The window asked, and reads the answer itself.
    expect(deps.tellWindow).not.toHaveBeenCalled();
  });

  it('refuses a pick made for an output no longer being edited, and changes nothing', async () => {
    const { picks, sink, replies, state, deps } = setUp();
    const before = JSON.parse(JSON.stringify(state)) as IState;
    await picks.pick(
      { id: 'gaming', quick: true, deviceId: SECOND.id },
      sink,
      'pick',
    );
    expect(replies).toEqual([
      ['pick', { errorCode: ErrorCode.INVALID_PARAMETER }],
    ]);
    expect(state).toEqual(before);
    expect(deps.update).not.toHaveBeenCalled();
  });

  it('answers false and changes nothing for a saved chain deleted since', async () => {
    const { picks, sink, replies, state, deps } = setUp();
    const before = JSON.parse(JSON.stringify(state)) as IState;
    await picks.pick(
      { id: 'user-chain:gone', quick: true, deviceId: MAIN.id },
      sink,
      'pick',
    );
    expect(replies).toEqual([['pick', { result: false }]]);
    expect(state).toEqual(before);
    expect(deps.update).not.toHaveBeenCalled();
  });

  /** A song's sound lent to the output, as `songSoundLoan.ts` takes it. */
  const lendSong = (state: IState) => {
    state.songSoundLoan = {
      filters: state.filters,
      isFlat: state.isFlat,
      eqFormat: state.eqFormat,
      graphicEq: state.graphicEq,
      eqImport: state.eqImport,
      tone: state.tone,
      voicing: state.voicing,
    };
  };

  it('keeps a song’s lent rack lent: the pick plays, the profile keeps the listener’s own', async () => {
    const own = { ...MUSIC };
    const { picks, sink, state, session } = setUp({ dsp: own });
    lendSong(state);
    session.outputDspOverrides = new Map([[MAIN.id, factory('movie')]]);
    await picks.pick(
      { id: 'gaming', quick: true, deviceId: MAIN.id },
      sink,
      'pick',
    );
    expect(session.outputDspOverrides.get(MAIN.id)).toMatchObject({
      presetId: 'gaming',
    });
    expect(state.dsp).toBe(own);
  });

  it('keeps the listener’s own rack while a song lent only its tone', async () => {
    const own = { ...MUSIC };
    const { picks, sink, state, session } = setUp({ dsp: own });
    lendSong(state);
    session.outputDspOverrides = new Map([[MAIN.id, { ...MUSIC }]]);
    await picks.pick(
      { id: 'gaming', quick: true, deviceId: MAIN.id },
      sink,
      'pick',
    );
    expect(state.dsp).toBe(own);
    // POSITIVE CONTROL: with no song, the same pick is the output's own.
    state.songSoundLoan = undefined;
    session.outputDspOverrides.set(MAIN.id, { ...MUSIC });
    await picks.pick(
      { id: 'movie', quick: true, deviceId: MAIN.id },
      sink,
      'pick',
    );
    expect(state.dsp).toMatchObject({ presetId: 'movie' });
  });

  it('keeps the listener’s preferences from the rack that plays, a song’s lent one included', async () => {
    const { picks, sink, state, session } = setUp({ dsp: { ...MUSIC } });
    lendSong(state);
    session.outputDspOverrides = new Map([
      [MAIN.id, { ...factory('movie'), surround: { allChannels: false } }],
    ]);
    await picks.pick(
      { id: 'gaming', quick: false, deviceId: MAIN.id },
      sink,
      'pick',
    );
    expect(session.outputDspOverrides.get(MAIN.id)?.surround).toEqual({
      allChannels: false,
    });
    // POSITIVE CONTROL: the rack saved had the other setting.
    expect(state.dsp?.surround).toEqual(DSP_DEFAULTS.surround);
    expect(DSP_DEFAULTS.surround).not.toEqual({ allChannels: false });
  });

  it('keeps the hold Equalizer APO puts on a quick pick’s rack, and lets it go at the next pick that sets a rack', async () => {
    const { picks, sink, rackHold, state } = setUp({ engine: 'apo' });
    await picks.pick(
      { id: 'gaming', quick: true, deviceId: MAIN.id },
      sink,
      'pick',
    );
    expect(rackHold.read()).toBe('gaming');
    expect(state.dsp).toMatchObject({ presetId: 'gaming', enabled: false });

    await picks.pick(
      { id: 'movie', quick: false, deviceId: MAIN.id },
      sink,
      'pick',
    );
    expect(rackHold.read()).toBe('');
    expect(state.dsp).toMatchObject({ presetId: 'movie', enabled: true });
  });

  it('brings no layer back when the curve does not change', async () => {
    const { picks, sink, deps } = setUp();
    await picks.pick(
      { id: 'none', quick: true, deviceId: MAIN.id },
      sink,
      'pick',
    );
    expect(deps.update).toHaveBeenCalledTimes(1);
    expect(deps.applyingLayer).not.toHaveBeenCalled();
  });

  it('writes nothing for an older engine when the update was refused', async () => {
    const { picks, sink, replies, deps } = setUp({ refuse: true });
    await picks.pick(
      { id: 'gaming', quick: true, deviceId: MAIN.id },
      sink,
      'pick',
    );
    expect(replies).toEqual([['pick', { errorCode: ErrorCode.FAILURE }]]);
    expect(deps.writeLegacyRack).not.toHaveBeenCalled();
  });

  it('writes nothing for an older engine, which plays the playing output’s rack, after a pick on another output', async () => {
    const { picks, sink, session, deps } = setUp();
    session.activeAudioDeviceId = SECOND.id;
    session.activeAudioDevice = SECOND;
    await picks.pick(
      { id: 'gaming', quick: true, deviceId: SECOND.id },
      sink,
      'pick',
    );
    // Put on all the same: the pick is for the output edited.
    expect(deps.update).toHaveBeenCalledTimes(1);
    expect(deps.writeLegacyRack).not.toHaveBeenCalled();
  });
});

describe('the playing rack at a switch of engine, followed by the core', () => {
  it('goes back to the playing output first, holds its preset’s rack off for APO and tells the window', async () => {
    const { picks, state, session, rackHold, deps } = setUp({ engine: 'apo' });
    session.activeAudioDeviceId = SECOND.id;
    session.activeAudioDevice = SECOND;
    await picks.followEngineSwitch('fluid');
    expect(deps.openPlayingOutput).toHaveBeenCalledTimes(1);
    expect(session.activeAudioDeviceId).toBe(MAIN.id);
    expect(state.dsp).toMatchObject({
      presetId: 'gaming',
      enabled: false,
      gameMode: false,
    });
    expect(rackHold.read()).toBe('gaming');
    expect(deps.update).toHaveBeenCalledTimes(1);
    expect(deps.tellWindow).toHaveBeenCalledTimes(1);
  });

  it('puts the held rack back whole at the switch home', async () => {
    const { picks, state, rackHold, deps } = setUp({
      engine: 'fluid',
      held: 'gaming',
      dsp: { ...GAMING, enabled: false, gameMode: false },
    });
    state.voicing = PLAYING_GAMING;
    await picks.followEngineSwitch('apo');
    expect(state.dsp).toEqual(GAMING);
    expect(rackHold.read()).toBe('');
    expect(deps.tellWindow).toHaveBeenCalledTimes(1);
  });

  it('writes nothing and tells nobody when the switch leaves the rack as it was, but ends the hold at home', async () => {
    const { picks, rackHold, deps, state } = setUp({
      engine: 'fluid',
      held: 'movie',
      dsp: { ...GAMING, enabled: false },
    });
    state.voicing = PLAYING_GAMING;
    await picks.followEngineSwitch('apo');
    expect(deps.update).not.toHaveBeenCalled();
    expect(deps.tellWindow).not.toHaveBeenCalled();
    expect(rackHold.read()).toBe('');
  });

  it('changes nothing, the hold included, where the editor cannot get back to the playing output', async () => {
    const { picks, rackHold, deps, state } = setUp({
      engine: 'fluid',
      held: 'gaming',
      dsp: { ...GAMING, enabled: false, gameMode: false },
    });
    deps.openPlayingOutput.mockResolvedValueOnce(false);
    const before = JSON.parse(JSON.stringify(state)) as IState;
    await picks.followEngineSwitch('apo');
    expect(state).toEqual(before);
    expect(rackHold.read()).toBe('gaming');
    expect(deps.update).not.toHaveBeenCalled();
  });

  it('follows no first choice of engine, and no switch to the same one', async () => {
    const { picks, deps } = setUp({ engine: 'apo' });
    await picks.followEngineSwitch(null);
    await picks.followEngineSwitch('apo');
    expect(deps.openPlayingOutput).not.toHaveBeenCalled();
  });
});

describe('a pick sent by the window', () => {
  const handler = () => {
    const pick = jest.fn(async () => undefined);
    jest.mocked(ipcMain.on).mockClear();
    registerPresetPicksIpc({ pick });
    const listener = jest
      .mocked(ipcMain.on)
      .mock.calls.find(
        ([channel]) => channel === ChannelEnum.PICK_DSP_PRESET,
      )?.[1];
    if (!listener) {
      throw new Error('No listener');
    }
    const reply = jest.fn();
    const send = (args: unknown[]) =>
      listener({ reply } as unknown as Electron.IpcMainEvent, args);
    return { pick, reply, send };
  };

  it.each([
    ['no id', ['', true, 'main']],
    ['an id too long to name a layer', ['x'.repeat(117), true, 'main']],
    ['no quick flag', ['gaming', 'yes', 'main']],
    ['no output', ['gaming', true, 7]],
  ])('refuses %s', async (_what, args) => {
    const { pick, reply, send } = handler();
    await send(args);
    expect(pick).not.toHaveBeenCalled();
    expect(reply).toHaveBeenCalledWith(ChannelEnum.PICK_DSP_PRESET, {
      errorCode: ErrorCode.INVALID_PARAMETER,
    });
  });

  it('hands a well-formed pick to the core, answering on the request', async () => {
    const { pick, reply, send } = handler();
    await send(['gaming', true, 'main']);
    expect(pick).toHaveBeenCalledWith(
      { id: 'gaming', quick: true, deviceId: 'main' },
      expect.objectContaining({ reply }),
      ChannelEnum.PICK_DSP_PRESET,
    );
  });
});
