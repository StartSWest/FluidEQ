/* Copyright (C) 2026 Ivan Carmenates Garcia. SPDX-License-Identifier: GPL-3.0-or-later */
/** @jest-environment node */

import { EventEmitter } from 'events';
import net from 'net';
import { ipcMain } from 'electron';
import startEngineAnalysisPipe, {
  measureEngineProcesses,
} from '../../../main/engineAnalysisPipe';
import { ENGINE_PREAMP_CHANNEL } from '../../../common/enginePreamp';
import { ENGINE_ANALYSIS_CHANNEL } from '../../../common/dsp/engineAnalysis';
import {
  createPerformanceLog,
  type TProcessReading,
} from '../../../main/performanceLog';

jest.mock('electron', () => ({ ipcMain: { handle: jest.fn() } }));
jest.mock('net', () => ({ createServer: jest.fn() }));
jest.mock('electron-log', () => ({ warn: jest.fn() }));

const STATS_MAGIC = 0x53514546;
const AUDIODG = 4242;

/** What `analysis_link.cpp` answers to a stats request (3). */
const statsPacket = (cpuSeconds: number) => {
  const packet = Buffer.alloc(28);
  packet.writeUInt32LE(24, 0);
  packet.writeUInt32LE(STATS_MAGIC, 4);
  packet.writeUInt32LE(AUDIODG, 8);
  packet.writeBigUInt64LE(80n * 1024n * 1024n, 12);
  packet.writeBigUInt64LE(BigInt(Math.round(cpuSeconds * 1e7)), 20);
  return packet;
};

const preampPacket = () => {
  const packet = Buffer.alloc(16);
  packet.writeUInt32LE(12);
  packet.writeUInt32LE(0x50414546, 4);
  packet.writeFloatLE(-3, 8);
  packet.writeUInt32LE(3, 12);
  return packet;
};

type TFakeSocket = EventEmitter & {
  write: jest.Mock;
  destroy: jest.Mock;
};

const sender = new EventEmitter();
const sockets: TFakeSocket[] = [];

const startPipe = async () => {
  const server = Object.assign(new EventEmitter(), {
    listen: (_options: unknown, ready: () => void) => ready(),
  });
  jest.mocked(net.createServer).mockReturnValue(server as net.Server);
  await startEngineAnalysisPipe(() => ({ webContents: sender }) as never);
  return jest.mocked(net.createServer).mock.calls[0][0] as unknown as (
    connection: unknown,
  ) => void;
};

/** One engine connection, as an output's engine opens it. */
const connect = (
  accept: (connection: unknown) => void,
  endpoint: string,
  capabilities: number,
): TFakeSocket => {
  const socket = Object.assign(new EventEmitter(), {
    write: jest.fn(),
    destroy: jest.fn(),
  });
  sockets.push(socket);
  accept(socket);
  const hello = Buffer.alloc(44);
  hello.write(endpoint);
  hello[39] = capabilities;
  hello.writeUInt32LE(48000, 40);
  socket.emit('data', hello);
  return socket;
};

const handler = (channel: string) => {
  const found = jest
    .mocked(ipcMain.handle)
    .mock.calls.find(([name]) => name === channel)?.[1];
  if (!found) {
    throw new Error(`Missing handler ${channel}`);
  }
  return (endpoint: string) =>
    found({ sender } as Electron.IpcMainInvokeEvent, endpoint);
};

const FIRST = '{12345678-1234-1234-1234-123456789abc}';
const SECOND = '{87654321-4321-4321-4321-cba987654321}';

beforeEach(() => jest.clearAllMocks());
afterEach(() => {
  sockets.splice(0).forEach((socket) => socket.emit('close'));
  sender.removeAllListeners();
});

describe("the audio service's processor time", () => {
  /*
   * audiodg at a steady quarter of a core, which is what the 2.4.0 report's
   * own rows add up to over four hours. The engine measures itself the moment
   * it reads the question, so its total is the clock at that moment.
   */
  const RATE = 0.25;

  const engineAnsweringOnTime = async (clock: () => number) => {
    const accept = await startPipe();
    const socket = connect(accept, FIRST, 3);
    socket.write.mockImplementation((bytes: Buffer) => {
      if (bytes[0] === 3) {
        socket.emit('data', statsPacket(RATE * clock()));
      }
    });
    return socket;
  };

  const audioService = async (): Promise<TProcessReading[]> =>
    (await measureEngineProcesses()).map(({ pid, cpuSeconds }) => ({
      pid,
      role: 'systemEngine',
      cpuSeconds,
      memoryMb: 80,
      isShared: true,
    }));

  it('books each stretch what the engine used during it, however long the stretch before', async () => {
    let seconds = 0;
    await engineAnsweringOnTime(() => seconds);
    const performanceLog = createPerformanceLog(() => seconds * 1000);

    performanceLog.show(await audioService(), 'community, look analyzer-auto');
    seconds += 168.9 * 60;
    performanceLog.show(
      await audioService(),
      'community, look analyzer-auto, window minimized',
    );
    seconds += 0.6 * 60;

    // Before the fix the short stretch carried the long one's time: the
    // engine's answer to the previous question, 2533 s booked to 36 s, over
    // 7000% of one core, and none at all for the 168.9 minutes.
    expect(performanceLog.report(await audioService())).toEqual([
      'Performance: community, look analyzer-auto for 168.9 min, 25.0% of one core (systemEngine 25.0%), up to 0 MB',
      'Performance: community, look analyzer-auto, window minimized for 0.6 min, 25.0% of one core (systemEngine 25.0%), up to 0 MB',
    ]);
  });

  it('asks again for every reading, and the answer is the total at that moment', async () => {
    let seconds = 100;
    const socket = await engineAnsweringOnTime(() => seconds);
    expect(await measureEngineProcesses()).toEqual([
      { pid: AUDIODG, workingSetBytes: 80 * 1024 * 1024, cpuSeconds: 25 },
    ]);
    seconds = 500;
    // The control: the same connection asked a second time answers with the
    // new total, not the one it gave before.
    expect(await measureEngineProcesses()).toEqual([
      { pid: AUDIODG, workingSetBytes: 80 * 1024 * 1024, cpuSeconds: 125 },
    ]);
    expect(socket.write).toHaveBeenCalledTimes(2);
  });

  it('is never pushed out by a frame the DSP page has waiting', async () => {
    const accept = await startPipe();
    const socket = connect(accept, FIRST, 3);
    const readPreamp = handler(ENGINE_PREAMP_CHANNEL);
    const readFrame = handler(ENGINE_ANALYSIS_CHANNEL);

    readPreamp(FIRST); // on the wire
    readFrame(FIRST); // waiting behind it
    const measured = measureEngineProcesses();
    expect(socket.write).toHaveBeenCalledTimes(1);

    socket.emit('data', preampPacket());
    // Asked next, ahead of the frame: somebody is waiting on it.
    expect(socket.write).toHaveBeenLastCalledWith(Buffer.from([3]));
    socket.emit('data', statsPacket(42));
    await expect(measured).resolves.toEqual([
      expect.objectContaining({ pid: AUDIODG, cpuSeconds: 42 }),
    ]);
    // The control: the frame that was waiting is still asked for after it.
    expect(socket.write).toHaveBeenLastCalledWith(Buffer.from([1]));
    expect(socket.destroy).not.toHaveBeenCalled();
  });

  it('finishes when a connection closes before answering, with what the others said', async () => {
    const accept = await startPipe();
    const leaving = connect(accept, FIRST, 3);
    const staying = connect(accept, SECOND, 3);
    staying.write.mockImplementation((bytes: Buffer) => {
      if (bytes[0] === 3) {
        staying.emit('data', statsPacket(7));
      }
    });
    const measured = measureEngineProcesses();
    expect(leaving.write).toHaveBeenCalledWith(Buffer.from([3]));
    leaving.emit('close');
    await expect(measured).resolves.toEqual([
      expect.objectContaining({ pid: AUDIODG, cpuSeconds: 7 }),
    ]);
  });

  it('never asks an engine that did not offer to answer', async () => {
    const accept = await startPipe();
    const older = connect(accept, FIRST, 1);
    await expect(measureEngineProcesses()).resolves.toEqual([]);
    expect(older.write).not.toHaveBeenCalled();
  });
});
