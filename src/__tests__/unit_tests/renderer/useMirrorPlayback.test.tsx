import { act, renderHook } from '@testing-library/react';
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
const wanted: IDesiredMirror = { guid: 'B', sinkId: 'B', mode: 'video' };
const output = (): IOutputMirror => ({
  sinkId: 'B',
  mode: 'video',
  stop: jest.fn(),
  setVolume: jest.fn(),
});
beforeEach(() => start.mockReset());

it('stops a late start from the old main output without disconnecting the new mirror', async () => {
  let finish: (mirror: IOutputMirror) => void = () => undefined;
  start.mockReturnValueOnce(
    new Promise((resolve) => {
      finish = resolve;
    }),
  );
  const onError = jest.fn();
  const { result, rerender, unmount } = renderHook(
    ({ source }) =>
      useMirrorPlayback([wanted], {}, undefined, true, source, onError),
    { initialProps: { source: 'A' } },
  );
  const staleSignal = start.mock.calls[0][0].signal;
  const current = output();
  start.mockResolvedValueOnce(current);
  await act(async () => {
    rerender({ source: 'C' });
  });
  expect(staleSignal?.aborted).toBe(true);
  expect(result.current).toEqual(['B']);
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
  expect(result.current).toEqual(['B']);
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
