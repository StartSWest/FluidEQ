/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * Just enough of Windows loopback and Web Audio for `useLiveOutputSpectrum`,
 * with every clock and every event moved only by the test.
 *
 * The capture is `getDisplayMedia` in Electron and cannot run under jsdom, so
 * these stand in for it: analysers whose every sample is the one amplitude a
 * test sets, a track that mutes and ends when told to, a device list whose
 * default output a test can move, and the audio clock's worklet node, whose
 * port is ticked by hand (`tickAudio`) the way the audio thread posts to it.
 *
 * The analysers are the only part a test file has to mock itself — the
 * drawing's reader and the graph band take nodes these do not model — so
 * each file also carries the two `jest.mock` calls that `liveSpectrumRest`
 * does.
 */

/** What every analyser hears: one amplitude, on every sample of both channels. */
export const signal = { amplitude: 0 };

const node = () => ({
  connect: <Next>(next: Next) => next,
  disconnect: () => undefined,
});

const createAnalyser = () => ({
  ...node(),
  fftSize: 2048,
  frequencyBinCount: 1024,
  minDecibels: -100,
  maxDecibels: 0,
  smoothingTimeConstant: 0,
  getFloatFrequencyData: (target: Float32Array) => {
    target.fill(signal.amplitude > 0 ? -20 : -Infinity);
  },
  getFloatTimeDomainData: (target: Float32Array) => {
    target.fill(signal.amplitude);
  },
});

export interface IFakeCaptureContext extends EventTarget {
  sampleRate: number;
  state: AudioContextState;
  /** What `resume()` answers; a test makes it refuse to lose the context. */
  resumeResult: () => Promise<void>;
  /** Moves the context to `state` and says so, as a real one does. */
  becomes: (state: AudioContextState) => void;
}

const createContext = (): IFakeCaptureContext => {
  const context = Object.assign(new EventTarget(), {
    sampleRate: 48_000,
    currentTime: 0,
    state: 'running' as AudioContextState,
    destination: {},
    audioWorklet: { addModule: jest.fn(() => Promise.resolve()) },
    resumeResult: () => Promise.resolve(),
    // An analyser knows its context, as a real one does: the sound it hears
    // (`liveSound.ts`) reads the rate and the clock from there.
    createAnalyser: () => ({ ...createAnalyser(), context }),
    createMediaStreamSource: () => ({ ...node(), channelCount: 2 }),
    createChannelSplitter: node,
    createGain: () => ({ ...node(), gain: { value: 1 } }),
  });
  return Object.assign(context, {
    resume: jest.fn(() => context.resumeResult()),
    close: jest.fn(() => {
      context.state = 'closed';
      return Promise.resolve();
    }),
    becomes: (state: AudioContextState) => {
      context.state = state;
      context.dispatchEvent(new Event('statechange'));
    },
  });
};

interface IFakeClockPort {
  onmessage: ((event: { data: unknown }) => void) | null;
  close: () => void;
}

/** Every clock port made, in order: `tickAudio` posts to each still open. */
export const clockPorts: IFakeClockPort[] = [];

/** The audio clock's node, built with `new`: a port the test posts through. */
const FakeClockNode = jest.fn(() => {
  const port: IFakeClockPort = { onmessage: null, close: () => undefined };
  clockPorts.push(port);
  return { port, ...node() };
});

export interface IFakeTrack extends EventTarget {
  muted: boolean;
  readyState: MediaStreamTrackState;
  stop: jest.Mock;
  /** Windows substituting silence under a live track: it mutes. */
  mute: () => void;
  unmute: () => void;
  /** The track stopping on its own, which is when `ended` fires. */
  end: () => void;
}

const createTrack = (): IFakeTrack => {
  const track = Object.assign(new EventTarget(), {
    muted: false,
    readyState: 'live' as MediaStreamTrackState,
    getSettings: () => ({ channelCount: 2 }),
  });
  return Object.assign(track, {
    stop: jest.fn(() => {
      track.readyState = 'ended';
    }),
    mute: () => {
      track.muted = true;
      track.dispatchEvent(new Event('mute'));
    },
    unmute: () => {
      track.muted = false;
      track.dispatchEvent(new Event('unmute'));
    },
    end: () => {
      track.readyState = 'ended';
      track.dispatchEvent(new Event('ended'));
    },
  });
};

export const contexts: IFakeCaptureContext[] = [];
export const tracks: IFakeTrack[] = [];

const createStream = () => {
  const track = createTrack();
  tracks.push(track);
  return {
    getVideoTracks: () => [],
    getAudioTracks: () => [track],
    getTracks: () => [track],
    removeTrack: () => undefined,
  };
};

export interface IFakeMediaDevices extends EventTarget {
  /** What Chromium's list names as the default output. */
  defaultOutput: { groupId: string; label: string };
  /** While set, every capture is refused, as Windows does mid-switch. */
  isRefusing: boolean;
  getDisplayMedia: jest.Mock;
  /** A device arriving or leaving, as Chromium announces it. */
  changeDevices: () => void;
}

const createDevices = (): IFakeMediaDevices => {
  const devices = Object.assign(new EventTarget(), {
    defaultOutput: { groupId: 'speakers', label: 'Default - Speakers' },
    isRefusing: false,
  });
  return Object.assign(devices, {
    getDisplayMedia: jest.fn(() =>
      devices.isRefusing
        ? Promise.reject(new Error('The capture was refused.'))
        : Promise.resolve(createStream()),
    ),
    enumerateDevices: jest.fn(() =>
      Promise.resolve([
        { kind: 'audiooutput', deviceId: 'default', ...devices.defaultOutput },
      ]),
    ),
    changeDevices: () => devices.dispatchEvent(new Event('devicechange')),
  });
};

const installed = { devices: createDevices() };

/** The device list the hook is reading now. */
export const fakeDevices = () => installed.devices;

/** Puts the stand-ins where the hook looks for the real things. */
export const installFakeCapture = () => {
  installed.devices = createDevices();
  contexts.length = 0;
  clockPorts.length = 0;
  tracks.length = 0;
  signal.amplitude = 0;
  Object.assign(globalThis, {
    AudioContext: jest.fn(() => {
      const context = createContext();
      contexts.push(context);
      return context;
    }),
    AudioWorkletNode: FakeClockNode,
  });
  Object.defineProperty(navigator, 'mediaDevices', {
    configurable: true,
    value: installed.devices,
  });
};

export const uninstallFakeCapture = () => {
  Reflect.deleteProperty(globalThis, 'AudioContext');
  Reflect.deleteProperty(globalThis, 'AudioWorkletNode');
  Reflect.deleteProperty(navigator, 'mediaDevices');
};

/**
 * One tick of the audio clock: `audioMs` of audio rendered, posted to every
 * clock still listening. A closed clock has let go of its port and hears none.
 */
export const tickAudio = (audioMs: number) => {
  clockPorts.forEach((port) => port.onmessage?.({ data: audioMs }));
};

/** How many captures have been asked for (a failed one asks twice). */
export const captureRequests = () =>
  installed.devices.getDisplayMedia.mock.calls.length;
