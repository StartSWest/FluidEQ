import { act, renderHook } from '@testing-library/react';
import {
  useEnginePreamp,
  useEnginePreampReader,
} from '../../../renderer/utils/enginePreamp';
import { getAudioDevices } from '../../../renderer/utils/equalizerApi';
import { IEnginePreamp } from '../../../common/enginePreamp';

jest.mock('../../../renderer/utils/equalizerApi', () => {
  const getAudioDevices = jest.fn();
  return {
    getAudioDevices,
    // Open-time readers take the kept list; here it is the same answer.
    readKnownAudioDevices: () => getAudioDevices(),
  };
});
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

  it('reads once a frame however many places show it', async () => {
    // The side bar's dial and the amp's band screen are both mounted while
    // the window is the amp; each used to run a loop of its own.
    const sideBar = renderHook(() => useReadout(true));
    const amp = renderHook(() => useReadout(true));
    await act(async () => {});
    // One loop asking for frames, not one per place.
    expect(window.requestAnimationFrame).toHaveBeenCalledTimes(1);
    await tick();
    expect(read).toHaveBeenCalledTimes(1);
    expect(sideBar.result.current?.gainDb).toBe(-3.46);
    expect(amp.result.current?.gainDb).toBe(-3.46);

    // One leaving keeps the other's reading going…
    sideBar.unmount();
    expect(amp.result.current?.gainDb).toBe(-3.46);
    await tick();
    expect(read).toHaveBeenCalledTimes(2);

    // …and the last one leaving stops it.
    amp.unmount();
    expect(paint).toBeUndefined();
  });

  it('keeps reading for one place while another has it switched off', async () => {
    const reading = renderHook(() => useReadout(true));
    await act(async () => {});
    await tick();
    const idle = renderHook(() => useReadout(false));

    expect(reading.result.current?.gainDb).toBe(-3.46);
    expect(idle.result.current?.gainDb).toBe(-3.46);
    idle.unmount();
    reading.unmount();
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
