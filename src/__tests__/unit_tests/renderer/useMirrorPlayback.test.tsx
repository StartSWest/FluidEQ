import { act, renderHook } from '@testing-library/react';
import type { ICaptureGraph } from '../../../renderer/graph/useLiveOutputSpectrum';
import {
  useMirrorPlayback,
  IDesiredMirror,
} from '../../../renderer/audio/useMirrorPlayback';
import {
  startOutputMirror,
  IOutputMirror,
} from '../../../renderer/audio/outputMirror';

jest.mock('../../../renderer/audio/outputMirror', () => ({
  startOutputMirror: jest.fn(),
  MAX_MIRROR_VOLUME: 1,
}));
const start = jest.mocked(startOutputMirror);
const wanted: IDesiredMirror = { guid: 'B', sinkId: 'B' };
const output = (): IOutputMirror => ({
  sinkId: 'B',
  stop: jest.fn(),
  setVolume: jest.fn(),
});
const resetListeners = new Set<() => void>();
const previousElectron = window.electron;
beforeEach(() => {
  start.mockReset();
  resetListeners.clear();
  window.electron = {
    ipcRenderer: {
      onOutputMirrorsReset: (listener: () => void) => {
        resetListeners.add(listener);
        return () => resetListeners.delete(listener);
      },
    },
  } as unknown as typeof window.electron;
});
afterEach(() => {
  window.electron = previousElectron;
});

it('stops a late Web Audio start from the old main without disconnecting the new mirror', async () => {
  const capture = {} as ICaptureGraph;
  let finish: (mirror: IOutputMirror) => void = () => undefined;
  start.mockReturnValueOnce(
    new Promise((resolve) => {
      finish = resolve;
    }),
  );
  const onError = jest.fn();
  const { result, rerender, unmount } = renderHook(
    ({ source }) =>
      useMirrorPlayback([wanted], {}, capture, false, source, onError),
    { initialProps: { source: 'A' } },
  );
  const staleSignal = start.mock.calls[0][0].signal;
  const current = output();
  start.mockResolvedValueOnce(current);
  await act(async () => {
    rerender({ source: 'C' });
  });
  expect(staleSignal?.aborted).toBe(true);
  expect(result.current.runningGuids).toEqual(['B']);
  const stale = output();
  await act(async () => {
    finish(stale);
  });
  expect(stale.stop).toHaveBeenCalledTimes(1);
  expect(current.stop).not.toHaveBeenCalled();
  expect(onError).not.toHaveBeenCalled();
  unmount();
  expect(current.stop).toHaveBeenCalledTimes(1);
});

it('retains a native receiver when main is retargeted and rebuilds it only on an explicit reset', async () => {
  const first = output();
  const replacement = output();
  start.mockResolvedValueOnce(first).mockResolvedValueOnce(replacement);
  const onError = jest.fn();
  const { result, rerender, unmount } = renderHook(
    ({ source }) =>
      useMirrorPlayback([wanted], {}, undefined, true, source, onError),
    { initialProps: { source: 'A' } },
  );
  await act(async () => undefined);
  expect(result.current.runningGuids).toEqual(['B']);
  await act(async () => rerender({ source: 'C' }));
  expect(start).toHaveBeenCalledTimes(1);
  expect(first.stop).not.toHaveBeenCalled();
  await act(async () => resetListeners.forEach((listener) => listener()));
  expect(start).toHaveBeenCalledTimes(2);
  expect(first.stop).toHaveBeenCalledTimes(1);
  expect(replacement.stop).not.toHaveBeenCalled();
  expect(result.current.runningGuids).toEqual(['B']);
  unmount();
  expect(replacement.stop).toHaveBeenCalledTimes(1);
  expect(resetListeners.size).toBe(0);
  expect(onError).not.toHaveBeenCalled();
});

it('shows configured engine delay immediately and clears it when no current report exists', async () => {
  start.mockResolvedValueOnce(output());
  const { result } = renderHook(() =>
    useMirrorPlayback([wanted], {}, undefined, true, 'A', jest.fn()),
  );
  await act(async () => undefined);
  const { onDelay } = start.mock.calls[0][0];
  act(() => onDelay?.(36, 'engine'));
  expect(result.current.delays).toEqual({ B: 36 });
  act(() => onDelay?.(49, 'engine'));
  expect(result.current.delays).toEqual({ B: 49 });
  expect(result.current.delayKinds).toEqual({ B: 'engine' });
  act(() => onDelay?.(0, 'unavailable'));
  expect(result.current.delays).toEqual({});
  expect(result.current.delayKinds).toEqual({ B: 'unavailable' });
});

it('does not adopt a cancelled start when the same device is quickly enabled again', async () => {
  let finish: (mirror: IOutputMirror) => void = () => undefined;
  start.mockReturnValueOnce(
    new Promise((resolve) => {
      finish = resolve;
    }),
  );
  const current = output();
  start.mockResolvedValue(current);
  const { result, rerender, unmount } = renderHook(
    ({ desired }) =>
      useMirrorPlayback(desired, {}, undefined, true, 'A', jest.fn()),
    { initialProps: { desired: [wanted] } },
  );
  rerender({ desired: [] });
  rerender({ desired: [wanted] });
  const stale = output();
  await act(async () => {
    finish(stale);
  });
  expect(stale.stop).toHaveBeenCalledTimes(1);
  expect(start).toHaveBeenCalledTimes(2);
  expect(result.current.runningGuids).toEqual(['B']);
  unmount();
  expect(current.stop).toHaveBeenCalledTimes(1);
});

it('reports a failed start once instead of retrying forever until the user toggles it', async () => {
  start.mockRejectedValue(new Error('unavailable'));
  const onError = jest.fn();
  const { rerender, unmount } = renderHook(
    ({ desired }) =>
      useMirrorPlayback(desired, {}, undefined, true, 'A', onError),
    { initialProps: { desired: [wanted] } },
  );
  await act(async () => undefined);
  rerender({ desired: [{ ...wanted }] });
  expect(start).toHaveBeenCalledTimes(1);
  expect(onError).toHaveBeenCalledTimes(1);
  rerender({ desired: [] });
  await act(async () => {
    rerender({ desired: [wanted] });
  });
  expect(start).toHaveBeenCalledTimes(2);
  unmount();
});

it('keeps each running output’s delay as an average, and forgets it when it stops', async () => {
  const running = output();
  start.mockResolvedValueOnce(running);
  const { result, rerender } = renderHook(
    ({ desired }) =>
      useMirrorPlayback(desired, {}, undefined, true, 'A', jest.fn()),
    { initialProps: { desired: [wanted] } },
  );
  await act(async () => undefined);
  const { onDelay } = start.mock.calls[0][0];
  expect(onDelay).toBeDefined();
  act(() => onDelay?.(41.6));
  expect(result.current.delays).toEqual({ B: 42 });
  // A reading that does not move the average by a step worth reading is
  // not a redraw (`steadyReadout.ts`).
  act(() => onDelay?.(43));
  expect(result.current.delays).toEqual({ B: 42 });
  await act(async () => {
    rerender({ desired: [] });
  });
  expect(result.current.delays).toEqual({});
  expect(running.stop).toHaveBeenCalledTimes(1);
});
