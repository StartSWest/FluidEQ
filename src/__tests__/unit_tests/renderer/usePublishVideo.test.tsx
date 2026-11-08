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
  pause: jest.Mock;
  resume: jest.Mock;
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
  jest
    .spyOn(window, 'requestAnimationFrame')
    .mockImplementation((callback: FrameRequestCallback) => {
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
      const pause = jest.fn();
      const resume = jest.fn();
      takes.push({
        resolve: complete,
        reject: fail,
        cancel,
        frame,
        pause,
        resume,
      });
      progress({ phase: 'preparing' });
      return { result, frame, cancel, pause, resume };
    });
});
afterEach(() => jest.restoreAllMocks());

const draw = (capture: ReturnType<typeof usePublishVideo>) => {
  act(() => {
    capture.input(true);
    capture.frame(document.createElement('canvas'));
    queuedFrame?.(100);
  });
};

it('creates no recorder or countdown before real audio and a drawn frame', () => {
  const { result } = renderHook(() =>
    usePublishVideo('source', 'Preview', jest.fn()),
  );
  expect(result.current.state.phase).toBe('waiting');
  act(() => result.current.frame(document.createElement('canvas')));
  expect(createPreviewVideoRecorder).not.toHaveBeenCalled();
  act(() => result.current.input(true));
  expect(createPreviewVideoRecorder).not.toHaveBeenCalled();
  draw(result.current);
  expect(createPreviewVideoRecorder).toHaveBeenCalledTimes(1);
});

// A quiet bar in the music used to throw the take away and start again, so a
// song with pauses never finished one (2026-11-07). Silence now holds it.
it('holds a take through silence and carries it on with the sound', async () => {
  const changed = jest.fn();
  const { result } = renderHook(() =>
    usePublishVideo('source', 'Preview', changed),
  );
  draw(result.current);
  act(() => result.current.input(false));
  expect(takes[0].pause).toHaveBeenCalledTimes(1);
  expect(takes[0].cancel).not.toHaveBeenCalled();
  expect(result.current.state.phase).not.toBe('waiting');
  act(() => result.current.input(true));
  expect(takes[0].resume).toHaveBeenCalledTimes(1);
  await act(async () => takes[0].resolve(preview()));
  expect(takes).toHaveLength(1);
  expect(result.current.state.phase).toBe('ready');
  expect(changed).toHaveBeenLastCalledWith(
    expect.objectContaining({ durationMs: 10000 }),
  );
});

it('keeps a completion that lands after a cancel off the dialog', async () => {
  const changed = jest.fn();
  const { result } = renderHook(() =>
    usePublishVideo('source', 'Preview', changed),
  );
  draw(result.current);
  takes[0].cancel.mockImplementation(() => undefined);
  act(() => result.current.cancel());
  await act(async () => takes[0].resolve(preview()));
  expect(created).not.toHaveBeenCalled();
  expect(result.current.state.phase).toBe('cancelled');
});

it('rechecks audio at the queued paint and honours cancellation while waiting', () => {
  const { result } = renderHook(() =>
    usePublishVideo('source', 'Preview', jest.fn()),
  );
  act(() => {
    result.current.input(true);
    result.current.frame(document.createElement('canvas'));
    result.current.input(false);
    queuedFrame?.(100);
  });
  expect(takes).toHaveLength(0);
  act(() => result.current.cancel());
  draw(result.current);
  expect(takes).toHaveLength(0);
});

it('invalidates a ready clip when project, version, content or settings identity changes', async () => {
  const changed = jest.fn();
  const { result, rerender, unmount } = renderHook(
    (source) => usePublishVideo(source, 'Preview', changed),
    { initialProps: 'project:a/version:1/settings:old' },
  );
  draw(result.current);
  await act(async () => {
    takes[0].resolve(preview());
  });
  expect(result.current.state.phase).toBe('ready');
  rerender('project:a/version:1/settings:new');
  expect(result.current.state.phase).toBe('waiting');
  expect(changed).toHaveBeenLastCalledWith(undefined);
  expect(revoked).toHaveBeenCalledWith('blob:take-1');
  draw(result.current);
  expect(takes).toHaveLength(2);
  unmount();
});

it('ignores an old recording that finishes after a replacement source mounts', async () => {
  const changed = jest.fn();
  const { rerender, result, unmount } = renderHook(
    (source) => usePublishVideo(source, 'Preview', changed),
    { initialProps: 'first' },
  );
  draw(result.current);
  takes[0].cancel.mockImplementation(() => undefined);
  rerender('second');
  await act(async () => {
    takes[0].resolve(preview());
  });
  expect(created).not.toHaveBeenCalled();
  expect(result.current.state.phase).toBe('waiting');
  draw(result.current);
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
  draw(result.current);
  await act(async () => {
    takes[0].resolve(preview());
  });
  act(() => result.current.retry());
  expect(revoked).toHaveBeenCalledWith('blob:take-1');
  expect(result.current.state.phase).toBe('waiting');
  draw(result.current);
  expect(takes).toHaveLength(2);
  unmount();
});

it('cancels outstanding frame delivery on close and ignores late completion', async () => {
  const { result, unmount } = renderHook(() =>
    usePublishVideo('source', 'Preview', jest.fn()),
  );
  const canvas = document.createElement('canvas');
  draw(result.current);
  jest.mocked(window.requestAnimationFrame).mockClear();
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
    expect(result.current.state.phase).toBe('waiting');
    unmount();
  },
);
