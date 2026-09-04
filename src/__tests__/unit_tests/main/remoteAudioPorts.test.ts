/* FluidEQ — GPL-3.0-or-later */
/** @jest-environment node */

import { EventEmitter } from 'events';
import type { BrowserWindow, IpcMainEvent } from 'electron';
import createRemoteAudioPorts from '../../../main/remoteAudioPorts';

const handlers = new Map<
  string,
  (event: IpcMainEvent, kind: unknown) => void
>();
jest.mock('electron', () => ({
  ipcMain: {
    on: (
      channel: string,
      handler: (event: IpcMainEvent, kind: unknown) => void,
    ) => handlers.set(channel, handler),
    removeListener: (channel: string) => handlers.delete(channel),
  },
}));

class Port extends EventEmitter {
  postMessage = jest.fn();

  start = jest.fn();

  close = jest.fn(() => this.emit('close'));
}

const setup = () => {
  const frame = {};
  const webContents = { mainFrame: frame };
  const onStreaming = jest.fn();
  const bridge = createRemoteAudioPorts(
    () => ({ webContents }) as unknown as BrowserWindow,
    onStreaming,
  );
  const attach = (kind: string, port: Port, senderFrame = frame) => {
    handlers.get('remote-audio-port')?.(
      {
        sender: webContents,
        senderFrame,
        ports: [port],
      } as unknown as IpcMainEvent,
      kind,
    );
  };
  return { attach, bridge, onStreaming };
};
const chunk = {
  peerId: 'sender',
  sequence: 0,
  channels: 2,
  frames: 480,
  sampleRate: 48000,
  pcm: new Float32Array(960).fill(0.3).buffer,
};

describe('direct remote audio ports', () => {
  it('orders playback configuration before PCM and announces streaming only once', () => {
    const { attach, bridge, onStreaming } = setup();
    const port = new Port();
    attach('playback', port);
    bridge.signal({
      peerId: 'sender',
      signal: { kind: 'stream-mode', mode: 'video' },
    });
    bridge.audio(chunk);
    bridge.audio({ ...chunk, sequence: 1 });
    expect(port.postMessage.mock.calls.map(([value]) => value.kind)).toEqual([
      'ready',
      'configure',
      'push',
      'push',
    ]);
    expect(port.postMessage.mock.calls[2][0].pcm).toBe(chunk.pcm);
    expect(onStreaming).toHaveBeenCalledTimes(1);
    bridge.reset();
    bridge.audio(chunk);
    expect(onStreaming).toHaveBeenCalledTimes(2);
    bridge.close();
  });

  it('rejects an embedded page and replaces ports without the old close event removing the new one', () => {
    const { attach, bridge } = setup();
    const wrong = new Port();
    attach('playback', wrong, {});
    expect(wrong.close).toHaveBeenCalledTimes(1);
    expect(wrong.postMessage).not.toHaveBeenCalled();
    const first = new Port();
    const second = new Port();
    attach('playback', first);
    attach('playback', second);
    first.emit('close');
    bridge.audio(chunk);
    expect(second.postMessage).toHaveBeenLastCalledWith({
      kind: 'push',
      ...chunk,
    });
    bridge.close();
  });

  it('keeps playback independent of a failed analysis worker', () => {
    const { attach, bridge } = setup();
    const playback = new Port();
    const analysis = new Port();
    attach('playback', playback);
    attach('analysis', analysis);
    analysis.postMessage.mockImplementationOnce(() => {
      throw new Error('worker closed');
    });
    const log = jest
      .spyOn(console, 'error')
      .mockImplementation(() => undefined);
    expect(() => bridge.analyze(chunk)).not.toThrow();
    bridge.audio(chunk);
    expect(playback.postMessage).toHaveBeenLastCalledWith({
      kind: 'push',
      ...chunk,
    });
    expect(analysis.close).toHaveBeenCalled();
    log.mockRestore();
    bridge.close();
  });
});
