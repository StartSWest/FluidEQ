import { act, renderHook } from '@testing-library/react';
import useSystemMeters from '../../../renderer/dsp/useSystemMeters';
import { getAudioDevices } from '../../../renderer/utils/equalizerApi';
import { createNativeMeters } from '../../../renderer/dsp/nativeMeters';

jest.mock('../../../renderer/utils/equalizerApi', () => ({
  getAudioDevices: jest.fn(),
}));
jest.mock('../../../renderer/dsp/nativeMeters', () => ({
  createNativeMeters: jest.fn(),
}));
jest.mock('../../../renderer/dsp/store', () => ({
  setDspSampleRate: jest.fn(),
}));
jest.mock('../../../renderer/utils/logger', () => ({ reportError: jest.fn() }));

describe('external DSP display lifecycle', () => {
  const read = jest.fn();
  const release = jest.fn();
  const accept = jest.fn();
  let paint: FrameRequestCallback | undefined;
  const original = window.electron;

  beforeEach(() => {
    jest.clearAllMocks();
    paint = undefined;
    Object.defineProperty(window, 'electron', {
      configurable: true,
      value: { ipcRenderer: { readDspEngineAnalysis: read } },
    });
    jest
      .spyOn(window, 'requestAnimationFrame')
      .mockImplementation((callback) => {
        paint = callback;
        return 1;
      });
    jest.spyOn(window, 'cancelAnimationFrame').mockImplementation(() => {
      paint = undefined;
    });
    jest
      .mocked(getAudioDevices)
      .mockResolvedValue([
        { guid: 'current-output', isDefault: true },
      ] as Awaited<ReturnType<typeof getAudioDevices>>);
    read.mockResolvedValue(undefined);
    jest.mocked(createNativeMeters).mockImplementation((bridge) => {
      bridge.onDspHostAnalysis(accept);
      return { release } as ReturnType<typeof createNativeMeters>;
    });
  });

  afterEach(() => {
    jest.restoreAllMocks();
    Object.defineProperty(window, 'electron', {
      configurable: true,
      value: original,
    });
  });

  const tick = async () => {
    await act(async () => {
      paint?.(0);
    });
  };

  it('shows fresh external frames and clears them when playback stops', async () => {
    const view = renderHook(() => useSystemMeters(true));
    await act(async () => {});
    const frame = { sequence: 7 };
    read.mockResolvedValueOnce({ sampleRate: 48000, frame });
    await tick();
    expect(read).toHaveBeenLastCalledWith('current-output');
    expect(accept).toHaveBeenCalledWith(frame);
    read.mockResolvedValueOnce(null);
    await tick();
    expect(release).toHaveBeenCalledTimes(1);
    view.unmount();
    expect(read).toHaveBeenLastCalledWith(null);
    expect(paint).toBeUndefined();
  });

  it('does not let an in-flight external frame overwrite Library meters', async () => {
    const view = renderHook(({ enabled }) => useSystemMeters(enabled), {
      initialProps: { enabled: true },
    });
    await act(async () => {});
    let finish: ((value: unknown) => void) | undefined;
    read.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          finish = resolve;
        }),
    );
    await tick();
    view.rerender({ enabled: false });
    await act(async () => {
      finish?.({ sampleRate: 48000, frame: { sequence: 8 } });
    });
    expect(createNativeMeters).not.toHaveBeenCalled();
    expect(accept).not.toHaveBeenCalled();
    expect(paint).toBeUndefined();
    view.unmount();
  });

  it('ignores a late output lookup after the DSP display is disabled', async () => {
    let finish:
      | ((value: Awaited<ReturnType<typeof getAudioDevices>>) => void)
      | undefined;
    jest.mocked(getAudioDevices).mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          finish = resolve;
        }),
    );
    const view = renderHook(() => useSystemMeters(true));
    view.unmount();
    await act(async () => {
      finish?.([{ guid: 'old-output', isDefault: true }] as Awaited<
        ReturnType<typeof getAudioDevices>
      >);
    });
    expect(paint).toBeUndefined();
    expect(createNativeMeters).not.toHaveBeenCalled();
  });
});
