import { act, renderHook } from '@testing-library/react';
import type { IAudioRestartOutcome } from 'common/audioEngine';
import { useEngineMaintenance } from 'renderer/utils/useEngineMaintenance';

const success: IAudioRestartOutcome = { ok: true, declined: false };
const failure: IAudioRestartOutcome = { ok: false, declined: false };
/** The output repair, for the cases that are not about it. */
const repair = async (): Promise<IAudioRestartOutcome> => success;

const pendingOutcome = () => {
  let finish!: (outcome: IAudioRestartOutcome) => void;
  const promise = new Promise<IAudioRestartOutcome>((resolve) => {
    finish = resolve;
  });
  return { promise, finish };
};

describe('engine maintenance owns its audio restart', () => {
  it('keeps one update through repeated clicks and manual restart requests', async () => {
    const pending = pendingOutcome();
    const update = jest.fn(() => pending.promise);
    const restart = jest.fn(async () => success);
    const { result } = renderHook(() =>
      useEngineMaintenance(true, restart, update, repair),
    );
    expect(result.current.suppressAudioNotices).toBe(false);
    act(() => result.current.audioRestart.open());
    expect(result.current.audioRestart.isOpen).toBe(true);

    let running!: Promise<void>;
    act(() => {
      running = result.current.engineUpdate.run();
      result.current.engineUpdate.run();
      result.current.audioRestart.open();
      result.current.audioRestart.run();
    });
    expect(update).toHaveBeenCalledTimes(1);
    expect(restart).not.toHaveBeenCalled();
    expect(result.current.audioRestart.isOpen).toBe(false);
    expect(result.current.engineUpdate.isOpen).toBe(true);
    expect(result.current.engineUpdate.phase).toBe('running');
    expect(result.current.suppressAudioNotices).toBe(true);

    act(() => result.current.engineUpdate.close());
    expect(result.current.suppressAudioNotices).toBe(true);
    act(() => result.current.audioRestart.open());
    expect(result.current.engineUpdate.isOpen).toBe(true);
    expect(result.current.engineUpdate.phase).toBe('running');

    await act(async () => {
      pending.finish(success);
      await running;
    });
    expect(result.current.engineUpdate.phase).toBe('done');
    expect(result.current.suppressAudioNotices).toBe(true);
    act(() => result.current.engineUpdate.close());
    expect(result.current.suppressAudioNotices).toBe(false);
    act(() => result.current.audioRestart.open());
    await act(() => result.current.audioRestart.run());
    expect(restart).toHaveBeenCalledTimes(1);
  });

  it('shows an update failure before restoring genuine trouble notices', async () => {
    const update = jest.fn(async () => failure);
    const { result } = renderHook(() =>
      useEngineMaintenance(true, async () => success, update, repair),
    );
    await act(() => result.current.engineUpdate.run());
    expect(result.current.engineUpdate.phase).toBe('failed');
    expect(result.current.suppressAudioNotices).toBe(true);
    act(() => result.current.engineUpdate.close());
    expect(result.current.suppressAudioNotices).toBe(false);

    update.mockResolvedValue(success);
    await act(() => result.current.engineUpdate.run());
    expect(update).toHaveBeenCalledTimes(2);
    expect(result.current.engineUpdate.phase).toBe('done');
    act(() => result.current.audioRestart.open());
    expect(result.current.engineUpdate.isOpen).toBe(false);
    expect(result.current.audioRestart.isOpen).toBe(true);
    expect(result.current.suppressAudioNotices).toBe(false);
  });

  it('cannot start an update during an already-running manual restart', async () => {
    const pending = pendingOutcome();
    const update = jest.fn(async () => success);
    const { result } = renderHook(() =>
      useEngineMaintenance(true, () => pending.promise, update, repair),
    );
    let running!: Promise<void>;
    act(() => {
      running = result.current.audioRestart.run();
      result.current.engineUpdate.run();
    });
    expect(update).not.toHaveBeenCalled();
    await act(async () => {
      pending.finish(success);
      await running;
    });
    await act(() => result.current.engineUpdate.run());
    expect(update).toHaveBeenCalledTimes(1);
  });

  it('repairs silently under the same lock, and refuses a restart meanwhile', async () => {
    // The repair the app runs by itself for an engine Windows has never
    // created: no card of its own, but the same elevated helper as an update,
    // so it holds the same lock — a restart from the actions menu during it
    // would be a second helper on the same services.
    const pending = pendingOutcome();
    const update = jest.fn(async () => success);
    const outputRepair = jest.fn(() => pending.promise);
    const restart = jest.fn(async () => success);
    const { result } = renderHook(() =>
      useEngineMaintenance(false, restart, update, outputRepair),
    );
    let running!: Promise<IAudioRestartOutcome | undefined>;
    let refused!: Promise<IAudioRestartOutcome | undefined>;
    act(() => {
      running = result.current.repairEngine('{SPEAKERS}');
      refused = result.current.repairEngine('{SPEAKERS}');
      result.current.audioRestart.run();
    });
    expect(outputRepair).toHaveBeenCalledTimes(1);
    expect(outputRepair).toHaveBeenCalledWith('{SPEAKERS}');
    expect(update).not.toHaveBeenCalled();
    expect(restart).not.toHaveBeenCalled();
    // The second ask while the first runs is not tried, and says so.
    await expect(refused).resolves.toBeUndefined();
    // Silent: nothing opened, nothing suppressed.
    expect(result.current.engineUpdate.isOpen).toBe(false);
    expect(result.current.suppressAudioNotices).toBe(false);
    await act(async () => {
      pending.finish(success);
      await expect(running).resolves.toEqual(success);
    });
    await act(() => result.current.audioRestart.run());
    expect(restart).toHaveBeenCalledTimes(1);
  });
});
