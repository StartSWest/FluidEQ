/* FluidEQ — GPL-3.0-or-later */

import { act, renderHook } from '@testing-library/react';
import {
  LiveAudioProvider,
  useLiveAudioCapture,
  useLiveAudioControl,
  useLiveAudioFrame,
} from '../../../renderer/audio/LiveAudioContext';

jest.mock('../../../renderer/utils/FluidEqContext', () => ({
  useFluidEqContext: () => ({ isEnabled: true }),
}));
jest.mock('../../../renderer/utils/I18nContext', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));
jest.mock('../../../renderer/remoteAudio/useSenderSpectrum', () => ({
  __esModule: true,
  default: (enabled: boolean) =>
    enabled
      ? {
          points: [{ x: 100, y: -10 }],
          waveform: [0.8],
          outputLevels: [{ levelDb: -2, peakDb: -2, isClipping: false }],
          isClipping: false,
        }
      : undefined,
}));

const createCaptureStream = () => {
  const track = Object.assign(new EventTarget(), {
    muted: false,
    stop: jest.fn(),
    getSettings: () => ({ channelCount: 2 }),
  });
  return {
    track,
    getTracks: () => [track],
    getAudioTracks: () => [track],
    getVideoTracks: () => [],
  };
};

const contexts: CaptureContext[] = [];
const streams: ReturnType<typeof createCaptureStream>[] = [];
const resume = jest.fn<Promise<void>, []>();

class CaptureContext {
  sampleRate = 48_000;

  amplitude = 0.25;

  close = jest.fn().mockResolvedValue(undefined);

  resume = resume;

  constructor() {
    contexts.push(this);
  }

  createAnalyser = () => ({
    fftSize: 2048,
    frequencyBinCount: 1024,
    getFloatFrequencyData: (data: Float32Array) =>
      data.fill(this.amplitude > 0 ? -20 : -200),
    getFloatTimeDomainData: (data: Float32Array) => data.fill(this.amplitude),
  });

  createMediaStreamSource = jest.fn(() => ({
    channelCount: 2,
    connect: jest.fn(),
    disconnect: jest.fn(),
  }));

  createChannelSplitter = jest.fn(() => ({
    connect: jest.fn(),
    disconnect: jest.fn(),
  }));
}

const useDisplay = (wanted = true) => {
  useLiveAudioCapture(wanted);
  return { control: useLiveAudioControl(), frame: useLiveAudioFrame() };
};

describe('sender display handoff to local audio', () => {
  const originalContext = globalThis.AudioContext;
  const originalMediaDevices = navigator.mediaDevices;

  beforeEach(() => {
    jest.useFakeTimers();
    contexts.length = 0;
    streams.length = 0;
    resume.mockReset().mockResolvedValue(undefined);
    Object.defineProperty(globalThis, 'AudioContext', {
      configurable: true,
      value: CaptureContext,
    });
    Object.defineProperty(navigator, 'mediaDevices', {
      configurable: true,
      value: {
        getDisplayMedia: jest.fn(async () => {
          const stream = createCaptureStream();
          streams.push(stream);
          return stream;
        }),
      },
    });
  });

  afterEach(() => {
    jest.useRealTimers();
    Object.defineProperty(globalThis, 'AudioContext', {
      configurable: true,
      value: originalContext,
    });
    Object.defineProperty(navigator, 'mediaDevices', {
      configurable: true,
      value: originalMediaDevices,
    });
  });

  it('resumes live graphs, waveforms and meters after the sender feed ends', async () => {
    const { result, unmount } = renderHook(() => useDisplay(), {
      wrapper: LiveAudioProvider,
    });
    await act(async () => undefined);
    act(() => jest.advanceTimersByTime(50));
    expect(result.current.frame.waveform[0]).toBeCloseTo(0.25);

    act(() => result.current.control.setSharingAudio(true));
    expect(result.current.frame.waveform).toEqual([0.8]);
    // Native sending can mask a live but silent old loopback. Merely choosing
    // its cached frame again reproduces the flat displays after disconnection.
    contexts[0].amplitude = 0;
    await act(async () => result.current.control.setSharingAudio(false));
    act(() => jest.advanceTimersByTime(50));

    expect(streams[0].track.stop).toHaveBeenCalledTimes(1);
    expect(contexts[0].close).toHaveBeenCalledTimes(1);
    expect(contexts).toHaveLength(2);
    expect(result.current.control.isActive).toBe(true);
    expect(result.current.frame.points.length).toBeGreaterThan(0);
    expect(result.current.frame.waveform[0]).toBeCloseTo(0.25);
    expect(result.current.frame.outputLevels[0].levelDb).toBeGreaterThan(-60);
    act(() => streams[0].track.dispatchEvent(new Event('ended')));
    expect(result.current.control.capture?.context).toBe(contexts[1]);
    expect(contexts[1].close).not.toHaveBeenCalled();
    unmount();
  });

  it('replaces a capture still awaiting resume when the sender disconnects', async () => {
    let finishResume: (() => void) | undefined;
    resume.mockImplementationOnce(
      () =>
        new Promise<void>((resolve) => {
          finishResume = resolve;
        }),
    );
    const { result, unmount } = renderHook(() => useDisplay(), {
      wrapper: LiveAudioProvider,
    });
    await act(async () => undefined);
    act(() => result.current.control.setSharingAudio(true));
    act(() => result.current.control.setSharingAudio(false));
    await act(async () => finishResume?.());

    expect(streams[0].track.stop).toHaveBeenCalledTimes(1);
    expect(contexts[0].close).toHaveBeenCalledTimes(1);
    expect(contexts).toHaveLength(2);
    expect(result.current.control.capture?.context).toBe(contexts[1]);
    unmount();
  });

  it('does not open local capture without a display or work owner', async () => {
    const { result, unmount } = renderHook(() => useDisplay(false), {
      wrapper: LiveAudioProvider,
    });
    act(() => result.current.control.setSharingAudio(true));
    await act(async () => result.current.control.setSharingAudio(false));
    expect(streams).toHaveLength(0);
    expect(contexts).toHaveLength(0);
    unmount();
  });
});
