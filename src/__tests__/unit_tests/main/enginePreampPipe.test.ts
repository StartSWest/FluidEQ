/** @jest-environment node */
import { EventEmitter } from 'events';
import { ipcMain } from 'electron';
import net from 'net';
import startEngineAnalysisPipe from '../../../main/engineAnalysisPipe';
import { ENGINE_PREAMP_CHANNEL } from '../../../common/enginePreamp';
import { ENGINE_ANALYSIS_CHANNEL } from '../../../common/dsp/engineAnalysis';
import {
  ANALYSIS_MAX_FRAME_BYTES,
  ANALYSIS_HEADER_BYTES,
  ANALYSIS_BINS,
  ANALYSIS_SCOPE_PAIRS,
  ANALYSIS_MAX_BANDS,
  ANALYSIS_STAGES,
  ANALYSIS_EQ_DETAIL_WINDOW,
  ANALYSIS_EQ_DETAIL_BINS,
  ANALYSIS_DYNAMICS_TAG,
} from '../../../common/dsp/analysisWire';
import { MAGIC_ANALYSIS } from '../../../main/dspHost/wire';

jest.mock('electron', () => ({ ipcMain: { handle: jest.fn() } }));
jest.mock('net', () => ({ createServer: jest.fn() }));
jest.mock('electron-log', () => ({ warn: jest.fn() }));

const endpoint = '{12345678-1234-1234-1234-123456789abc}';
const sender = new EventEmitter();
const sockets: EventEmitter[] = [];
const setup = async (capable = true) => {
  const server = Object.assign(new EventEmitter(), {
    listen: (_options: unknown, ready: () => void) => ready(),
  });
  jest.mocked(net.createServer).mockReturnValue(server as net.Server);
  await startEngineAnalysisPipe(() => ({ webContents: sender }) as never);
  const socket = Object.assign(new EventEmitter(), {
    write: jest.fn(),
    destroy: jest.fn(),
  });
  sockets.push(socket);
  const accept = jest.mocked(net.createServer).mock.calls[0][0] as unknown as (
    connection: unknown,
  ) => void;
  accept(socket);
  const hello = Buffer.alloc(44);
  hello.write(endpoint);
  hello[39] = capable ? 1 : 0;
  hello.writeUInt32LE(48000, 40);
  socket.emit('data', hello);
  const handler = jest
    .mocked(ipcMain.handle)
    .mock.calls.find(([name]) => name === ENGINE_PREAMP_CHANNEL)?.[1];
  if (!handler) {
    throw new Error('Missing preamp reader');
  }
  const read = () =>
    handler({ sender } as Electron.IpcMainInvokeEvent, endpoint);
  const analysisHandler = jest
    .mocked(ipcMain.handle)
    .mock.calls.find(([name]) => name === ENGINE_ANALYSIS_CHANNEL)?.[1];
  const analysis = (target: string | null = endpoint) =>
    analysisHandler?.({ sender } as Electron.IpcMainInvokeEvent, target);
  return { socket, read, handler, analysis };
};
const frame = (gain = -6) => {
  const packet = Buffer.alloc(16);
  packet.writeUInt32LE(12);
  packet.writeUInt32LE(0x50414546, 4);
  packet.writeFloatLE(gain, 8);
  packet.writeUInt32LE(3, 12);
  return packet;
};
beforeEach(() => jest.clearAllMocks());
afterEach(() => {
  sockets.splice(0).forEach((socket) => socket.emit('close'));
  sender.removeAllListeners();
});

it('reads actual reduction with DSP absent and accepts fragmented packets', async () => {
  const { read, socket } = await setup();
  expect(read()).toBeUndefined();
  expect(socket.write).toHaveBeenCalledWith(Buffer.from([2]));
  read();
  expect(socket.write).toHaveBeenCalledTimes(1);
  const packet = frame();
  socket.emit('data', packet.subarray(0, 7));
  expect(read()).toBeUndefined();
  socket.emit('data', packet.subarray(7));
  expect(read()).toEqual({ gainDb: -6, active: true, enabled: true });
  expect(socket.destroy).not.toHaveBeenCalled();
});
it('does not send unsupported requests to older engines', async () => {
  const { read, socket } = await setup(false);
  expect(read()).toBeUndefined();
  expect(socket.write).not.toHaveBeenCalled();
});
it.each([NaN, Infinity, 1, -241])(
  'rejects invalid reduction %s',
  async (gain) => {
    const { read, socket } = await setup();
    read();
    socket.emit('data', frame(gain));
    expect(socket.destroy).toHaveBeenCalledTimes(1);
  },
);
it('rejects requests from another window', async () => {
  const { handler, socket } = await setup();
  expect(
    handler({ sender: {} } as Electron.IpcMainInvokeEvent, endpoint),
  ).toBeUndefined();
  expect(socket.write).not.toHaveBeenCalled();
});

it('does not starve DSP waveforms when preamp reads arrive first every frame', async () => {
  const { socket, read, analysis } = await setup();
  read();
  analysis();
  read();
  expect(socket.write).toHaveBeenCalledTimes(1);
  socket.emit('data', frame());
  expect(socket.write).toHaveBeenLastCalledWith(Buffer.from([1]));
  read();
  analysis();
  socket.emit('data', Buffer.from([255, 255, 255, 255]));
  expect(socket.write).toHaveBeenLastCalledWith(Buffer.from([2]));
  expect(socket.destroy).not.toHaveBeenCalled();
});

it('cancels queued waveform reads when the DSP page closes', async () => {
  const { socket, read, analysis } = await setup();
  read();
  analysis();
  analysis(null);
  socket.emit('data', frame());
  expect(socket.write).not.toHaveBeenCalledWith(Buffer.from([1]));
  expect(read()).toEqual({ gainDb: -6, active: true, enabled: true });
});

/** A maximum-sized real wire shape, including Dynamics' two extra spectra. */
const fullAnalysisPacket = () => {
  const packet = Buffer.alloc(ANALYSIS_MAX_FRAME_BYTES + 4);
  packet.writeUInt32LE(ANALYSIS_MAX_FRAME_BYTES, 0);
  const payload = packet.subarray(4);
  payload.writeUInt32LE(MAGIC_ANALYSIS, 0);
  payload.writeUInt32LE(1, 4);
  payload.writeUInt32LE(2 ** ANALYSIS_STAGES.length - 1, 8);
  payload.writeUInt32LE(ANALYSIS_BINS, 12);
  payload.writeUInt32LE(ANALYSIS_SCOPE_PAIRS, 16);
  payload.writeUInt32LE(ANALYSIS_MAX_BANDS, 20);
  payload.writeUInt32LE(ANALYSIS_EQ_DETAIL_WINDOW, 84);
  payload.writeUInt32LE(ANALYSIS_EQ_DETAIL_BINS, 88);
  payload.writeUInt32LE(ANALYSIS_DYNAMICS_TAG, 840);
  payload.writeUInt32LE(1, 844);
  [6, -4, 2].forEach((db, band) => payload.writeFloatLE(db, 860 + band * 4));
  ANALYSIS_STAGES.forEach((_name, stage) => {
    payload.writeFloatLE(
      -40 + stage,
      ANALYSIS_HEADER_BYTES + (stage * ANALYSIS_BINS + 100) * 4,
    );
  });
  [-6, -24, -18, 3, -20].forEach((value, index) =>
    payload.writeFloatLE(value, payload.length - 20 + index * 4),
  );
  return packet;
};

it.each([0, 32768])(
  'accepts the full Dynamics/detail/scope/band frame with a chunk break at %s',
  async (split) => {
    const { socket, analysis } = await setup();
    analysis();
    const packet = fullAnalysisPacket();
    expect(packet.length).toBeGreaterThan(32768);
    socket.emit('data', split ? packet.subarray(0, split) : packet);
    expect(socket.destroy).not.toHaveBeenCalled();
    if (split) {
      socket.emit('data', packet.subarray(split));
    }
    expect(socket.destroy).not.toHaveBeenCalled();
    const result = analysis();
    expect(result).toMatchObject({
      sampleRate: 48000,
      frame: {
        dynamics: { active: true, gainDb: [6, -4, 2] },
        normalizer: { inputLufs: -24, outputLufs: -20 },
      },
    });
    expect(result?.frame.spectra.dynamicsIn?.[100]).toBe(-36);
    expect(result?.frame.spectra.dynamicsOut?.[100]).toBe(-35);
    expect(result?.frame.eqLive?.detail).toHaveLength(ANALYSIS_EQ_DETAIL_BINS);
    expect(result?.frame.bandAmounts).toHaveLength(ANALYSIS_MAX_BANDS);
  },
);

it('still rejects a frame exceeding the actual maximum wire payload', async () => {
  const { socket, analysis } = await setup();
  analysis();
  const prefix = Buffer.alloc(4);
  prefix.writeUInt32LE(ANALYSIS_MAX_FRAME_BYTES + 1);
  socket.emit('data', prefix);
  expect(socket.destroy).toHaveBeenCalledTimes(1);
});
