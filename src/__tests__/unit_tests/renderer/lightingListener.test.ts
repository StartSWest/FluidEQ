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
  const clock = {
    port: { close: jest.fn() },
    connect: jest.fn(() => mute),
    disconnect: jest.fn(),
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
  return {
    capture: { context, source } as unknown as ICaptureGraph,
    context,
    source,
    clock,
    construct,
    finish: () => finish(),
  };
}

afterEach(() => Reflect.deleteProperty(window, 'AudioWorkletNode'));

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
  listener.close();
  expect(fixture.clock.port.close).toHaveBeenCalledTimes(1);
  expect(fixture.source.disconnect).toHaveBeenCalledTimes(2);
});
