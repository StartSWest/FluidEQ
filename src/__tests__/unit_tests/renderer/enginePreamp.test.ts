import { act, renderHook } from '@testing-library/react';
import {
  useEnginePreamp,
  useEnginePreampReader,
} from '../../../renderer/utils/enginePreamp';
import { getAudioDevices } from '../../../renderer/utils/equalizerApi';
import { IEnginePreamp } from '../../../common/enginePreamp';

jest.mock('../../../renderer/utils/equalizerApi', () => ({
  getAudioDevices: jest.fn(),
}));
jest.mock('../../../renderer/utils/logger', () => ({ reportError: jest.fn() }));

describe('final output preamp display', () => {
  const read = jest.fn();
  const original = window.electron;
  let paint: FrameRequestCallback | undefined;
  const useReadout = (enabled: boolean) => {
    useEnginePreampReader(enabled);
    return useEnginePreamp();
  };
  const devices = (guid: string) =>
    [{ guid, isDefault: true }] as Awaited<ReturnType<typeof getAudioDevices>>;

  beforeEach(() => {
    jest.clearAllMocks();
    paint = undefined;
    Object.defineProperty(window, 'electron', {
      configurable: true,
      value: { ipcRenderer: { readEnginePreamp: read } },
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
    jest.mocked(getAudioDevices).mockResolvedValue(devices('current'));
    read.mockResolvedValue({ gainDb: -3.456, enabled: true, active: true });
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
      const callback = paint;
      paint = undefined;
      callback?.(0);
    });
  };

  it('shows measured gain and clears it when automatic control is disabled', async () => {
    const view = renderHook(({ enabled }) => useReadout(enabled), {
      initialProps: { enabled: true },
    });
    await act(async () => {});
    await tick();
    expect(read).toHaveBeenCalledWith('current');
    expect(view.result.current?.gainDb).toBe(-3.46);
    view.rerender({ enabled: false });
    expect(view.result.current).toBeUndefined();
    expect(paint).toBeUndefined();
    view.unmount();
  });

  it('does not let an old output request overwrite the new output', async () => {
    const view = renderHook(() => useReadout(true));
    await act(async () => {});
    let finish: ((value: IEnginePreamp) => void) | undefined;
    read.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          finish = resolve;
        }),
    );
    await tick();
    jest.mocked(getAudioDevices).mockResolvedValue(devices('new'));
    await act(async () => {
      window.dispatchEvent(new Event('fluideq-output-changed'));
    });
    await tick();
    expect(read).toHaveBeenLastCalledWith('new');
    expect(view.result.current?.gainDb).toBe(-3.46);
    await act(async () => {
      finish?.({ gainDb: -18, enabled: true, active: true });
    });
    expect(view.result.current?.gainDb).toBe(-3.46);
    view.unmount();
    expect(paint).toBeUndefined();
  });

  it('ignores a late failure after a new output is already displaying', async () => {
    const view = renderHook(() => useReadout(true));
    await act(async () => {});
    let fail: ((reason: Error) => void) | undefined;
    read.mockImplementationOnce(
      () =>
        new Promise((_resolve, reject) => {
          fail = reject;
        }),
    );
    await tick();
    await act(async () => {
      window.dispatchEvent(new Event('fluideq-output-changed'));
    });
    await tick();
    expect(view.result.current?.gainDb).toBe(-3.46);
    await act(async () => {
      fail?.(new Error('old output closed'));
    });
    expect(view.result.current?.gainDb).toBe(-3.46);
    view.unmount();
  });
});
