/* FluidEQ — GPL-3.0-or-later */
import { EventEmitter } from 'events';
import { createAudioProcess } from '../../../main/shareAudio/processHost';

const mockChild = Object.assign(new EventEmitter(), {
  postMessage: jest.fn(),
  kill: jest.fn(),
});
const mockFork = jest.fn(
  (_entry: string, _args: string[], _options: unknown) => mockChild,
);
let mockReady: Promise<void>;
jest.mock('electron', () => ({
  app: { whenReady: () => mockReady },
  utilityProcess: {
    fork: (entry: string, args: string[], options: unknown) =>
      mockFork(entry, args, options),
  },
}));

beforeEach(() => {
  jest.clearAllMocks();
  mockChild.removeAllListeners();
  mockReady = Promise.resolve();
});

it('waits for actual app readiness and child spawn before delivering controls', async () => {
  let ready: () => void = () => undefined;
  mockReady = new Promise<void>((resolve) => {
    ready = resolve;
  });
  const child = createAudioProcess('fixture.js', 'fixture-resources');
  child.postMessage({ control: 1 });
  expect(mockFork).not.toHaveBeenCalled();
  ready();
  await mockReady;
  await Promise.resolve();
  expect(mockFork).toHaveBeenCalledWith(
    'fixture.js',
    ['fixture-resources'],
    expect.objectContaining({ stdio: 'ignore' }),
  );
  expect(mockChild.postMessage).not.toHaveBeenCalled();
  mockChild.emit('spawn');
  expect(mockChild.postMessage).toHaveBeenCalledWith({ control: 1 });
  await child.terminate();
  expect(mockChild.kill).toHaveBeenCalledTimes(1);
});
it('does not start an unowned child when closed during startup', async () => {
  let ready: () => void = () => undefined;
  mockReady = new Promise<void>((resolve) => {
    ready = resolve;
  });
  const child = createAudioProcess('fixture.js');
  await child.terminate();
  ready();
  await mockReady;
  await Promise.resolve();
  expect(mockFork).not.toHaveBeenCalled();
});
it('bounds controls queued before app readiness', async () => {
  mockReady = new Promise<void>(() => {});
  const child = createAudioProcess('fixture.js');
  for (let index = 0; index < 128; index += 1) {
    child.postMessage({ index });
  }
  expect(() => child.postMessage({ index: 129 })).toThrow('queue is full');
  await child.terminate();
});
