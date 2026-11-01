/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * Which capture the live displays hear through.
 *
 * The core's (`coreSystemOutput.ts`) while the window can be seen: it needs no
 * `getDisplayMedia` and no device list, and either of those starts Chromium's
 * capture process — 66 MB that used to sit in the Processes list for as long
 * as FluidEQ ran. Merely listening for `devicechange` starts it as well, so
 * that listener is only there while Chromium's capture is in use.
 *
 * Chromium's while the window is hidden and something still works on the
 * sound (the lamps, a desktop background, a mirror): a hidden window holding
 * no capture of Chromium's own drops to Windows' idle priority, and on a busy
 * machine the lamps then went seconds without a frame. And Chromium's when
 * the core cannot hear the output at all, until the output changes.
 */

import { act, render } from '@testing-library/react';
import { useEffect } from 'react';
import useLiveOutputSpectrum, {
  type TCaptureClaim,
} from 'renderer/graph/useLiveOutputSpectrum';
import {
  captureRequests,
  fakeDevices,
  installFakeCapture,
  uninstallFakeCapture,
} from '../../utils/fakeLiveCapture';

jest.mock('renderer/graph/liveFrameReader', () => ({
  connectDrawAnalyser: () => ({}),
  createLiveFrameReader: () => ({
    read: () => ({
      points: [],
      graphPoints: [],
      waveform: [],
      channelPeaks: [],
    }),
  }),
}));
jest.mock('renderer/graph/liveGraphBand', () => ({
  ...jest.requireActual('renderer/graph/liveGraphBand'),
  createLiveGraphBand: () => ({}),
}));

const mockCore = jest.fn();
jest.mock('renderer/audio/coreSystemOutput', () => ({
  __esModule: true,
  default: () => mockCore(),
}));

interface ICoreCapture {
  release: jest.Mock;
  /** The core losing the output: its track ends, as `coreSystemOutput` does. */
  lose: () => void;
}

const cores: ICoreCapture[] = [];

/** The core hearing the output, as one capture of it. */
const coreHears = () => {
  const track = Object.assign(new EventTarget(), {
    readyState: 'live' as MediaStreamTrackState,
    getSettings: () => ({ channelCount: 2 }),
    stop: jest.fn(),
  });
  const capture: ICoreCapture = {
    release: jest.fn(),
    lose: () => track.dispatchEvent(new Event('ended')),
  };
  cores.push(capture);
  return Promise.resolve({
    stream: {
      getVideoTracks: () => [],
      getAudioTracks: () => [track],
      getTracks: () => [track],
      removeTrack: () => undefined,
    },
    release: capture.release,
  });
};

let control: ReturnType<typeof useLiveOutputSpectrum>['control'] | undefined;

function Probe({ kind }: { kind: TCaptureClaim }) {
  const spectrum = useLiveOutputSpectrum();
  control = spectrum.control;
  const { claim } = spectrum.control;
  useEffect(() => claim(kind), [claim, kind]);
  return null;
}

/** Everything a start awaits, which no timer advances. */
const settle = async () => {
  await act(async () => {
    for (let turn = 0; turn < 40; turn += 1) {
      // eslint-disable-next-line no-await-in-loop -- each turn is one microtask of the start's await chain
      await Promise.resolve();
    }
  });
};

let hidden = false;
const setHidden = async (next: boolean) => {
  hidden = next;
  act(() => {
    document.dispatchEvent(new Event('visibilitychange'));
  });
  await settle();
};

/** Whether anything is listening for Chromium's device changes. */
let deviceChangeListeners = 0;

beforeEach(() => {
  installFakeCapture();
  control = undefined;
  cores.length = 0;
  hidden = false;
  mockCore.mockReset();
  mockCore.mockImplementation(coreHears);
  Object.defineProperty(document, 'hidden', {
    configurable: true,
    get: () => hidden,
  });
  deviceChangeListeners = 0;
  const devices = fakeDevices();
  const add = devices.addEventListener.bind(devices);
  const remove = devices.removeEventListener.bind(devices);
  jest
    .spyOn(devices, 'addEventListener')
    .mockImplementation((type, listener, options) => {
      if (type === 'devicechange') {
        deviceChangeListeners += 1;
      }
      add(type, listener, options);
    });
  jest
    .spyOn(devices, 'removeEventListener')
    .mockImplementation((type, listener, options) => {
      if (type === 'devicechange') {
        deviceChangeListeners -= 1;
      }
      remove(type, listener, options);
    });
});

afterEach(() => {
  uninstallFakeCapture();
  Reflect.deleteProperty(document, 'hidden');
});

describe('the live displays while the window is seen', () => {
  it('hear through the core, and never start Chromium’s capture', async () => {
    render(<Probe kind="display" />);
    await settle();

    expect(control?.isActive).toBe(true);
    expect(cores).toHaveLength(1);
    expect(captureRequests()).toBe(0);
    expect(fakeDevices().enumerateDevices).not.toHaveBeenCalled();
    expect(deviceChangeListeners).toBe(0);
  });

  it('let go of the core when the window hides with nothing working', async () => {
    render(<Probe kind="display" />);
    await settle();
    await setHidden(true);

    expect(cores[0].release).toHaveBeenCalled();
    expect(control?.isActive).toBe(false);
    expect(captureRequests()).toBe(0);
  });
});

describe('work that goes on behind the window', () => {
  it('moves to Chromium’s capture as the window hides, and back as it shows', async () => {
    render(<Probe kind="work" />);
    await settle();
    expect(cores).toHaveLength(1);
    expect(captureRequests()).toBe(0);

    await setHidden(true);
    expect(cores[0].release).toHaveBeenCalled();
    expect(captureRequests()).toBe(1);
    expect(control?.isActive).toBe(true);
    // Chromium's capture is the one that follows devices by this event.
    expect(deviceChangeListeners).toBe(1);

    await setHidden(false);
    expect(cores).toHaveLength(2);
    expect(captureRequests()).toBe(1);
    expect(control?.isActive).toBe(true);
    expect(deviceChangeListeners).toBe(0);
  });

  it('starts on Chromium’s capture when it begins behind the window', async () => {
    hidden = true;
    render(<Probe kind="work" />);
    await settle();

    expect(mockCore).not.toHaveBeenCalled();
    expect(captureRequests()).toBe(1);
  });
});

describe('a core that cannot hear the output', () => {
  it('falls back to Chromium’s capture, and tries again on the next output', async () => {
    mockCore.mockImplementation(() => Promise.reject(new Error('no helper')));
    render(<Probe kind="display" />);
    await settle();

    expect(control?.isActive).toBe(true);
    expect(captureRequests()).toBe(1);
    expect(mockCore).toHaveBeenCalledTimes(1);

    // Hiding and showing is not a reason to think the core can hear now.
    await setHidden(true);
    await setHidden(false);
    expect(mockCore).toHaveBeenCalledTimes(1);

    mockCore.mockImplementation(coreHears);
    act(() => {
      window.dispatchEvent(new CustomEvent('fluideq-output-changed'));
    });
    await settle();
    expect(mockCore).toHaveBeenCalledTimes(2);
    expect(cores).toHaveLength(1);
    expect(deviceChangeListeners).toBe(0);
  });

  it('hears through Chromium once the core loses the output', async () => {
    render(<Probe kind="display" />);
    await settle();
    expect(captureRequests()).toBe(0);

    act(() => cores[0].lose());
    await settle();

    expect(control?.isActive).toBe(true);
    expect(captureRequests()).toBe(1);
    expect(mockCore).toHaveBeenCalledTimes(1);
  });

  it('leaves the core’s capture alone when the output changes', async () => {
    render(<Probe kind="display" />);
    await settle();
    act(() => {
      window.dispatchEvent(new CustomEvent('fluideq-output-changed'));
    });
    await settle();

    // The core follows the default output by itself.
    expect(cores[0].release).not.toHaveBeenCalled();
    expect(mockCore).toHaveBeenCalledTimes(1);
  });
});
