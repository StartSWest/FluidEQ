/** @jest-environment node */
import { EventEmitter } from 'events';

const mockApp = new EventEmitter();
const mockFork = jest.fn();
jest.mock('electron', () => ({
  app: Object.assign(mockApp, { isPackaged: true }),
  utilityProcess: { fork: (...args: unknown[]) => mockFork(...args) },
}));
jest.mock('fs', () => ({ existsSync: () => true }));
jest.mock('electron-log', () => ({ error: jest.fn() }));

// eslint-disable-next-line import/first -- Initialize the Electron lifecycle mock before importing its subscriber.
import ort, {
  onInferenceInvalidated,
  shutdownNativeInference,
} from '../../../main/nativeInference';

const child = () =>
  Object.assign(new EventEmitter(), {
    postMessage: jest.fn(),
    kill: jest.fn().mockReturnValue(true),
  });

it('isolates inference, rejects pending work on a crash, invalidates old sessions and bounds restarts', async () => {
  const first = child();
  mockFork.mockReturnValue(first);
  const invalidated = jest.fn();
  onInferenceInvalidated(invalidated);
  const opening = ort.InferenceSession.create('model.onnx', {
    executionProviders: ['cpu'],
  });
  const request = first.postMessage.mock.calls[0][0];
  expect(request).toMatchObject({
    type: 'create',
    modelPath: 'model.onnx',
    providers: ['cpu'],
  });
  expect(mockFork.mock.calls[0][0]).toMatch(/inference-worker\.js$/);
  first.emit('message', { id: request.id, ok: true, result: 12 });
  const session = await opening;
  const samples = new Float32Array([0.25, -0.5]);
  const running = session.run({
    input: new ort.Tensor('float32', samples, [1, 2]),
  });
  const runRequest = first.postMessage.mock.calls[1][0];
  expect(runRequest).toMatchObject({
    type: 'run',
    sessionId: 12,
    feeds: { input: { data: samples, dims: [1, 2] } },
  });
  first.emit('message', {
    id: runRequest.id,
    ok: true,
    result: { output: { data: samples, dims: [1, 2] } },
  });
  await expect(running).resolves.toEqual({
    output: { data: samples, dims: [1, 2] },
  });
  const pending = session.run({
    input: new ort.Tensor('float32', samples, [1, 2]),
  });
  first.emit('exit', 139);
  await expect(pending).rejects.toThrow('app is still running');
  expect(invalidated).toHaveBeenCalledTimes(1);
  await expect(session.run({})).rejects.toThrow('interrupted');

  const second = child();
  mockFork.mockReturnValue(second);
  const retry = ort.InferenceSession.create('model.onnx', {
    executionProviders: ['cpu'],
  });
  second.emit('exit', 139);
  await expect(retry).rejects.toThrow('crashed');
  await expect(
    ort.InferenceSession.create('model.onnx', { executionProviders: ['cpu'] }),
  ).rejects.toThrow('recovery limit');
  expect(mockFork).toHaveBeenCalledTimes(2);
  await shutdownNativeInference();
});
