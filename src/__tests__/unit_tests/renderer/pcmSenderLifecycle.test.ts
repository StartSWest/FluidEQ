/* FluidEQ — GPL-3.0-or-later */
import { createPcmSender } from 'renderer/remoteAudio/pcmSender';

const original = globalThis.AudioWorkletNode;
const postMessage = jest.fn();
const disconnect = jest.fn();
const source = { connect: jest.fn(), disconnect: jest.fn() };
const mute = { gain: { value: 1 }, connect: jest.fn(), disconnect: jest.fn() };
const port = {
  onmessage: null as ((event: MessageEvent) => void) | null,
  postMessage,
};
const capture = {
  context: {
    audioWorklet: { addModule: jest.fn().mockResolvedValue(undefined) },
    createGain: () => mute,
    destination: {},
  },
  source,
};

beforeEach(() => {
  jest.clearAllMocks();
  Object.assign(globalThis, {
    AudioWorkletNode: class {
      port = port;

      connect = jest.fn();

      disconnect = disconnect;
    },
  });
});
afterEach(() => Object.assign(globalThis, { AudioWorkletNode: original }));

it('retires the audio-thread processor exactly once, even if capture stays open', async () => {
  const send = jest.fn();
  const sender = await createPcmSender(
    capture as unknown as Parameters<typeof createPcmSender>[0],
    send,
  );
  const receive = port.onmessage;
  sender.close();
  sender.close();
  expect(postMessage).toHaveBeenCalledTimes(1);
  expect(postMessage).toHaveBeenCalledWith({ kind: 'close' });
  expect(disconnect).toHaveBeenCalledTimes(1);
  expect(source.disconnect).toHaveBeenCalledTimes(1);
  expect(mute.disconnect).toHaveBeenCalledTimes(1);
  receive?.({ data: {} } as MessageEvent);
  expect(send).not.toHaveBeenCalled();
});
