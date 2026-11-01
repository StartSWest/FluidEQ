/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * The Smart EQ song memory as the core runs it: the reducer's rules
 * (`common/songEqRecorder.test.ts`) performed on the edited output's real
 * layer, written through a stand-in for the update path that hands the
 * layer back the way `followTheSound` does, on a clock of heard sound.
 *
 * These were the window shell's tests while the window ran it.
 */
import { FilterTypeEnum, type ISmartEqSettings } from 'common/constants';
import type { ISongEqEntry } from 'common/songEq';
import { buildSongIdentity, type ISongIdentity } from 'common/songIdentity';
import { sanitizeSmartEqSettings } from 'common/smartEq';
import {
  SONG_EQ_MIN_LISTENED_MS,
  SONG_EQ_SETTLE_MS,
} from 'common/songEqRecorder';
import type { ISongEqStatus } from 'common/songEqStatus';
import createHeardClock from 'core/systemSound/heardClock';
import type {
  ISystemSound,
  ISystemSoundListener,
} from 'core/systemSound/systemSound';
import { createSongEqMemory } from 'main/songEqMemory';

jest.mock('electron-log', () => ({ error: jest.fn() }));

const layerOf = (gain: number): ISmartEqSettings => ({
  filters: {
    'smart-1000': {
      id: 'smart-1000',
      frequency: 1000,
      gain,
      quality: 1.4,
      type: FilterTypeEnum.PK,
    },
  },
});

const entryOf = (title: string, settings: ISmartEqSettings): ISongEqEntry => ({
  settings,
  title,
  plays: 1,
  updatedAt: 0,
});

const song = (title: string): ISongIdentity => {
  const identity = buildSongIdentity('library', title, title, 'Artist');
  if (!identity) {
    throw new Error('test fixture produced no identity');
  }
  return identity;
};

const flush = async () => {
  for (let turn = 0; turn < 6; turn += 1) {
    // eslint-disable-next-line no-await-in-loop -- each turn lets one link of the write chain run
    await Promise.resolve();
  }
};

const setUp = ({ canHear = true } = {}) => {
  const listeners: ISystemSoundListener[] = [];
  const systemSound: ISystemSound = {
    listen: (listener) => {
      if (!canHear) {
        listener.lost();
        return () => undefined;
      }
      listeners.push(listener);
      return () => {
        listeners.splice(listeners.indexOf(listener), 1);
      };
    },
  };
  const remembered = new Map<string, ISongEqEntry>();
  const entries = {
    lookup: jest.fn((deviceId: string, identity: ISongIdentity) =>
      remembered.get(`${deviceId}|${identity.key}`),
    ),
    checkpoint: jest.fn(),
    commit: jest.fn(),
    forget: jest.fn(),
  };
  const output = {
    deviceId: 'device-a',
    layer: undefined as ISmartEqSettings | undefined,
    isAutoEqRunning: false,
  };
  const statuses: ISongEqStatus[] = [];
  const shown: (ISmartEqSettings | undefined)[] = [];
  // Declared before the stand-in update path, which follows it.
  let memory: ReturnType<typeof createSongEqMemory>;
  const follow = () => memory.follow({ ...output });
  const writeLayer = jest.fn(async (layer: ISmartEqSettings | undefined) => {
    output.layer = sanitizeSmartEqSettings(layer);
    follow();
    return true;
  });
  memory = createSongEqMemory({
    entries,
    writeLayer,
    editedDevice: () => output.deviceId,
    tellWindowLayer: (layer) => shown.push(layer),
    tellWindowStatus: (status) => statuses.push(status),
    createClock: (options) => createHeardClock({ systemSound, ...options }),
  });
  /** Time passing, heard as sound by the core's clock. */
  const hear = (ms: number) => {
    const steps = Math.ceil(ms / 250);
    for (let step = 0; step < steps; step += 1) {
      jest.setSystemTime(Date.now() + 250);
      listeners.forEach((listener) =>
        listener.audio({
          sampleRate: 48000,
          channels: 2,
          frames: 12000,
          sequence: 0,
          pcm: new ArrayBuffer(0),
        }),
      );
    }
  };
  /** An edit by somebody else: the update path, with no memory behind it. */
  const edit = (layer: ISmartEqSettings | undefined) => {
    output.layer = layer;
    follow();
  };
  const lastStatus = () => statuses[statuses.length - 1];
  return {
    memory,
    entries,
    remembered,
    output,
    follow,
    writeLayer,
    statuses,
    shown,
    hear,
    edit,
    lastStatus,
  };
};

beforeEach(() => {
  jest.useFakeTimers({ now: 1_000_000 });
});

afterEach(() => {
  jest.useRealTimers();
});

it('turns saving on only while an automatic mode is running', () => {
  const { memory, output, follow, lastStatus } = setUp();
  follow();
  memory.act({ kind: 'setSaveOn', isSaveOn: true });
  expect(memory.status().isSaveOn).toBe(false);
  // POSITIVE CONTROL: the same press, with a running mode behind it.
  output.isAutoEqRunning = true;
  follow();
  memory.act({ kind: 'setSaveOn', isSaveOn: true });
  expect(lastStatus().isSaveOn).toBe(true);
});

it('starts saving from off each time an automatic mode is switched on', () => {
  const { memory, output, follow } = setUp();
  output.isAutoEqRunning = true;
  follow();
  memory.act({ kind: 'setSaveOn', isSaveOn: true });
  output.isAutoEqRunning = false;
  follow();
  output.isAutoEqRunning = true;
  follow();
  expect(memory.status().isSaveOn).toBe(false);
});

it('checkpoints and commits a song once saving is on behind a running mode', () => {
  const { memory, entries, output, follow, hear } = setUp();
  output.layer = layerOf(2);
  output.isAutoEqRunning = true;
  follow();
  memory.act({ kind: 'setSaveOn', isSaveOn: true });
  memory.nowPlaying(song('Saved'), true);

  hear(SONG_EQ_SETTLE_MS + 500);
  expect(entries.lookup).toHaveBeenCalledWith('device-a', song('Saved'));
  hear(SONG_EQ_MIN_LISTENED_MS);
  expect(entries.checkpoint).toHaveBeenCalledWith(
    'device-a',
    song('Saved'),
    layerOf(2),
  );
  expect(entries.commit).not.toHaveBeenCalled();

  // A different song closes the first, which is when the play is counted.
  memory.nowPlaying(song('Next'), true);
  expect(entries.commit).toHaveBeenCalledWith(
    'device-a',
    song('Saved'),
    layerOf(2),
  );
});

it('raises no notice and writes nothing for a song nothing is remembered about', async () => {
  const { memory, writeLayer, follow, hear } = setUp();
  follow();
  memory.nowPlaying(song('Unknown'), true);
  hear(SONG_EQ_SETTLE_MS + 500);
  await flush();
  expect(memory.status().notice).toBeUndefined();
  expect(writeLayer).not.toHaveBeenCalled();
});

it('lends a remembered song its layer, draws it, and names the song on the card', async () => {
  const { memory, remembered, writeLayer, shown, follow, hear, lastStatus } =
    setUp();
  remembered.set(`device-a|${song('Known').key}`, entryOf('Known', layerOf(3)));
  follow();
  memory.nowPlaying(song('Known'), true);
  hear(SONG_EQ_SETTLE_MS + 500);
  await flush();
  expect(writeLayer).toHaveBeenCalledWith(layerOf(3));
  expect(shown).toEqual([layerOf(3)]);
  expect(lastStatus().notice?.entry.title).toBe('Known');
});

it('keeps the card up until its own linger reports its end', async () => {
  const { memory, remembered, follow, hear, lastStatus } = setUp();
  remembered.set(`device-a|${song('Known').key}`, entryOf('Known', layerOf(3)));
  follow();
  memory.nowPlaying(song('Known'), true);
  hear(SONG_EQ_SETTLE_MS + 500);
  await flush();
  const id = lastStatus().notice?.id as number;
  hear(60_000);
  expect(lastStatus().notice?.id).toBe(id);
  // Another card's end is not this one's.
  memory.act({ kind: 'endNotice', id: id + 1 });
  expect(lastStatus().notice?.id).toBe(id);
  memory.act({ kind: 'endNotice', id });
  expect(lastStatus().notice).toBeUndefined();
});

it('keeps its time by heard sound, and asks the window only when it cannot hear', () => {
  const heard = setUp();
  heard.follow();
  heard.memory.nowPlaying(song('Heard'), true);
  heard.hear(SONG_EQ_SETTLE_MS + 500);
  expect(heard.entries.lookup).toHaveBeenCalledTimes(1);
  expect(heard.memory.status().needsClock).toBe(false);

  const deaf = setUp({ canHear: false });
  deaf.follow();
  deaf.memory.nowPlaying(song('Deaf'), true);
  expect(deaf.lastStatus().needsClock).toBe(true);
  jest.setSystemTime(Date.now() + SONG_EQ_SETTLE_MS + 500);
  expect(deaf.entries.lookup).not.toHaveBeenCalled();
  // The window's players say time passed.
  deaf.memory.tick();
  expect(deaf.entries.lookup).toHaveBeenCalledTimes(1);
});

it('keeps the loan through a running mode refining it, and hands it back when the song ends', async () => {
  const { memory, remembered, writeLayer, output, follow, hear } = setUp();
  remembered.set(
    `device-a|${song('Refined').key}`,
    entryOf('Refined', layerOf(3)),
  );
  output.layer = layerOf(1);
  follow();
  memory.nowPlaying(song('Refined'), true);
  hear(SONG_EQ_SETTLE_MS + 500);
  await flush();

  // The running mode writes its own refinement, as main wires it.
  const refined = layerOf(6);
  memory.ownWrite(sanitizeSmartEqSettings(refined));
  await writeLayer(refined);

  memory.nowPlaying(undefined, false);
  await flush();
  expect(writeLayer).toHaveBeenLastCalledWith(layerOf(1));
  expect(output.layer).toEqual(layerOf(1));
});

it('drops the loan when the layer changes for a reason that is not its own', async () => {
  const { memory, remembered, writeLayer, follow, hear, edit } = setUp();
  remembered.set(
    `device-a|${song('Foreign').key}`,
    entryOf('Foreign', layerOf(3)),
  );
  edit(layerOf(1));
  memory.nowPlaying(song('Foreign'), true);
  hear(SONG_EQ_SETTLE_MS + 500);
  await flush();
  follow();
  const writes = writeLayer.mock.calls.length;

  edit(layerOf(9));
  memory.act({ kind: 'undo' });
  await flush();
  expect(writeLayer.mock.calls.length).toBe(writes);
});

it('undoes a loan by giving back the layer it was lent over', async () => {
  const { memory, remembered, writeLayer, follow, hear, edit, lastStatus } =
    setUp();
  remembered.set(
    `device-a|${song('Undone').key}`,
    entryOf('Undone', layerOf(3)),
  );
  edit(layerOf(1));
  memory.nowPlaying(song('Undone'), true);
  hear(SONG_EQ_SETTLE_MS + 500);
  await flush();
  follow();

  memory.act({ kind: 'undo' });
  await flush();
  expect(writeLayer).toHaveBeenLastCalledWith(layerOf(1));
  expect(lastStatus().notice).toBeUndefined();
});

it('forgets the song the card names, and promises no save for it after', async () => {
  const { memory, remembered, entries, output, follow, hear, lastStatus } =
    setUp();
  remembered.set(`device-a|${song('Gone').key}`, entryOf('Gone', layerOf(3)));
  output.isAutoEqRunning = true;
  follow();
  memory.act({ kind: 'setSaveOn', isSaveOn: true });
  memory.nowPlaying(song('Gone'), true);
  hear(SONG_EQ_SETTLE_MS + 500);
  await flush();

  memory.act({ kind: 'forget' });
  expect(entries.forget).toHaveBeenCalledWith('device-a', song('Gone'));
  expect(lastStatus().notice).toBeUndefined();
  hear(SONG_EQ_MIN_LISTENED_MS);
  expect(lastStatus().willSave).toBe(false);
});

it('never writes a song’s loan onto the output a switch has just opened', async () => {
  const {
    memory,
    remembered,
    entries,
    writeLayer,
    output,
    follow,
    hear,
    edit,
  } = setUp();
  remembered.set(`device-a|${song('Moved').key}`, entryOf('Moved', layerOf(3)));
  edit(layerOf(1));
  memory.nowPlaying(song('Moved'), true);
  hear(SONG_EQ_SETTLE_MS + 500);
  await flush();
  follow();
  const writes = writeLayer.mock.calls.length;

  output.deviceId = 'device-b';
  output.layer = layerOf(7);
  follow();
  await flush();
  expect(writeLayer.mock.calls.length).toBe(writes);
  expect(output.layer).toEqual(layerOf(7));
  // The new output is followed from here on: the song asked about again is
  // asked about there.
  memory.nowPlaying(song('Moved'), true);
  hear(SONG_EQ_SETTLE_MS + 500);
  expect(entries.lookup).toHaveBeenLastCalledWith('device-b', song('Moved'));
});

it('drops a write decided for an output that a switch left before it ran', async () => {
  const { memory, remembered, writeLayer, output, follow, hear } = setUp();
  remembered.set(`device-a|${song('Left').key}`, entryOf('Left', layerOf(3)));
  follow();
  memory.nowPlaying(song('Left'), true);
  hear(SONG_EQ_SETTLE_MS + 500);
  // Decided, not yet run: the switch lands first.
  output.deviceId = 'device-b';
  await flush();
  expect(writeLayer).not.toHaveBeenCalled();
});

it('draws nothing for a write that did not land', async () => {
  const { memory, remembered, writeLayer, shown, follow, hear } = setUp();
  remembered.set(
    `device-a|${song('Refused').key}`,
    entryOf('Refused', layerOf(3)),
  );
  writeLayer.mockResolvedValueOnce(false);
  follow();
  memory.nowPlaying(song('Refused'), true);
  hear(SONG_EQ_SETTLE_MS + 500);
  await flush();
  expect(writeLayer).toHaveBeenCalledTimes(1);
  expect(shown).toHaveLength(0);
});

it('files the song and gives the loan back as the app closes, before it says so', async () => {
  const { memory, remembered, entries, writeLayer, output, follow, hear } =
    setUp();
  remembered.set(`device-a|${song('Last').key}`, entryOf('Last', layerOf(3)));
  output.layer = layerOf(1);
  output.isAutoEqRunning = true;
  follow();
  memory.act({ kind: 'setSaveOn', isSaveOn: true });
  memory.nowPlaying(song('Last'), true);
  hear(SONG_EQ_SETTLE_MS + SONG_EQ_MIN_LISTENED_MS);
  await flush();

  // The hand-back takes as long as the update path does.
  let land: (landed: boolean) => void = () => undefined;
  writeLayer.mockImplementationOnce(
    (layer) =>
      new Promise<boolean>((resolve) => {
        output.layer = sanitizeSmartEqSettings(layer);
        land = resolve;
      }),
  );
  let isClosed = false;
  const closed = memory.close().then(() => {
    isClosed = true;
    return undefined;
  });
  expect(entries.commit).toHaveBeenCalled();
  await flush();
  expect(writeLayer).toHaveBeenLastCalledWith(layerOf(1));
  expect(isClosed).toBe(false);
  land(true);
  await closed;
  expect(isClosed).toBe(true);
});

it('tells the window only what would draw differently', () => {
  const { memory, statuses, follow, hear } = setUp();
  follow();
  memory.nowPlaying(song('Counted'), true);
  const before = statuses.length;
  hear(10_000);
  // Forty steps of the clock, ten seconds drawn.
  expect(statuses.length - before).toBeGreaterThanOrEqual(9);
  expect(statuses.length - before).toBeLessThanOrEqual(12);
});
