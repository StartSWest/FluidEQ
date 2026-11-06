import { act, renderHook } from '@testing-library/react';
import type { IScenePublishProgress } from '../../../common/scenePreviewMedia';
import useStudioPublishProgress from '../../../renderer/studio/useStudioPublishProgress';

let listener: ((next: IScenePublishProgress) => void) | undefined;
const cancelled = jest.fn(async () => true);
const unsubscribe = jest.fn();
const uuid = '10000000-0000-4000-8000-000000000001';
beforeEach(() => {
  jest.clearAllMocks();
  listener = undefined;
  Object.defineProperty(window, 'electron', {
    configurable: true,
    value: {
      ipcRenderer: {
        cancelStudioPublish: cancelled,
        onStudioPublishProgress: (next: typeof listener) => {
          listener = next;
          return unsubscribe;
        },
      },
    },
  });
  Object.defineProperty(crypto, 'randomUUID', {
    configurable: true,
    value: () => uuid,
  });
});
it('tracks only the active operation, allows preparation cancellation and requires upload acknowledgement', async () => {
  const { result, unmount } = renderHook(useStudioPublishProgress);
  act(() => {
    result.current.begin();
  });
  expect(result.current.phase).toBe('preparing');
  await expect(result.current.requestCancel()).resolves.toBe(true);
  expect(cancelled).not.toHaveBeenCalled();
  act(() => listener?.({ id: 'old', phase: 'publishing' }));
  expect(result.current.phase).toBe('preparing');
  act(() => listener?.({ id: uuid, phase: 'uploading' }));
  cancelled.mockResolvedValueOnce(false);
  await expect(result.current.requestCancel()).resolves.toBe(false);
  await expect(result.current.requestCancel()).resolves.toBe(true);
  expect(cancelled).toHaveBeenCalledWith(uuid);
  act(() => listener?.({ id: uuid, phase: 'publishing' }));
  await expect(result.current.requestCancel()).resolves.toBe(false);
  unmount();
  expect(unsubscribe).toHaveBeenCalledTimes(1);
});
it('abandons on close, cancels the operation and ignores its late progress', () => {
  const { result, unmount } = renderHook(useStudioPublishProgress);
  act(() => {
    result.current.begin();
    result.current.abandon();
  });
  expect(result.current.phase).toBeUndefined();
  expect(cancelled).toHaveBeenCalledWith(uuid);
  act(() => listener?.({ id: uuid, phase: 'publishing' }));
  expect(result.current.phase).toBeUndefined();
  unmount();
  expect(cancelled).toHaveBeenCalledTimes(1);
});
