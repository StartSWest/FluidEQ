import type { TSystemDspChainResult } from '../../../common/audioEngine';
import { setSystemDspChain } from '../../../renderer/utils/audioEngineApi';
import {
  readSystemDspChainResult,
  resetSystemDspChain,
  sendSystemDspChain,
} from '../../../renderer/dsp/systemChain';

jest.mock('../../../renderer/utils/audioEngineApi', () => ({
  setSystemDspChain: jest.fn(),
}));
jest.mock('../../../renderer/utils/logger', () => ({ reportError: jest.fn() }));
const deferred = () => {
  let resolve: (value: TSystemDspChainResult) => void = () => {
    throw new Error('uninitialized promise');
  };
  let reject: (reason: Error) => void = () => {
    throw new Error('uninitialized promise');
  };
  const promise = new Promise<TSystemDspChainResult>((_resolve, _reject) => {
    resolve = _resolve;
    reject = _reject;
  });
  return { promise, resolve, reject };
};
beforeEach(() => {
  resetSystemDspChain();
  jest.mocked(setSystemDspChain).mockReset();
});
it('reports the original request when a fresh identical array is deduplicated in flight', async () => {
  const pending = deferred();
  jest.mocked(setSystemDspChain).mockReturnValue(pending.promise);
  sendSystemDspChain([1]);
  sendSystemDspChain([1]);
  pending.resolve('update-required');
  await pending.promise;
  expect(readSystemDspChainResult()).toBe('update-required');
  expect(setSystemDspChain).toHaveBeenCalledTimes(1);
});
it('only the newest A may confirm an A to B to A sequence, even with reused arrays', async () => {
  const a = deferred();
  const b = deferred();
  const last = deferred();
  const values = [1];
  jest
    .mocked(setSystemDspChain)
    .mockReturnValueOnce(a.promise)
    .mockReturnValueOnce(b.promise)
    .mockReturnValueOnce(last.promise);
  sendSystemDspChain(values);
  sendSystemDspChain([2]);
  sendSystemDspChain(values);
  a.resolve('update-required');
  await a.promise;
  expect(readSystemDspChainResult()).toBeUndefined();
  b.resolve('written');
  await b.promise;
  expect(readSystemDspChainResult()).toBeUndefined();
  last.resolve('written');
  await last.promise;
  expect(readSystemDspChainResult()).toBe('written');
});
it('clears previous confirmation on new writes and both synchronous and asynchronous failure', async () => {
  jest.mocked(setSystemDspChain).mockResolvedValue('written');
  sendSystemDspChain([1]);
  await Promise.resolve();
  expect(readSystemDspChainResult()).toBe('written');
  jest.mocked(setSystemDspChain).mockImplementationOnce(() => {
    throw new Error('bridge stopped');
  });
  sendSystemDspChain([2]);
  expect(readSystemDspChainResult()).toBeUndefined();
  jest.mocked(setSystemDspChain).mockResolvedValue('written');
  sendSystemDspChain([3]);
  await Promise.resolve();
  expect(readSystemDspChainResult()).toBe('written');
  const failed = deferred();
  jest.mocked(setSystemDspChain).mockReturnValue(failed.promise);
  sendSystemDspChain([4]);
  expect(readSystemDspChainResult()).toBeUndefined();
  failed.reject(new Error('disconnected'));
  await failed.promise.catch(() => undefined);
  expect(readSystemDspChainResult()).toBeUndefined();
});
