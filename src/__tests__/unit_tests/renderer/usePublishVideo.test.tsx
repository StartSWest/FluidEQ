import { act, renderHook } from '@testing-library/react';
import {
  createPreviewVideoRecorder,
  type IPreviewVideo,
} from '../../../renderer/studio/previewVideo';
import usePublishVideo from '../../../renderer/studio/usePublishVideo';

jest.mock('../../../renderer/studio/previewVideo', () => ({
  createPreviewVideoRecorder: jest.fn(),
}));
const takes: {
  resolve: (video: IPreviewVideo) => void;
  reject: (error: Error) => void;
  cancel: jest.Mock;
  frame: jest.Mock;
}[] = [];
const preview = () => ({
  blob: new Blob(['clip']),
  durationMs: 10000,
  width: 640,
  height: 360,
});
const revoked = jest.fn();
const created = jest.fn();
const cancelledFrame = jest.fn();
let queuedFrame: FrameRequestCallback | undefined;

beforeEach(() => {
  jest.clearAllMocks();
  takes.length = 0;
  queuedFrame = undefined;
  Object.defineProperty(URL, 'createObjectURL', {
    configurable: true,
    value: created.mockImplementation(() => `blob:take-${takes.length}`),
  });
  Object.defineProperty(URL, 'revokeObjectURL', {
    configurable: true,
    value: revoked,
  });
  jest.spyOn(window, 'requestAnimationFrame').mockImplementation((callback) => {
    queuedFrame = callback;
    return 42;
  });
  jest.spyOn(window, 'cancelAnimationFrame').mockImplementation(cancelledFrame);
  jest
    .mocked(createPreviewVideoRecorder)
    .mockImplementation((_watermark, progress) => {
      let complete: (video: IPreviewVideo) => void = () => undefined;
      let fail: (error: Error) => void = () => undefined;
      const result = new Promise<IPreviewVideo>((resolve, reject) => {
        complete = resolve;
        fail = reject;
      });
      const cancel = jest.fn(() =>
        fail(new DOMException('cancelled', 'AbortError')),
      );
      const frame = jest.fn();
      takes.push({ resolve: complete, reject: fail, cancel, frame });
      progress({ phase: 'preparing' });
      return { result, frame, cancel };
    });
});
afterEach(() => jest.restoreAllMocks());

it('invalidates a ready clip when project, version, content or settings identity changes', async () => {
  const changed = jest.fn();
  const { result, rerender, unmount } = renderHook(
    (source) => usePublishVideo(source, 'Preview', changed),
    { initialProps: 'project:a/version:1/settings:old' },
  );
  await act(async () => {
    takes[0].resolve(preview());
  });
  expect(result.current.state.phase).toBe('ready');
  rerender('project:a/version:1/settings:new');
  expect(result.current.state.phase).toBe('preparing');
  expect(changed).toHaveBeenLastCalledWith(undefined);
  expect(takes[0].cancel).toHaveBeenCalled();
  expect(revoked).toHaveBeenCalledWith('blob:take-1');
  expect(takes).toHaveLength(2);
  unmount();
});

it('ignores an old recording that finishes after a replacement source mounts', async () => {
  const changed = jest.fn();
  const { rerender, result, unmount } = renderHook(
    (source) => usePublishVideo(source, 'Preview', changed),
    { initialProps: 'first' },
  );
  takes[0].cancel.mockImplementation(() => undefined);
  rerender('second');
  await act(async () => {
    takes[0].resolve(preview());
  });
  expect(created).not.toHaveBeenCalled();
  expect(result.current.state.phase).toBe('preparing');
  await act(async () => {
    takes[1].resolve(preview());
  });
  expect(changed).toHaveBeenLastCalledWith(
    expect.objectContaining({ source: 'second' }),
  );
  unmount();
});

it('re-records from a fresh capture and revokes the old playable URL', async () => {
  const { result, unmount } = renderHook(() =>
    usePublishVideo('same-source', 'Preview', jest.fn()),
  );
  await act(async () => {
    takes[0].resolve(preview());
  });
  act(() => result.current.retry());
  expect(revoked).toHaveBeenCalledWith('blob:take-1');
  expect(result.current.state.phase).toBe('preparing');
  expect(takes).toHaveLength(2);
  unmount();
});

it('cancels outstanding frame delivery on close and ignores late completion', async () => {
  const { result, unmount } = renderHook(() =>
    usePublishVideo('source', 'Preview', jest.fn()),
  );
  const canvas = document.createElement('canvas');
  act(() => {
    result.current.frame(canvas);
    result.current.frame(canvas);
  });
  expect(window.requestAnimationFrame).toHaveBeenCalledTimes(1);
  expect(queuedFrame).toBeDefined();
  unmount();
  expect(cancelledFrame).toHaveBeenCalledWith(42);
  expect(takes[0].cancel).toHaveBeenCalledTimes(1);
  await act(async () => {
    takes[0].resolve(preview());
  });
  expect(created).not.toHaveBeenCalled();
});

it.each(['cancel', 'fail'] as const)(
  'exposes the %s state and a retry path',
  async (action) => {
    const { result, unmount } = renderHook(() =>
      usePublishVideo('source', 'Preview', jest.fn()),
    );
    await act(async () => {
      result.current[action]();
    });
    expect(result.current.state.phase).toBe(
      action === 'cancel' ? 'cancelled' : 'failed',
    );
    act(() => result.current.retry());
    expect(result.current.state.phase).toBe('preparing');
    unmount();
  },
);
