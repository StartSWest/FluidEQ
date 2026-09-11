import { act, renderHook } from '@testing-library/react';
import type { IAudioRestartOutcome } from 'common/audioEngine';
import { useEngineMaintenance } from 'renderer/utils/useEngineMaintenance';

const success: IAudioRestartOutcome = { ok: true, declined: false };
const failure: IAudioRestartOutcome = { ok: false, declined: false };

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
      useEngineMaintenance(true, restart, update),
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
      useEngineMaintenance(true, async () => success, update),
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
      useEngineMaintenance(true, () => pending.promise, update),
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
});
