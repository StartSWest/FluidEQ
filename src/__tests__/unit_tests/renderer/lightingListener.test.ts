import { startLightingListener } from 'renderer/lighting/lightingListener';
import type { ICaptureGraph } from 'renderer/graph/useLiveOutputSpectrum';

function setup() {
  let finish: () => void = () => undefined;
  const source = { connect: jest.fn(), disconnect: jest.fn() };
  const analyser = { frequencyBinCount: 1024 };
  const mute = {
    gain: { value: 1 },
    connect: jest.fn(),
    disconnect: jest.fn(),
  };
  // The capture tap: an audio-thread node that hands blocks of samples over
  // a port of their own, and is told to close rather than closing its port.
  const clock = {
    port: { postMessage: jest.fn(), close: jest.fn() },
    connect: jest.fn(() => mute),
    disconnect: jest.fn(),
  };
  const blocks = {
    port1: {},
    port2: { onmessage: null as unknown, close: jest.fn() },
  };
  const context = {
    state: 'running',
    sampleRate: 48000,
    destination: {},
    audioWorklet: {
      addModule: jest.fn(
        () =>
          new Promise<void>((resolve) => {
            finish = resolve;
          }),
      ),
    },
    createAnalyser: jest.fn(() => analyser),
    createGain: jest.fn(() => mute),
  };
  const construct = jest.fn(() => clock);
  Object.defineProperty(window, 'AudioWorkletNode', {
    configurable: true,
    value: construct,
  });
  // jsdom has no MessageChannel.
  Object.defineProperty(window, 'MessageChannel', {
    configurable: true,
    value: jest.fn(() => blocks),
  });
  return {
    capture: { context, source } as unknown as ICaptureGraph,
    context,
    source,
    clock,
    blocks,
    construct,
    finish: () => finish(),
  };
}

afterEach(() => {
  Reflect.deleteProperty(window, 'AudioWorkletNode');
  Reflect.deleteProperty(window, 'MessageChannel');
});

it('does not build or connect nodes after the capture closes during worklet loading', async () => {
  const fixture = setup();
  const pending = startLightingListener(
    fixture.capture,
    [1, 0, 1],
    () => false,
    jest.fn(),
  );
  fixture.context.state = 'closed';
  fixture.finish();
  await expect(pending).rejects.toMatchObject({ name: 'AbortError' });
  expect(fixture.context.createAnalyser).not.toHaveBeenCalled();
  expect(fixture.construct).not.toHaveBeenCalled();
  expect(fixture.source.connect).not.toHaveBeenCalled();
});

it('cancels a superseded producer before it can attach to the shared capture', async () => {
  const fixture = setup();
  const abort = new AbortController();
  // jsdom's AbortSignal predates this browser method; supply its real
  // semantics while retaining jsdom's AbortController and DOMException.
  Object.defineProperty(abort.signal, 'throwIfAborted', {
    value: () => {
      if (abort.signal.aborted) {
        throw new DOMException('The operation was aborted', 'AbortError');
      }
    },
  });
  const pending = startLightingListener(
    fixture.capture,
    [1, 0, 1],
    () => false,
    jest.fn(),
    abort.signal,
  );
  abort.abort();
  fixture.finish();
  await expect(pending).rejects.toMatchObject({ name: 'AbortError' });
  expect(fixture.construct).not.toHaveBeenCalled();
});

it('connects a valid producer and closes its own clock and connections', async () => {
  const fixture = setup();
  const pending = startLightingListener(
    fixture.capture,
    [1, 0, 1],
    () => false,
    jest.fn(),
  );
  fixture.finish();
  const listener = await pending;
  expect(fixture.construct).toHaveBeenCalledTimes(1);
  expect(fixture.source.connect).toHaveBeenCalledTimes(2);
  // The tap is handed its own port for the blocks.
  expect(fixture.clock.port.postMessage).toHaveBeenCalledWith(
    expect.objectContaining({ kind: 'attach', port: fixture.blocks.port1 }),
    [fixture.blocks.port1],
  );
  listener.close();
  // Told to close, a processor answers false once and goes; a closed port
  // alone would leave it answering true, kept alive by its context.
  expect(fixture.clock.port.postMessage).toHaveBeenLastCalledWith({
    kind: 'close',
  });
  expect(fixture.blocks.port2.close).toHaveBeenCalledTimes(1);
  expect(fixture.blocks.port2.onmessage).toBeNull();
  expect(fixture.source.disconnect).toHaveBeenCalledTimes(2);
  // Closed twice is closed once.
  listener.close();
  expect(fixture.blocks.port2.close).toHaveBeenCalledTimes(1);
});
