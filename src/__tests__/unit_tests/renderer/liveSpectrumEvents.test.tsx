/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * The live capture waiting on events, never on timers.
 *
 * Every wait the capture had was a duration: 450 ms after an output switch,
 * two and a half seconds of a muted track, a doubling retry, a two-minute
 * wall-clock backstop on a measurement. Each is now the event that says the
 * thing is ready — a device changing, the output changing, the window being
 * come back to, the track ending, the audio clock's own ticks — and each case
 * here has a positive control beside its null, so "nothing happened" is told
 * apart from "nothing could happen". The fake timers are only there to prove
 * nothing is left on them.
 */

import { act, render } from '@testing-library/react';
import { useEffect } from 'react';
import useLiveOutputSpectrum from 'renderer/graph/useLiveOutputSpectrum';
import {
  MEASUREMENT_AUDIO_LIMIT_MS,
  UPDATE_INTERVAL_MS,
} from 'renderer/graph/liveSpectrumFrames';
import {
  captureRequests,
  contexts,
  fakeDevices,
  installFakeCapture,
  signal,
  tickAudio,
  tracks,
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

let control: ReturnType<typeof useLiveOutputSpectrum>['control'] | undefined;

function Probe() {
  const spectrum = useLiveOutputSpectrum();
  control = spectrum.control;
  const { claim } = spectrum.control;
  useEffect(() => claim('display'), [claim]);
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

const during = async (event: () => void) => {
  act(event);
  await settle();
};

beforeEach(async () => {
  // Microtasks left real, so the count is of timers alone.
  jest.useFakeTimers({ doNotFake: ['queueMicrotask', 'nextTick'] });
  installFakeCapture();
  control = undefined;
});

afterEach(() => {
  uninstallFakeCapture();
  jest.useRealTimers();
});

const startCapture = async () => {
  render(<Probe />);
  await settle();
  if (!control?.isActive) {
    throw new Error('The stand-in capture did not start.');
  }
};

describe('a measurement somebody is waiting on', () => {
  it('ends at its limit of audio heard, however little wall time passed', async () => {
    await startCapture();
    signal.amplitude = 0.5;
    const running = control?.captureBalanceProfile();
    const outcome = running?.then(
      () => 'resolved',
      (error: Error) => error.message,
    );
    // Sound on every tick, but the wall clock never moves, so not one frame
    // buys listened time and nothing counts as silence: only the limit ends
    // it. The two-minute timer this replaces never fired here at all.
    const tickMs = 1000;
    const ticks = MEASUREMENT_AUDIO_LIMIT_MS / tickMs;
    for (let step = 1; step < ticks; step += 1) {
      act(() => tickAudio(tickMs));
    }
    await settle();
    let settled = false;
    outcome?.then(() => {
      settled = true;
      return settled;
    });
    await settle();
    // POSITIVE CONTROL: a tick short of the limit, it is still listening.
    expect(settled).toBe(false);
    expect(jest.getTimerCount()).toBe(0);

    act(() => tickAudio(tickMs));
    await settle();
    await expect(outcome).resolves.toBe(
      'The measurement timed out. Try again.',
    );
  });

  it('holds a continuous session to no limit', async () => {
    await startCapture();
    signal.amplitude = 0.5;
    const abort = new AbortController();
    const running = control?.captureBalanceProfile({
      isContinuous: true,
      signal: abort.signal,
    });
    let settled = false;
    running?.then(
      () => {
        settled = true;
        return settled;
      },
      () => {
        settled = true;
      },
    );
    for (let step = 0; step < 200; step += 1) {
      act(() => tickAudio(1000));
    }
    await settle();
    expect(settled).toBe(false);
    act(() => abort.abort());
    await expect(running).rejects.toThrow();
  });
});

describe('a start that failed', () => {
  it('waits for a device change with no timer, and tries again on it', async () => {
    fakeDevices().isRefusing = true;
    render(<Probe />);
    await settle();
    expect(control?.isActive).toBe(false);
    const asked = captureRequests();
    // Nothing left on a timer — the doubling retry is gone — and nothing
    // tried again with nothing having changed.
    expect(jest.getTimerCount()).toBe(0);
    act(() => {
      jest.advanceTimersByTime(60_000);
    });
    await settle();
    expect(captureRequests()).toBe(asked);

    fakeDevices().isRefusing = false;
    await during(() => fakeDevices().changeDevices());
    expect(captureRequests()).toBeGreaterThan(asked);
    expect(control?.isActive).toBe(true);
  });

  it('tries again when the window is come back to, or the output changes', async () => {
    fakeDevices().isRefusing = true;
    render(<Probe />);
    await settle();
    const asked = captureRequests();

    // A control taking focus is not the window being come back to.
    const button = document.createElement('button');
    document.body.appendChild(button);
    await during(() => button.focus());
    expect(captureRequests()).toBe(asked);

    await during(() => window.dispatchEvent(new FocusEvent('focus')));
    const afterFocus = captureRequests();
    expect(afterFocus).toBeGreaterThan(asked);

    fakeDevices().isRefusing = false;
    await during(() =>
      window.dispatchEvent(new CustomEvent('fluideq-output-changed')),
    );
    expect(captureRequests()).toBeGreaterThan(afterFocus);
    expect(control?.isActive).toBe(true);
    button.remove();
  });
});

describe('a running capture', () => {
  it('is taken again at once when the output changes', async () => {
    await startCapture();
    const asked = captureRequests();
    await during(() =>
      window.dispatchEvent(new CustomEvent('fluideq-output-changed')),
    );
    // Not 450 ms later: now, with nothing on a timer.
    expect(captureRequests()).toBe(asked + 1);
    expect(tracks[0].stop).toHaveBeenCalled();
    expect(control?.isActive).toBe(true);
    expect(jest.getTimerCount()).toBe(0);
  });

  it('follows Windows to a new default output, and stays for any other device', async () => {
    await startCapture();
    const asked = captureRequests();

    // NULL: a device came or went, the output did not move.
    await during(() => fakeDevices().changeDevices());
    expect(captureRequests()).toBe(asked);

    // POSITIVE CONTROL: the default output is somewhere else now.
    fakeDevices().defaultOutput = {
      groupId: 'headset',
      label: 'Default - Headset',
    };
    await during(() => fakeDevices().changeDevices());
    expect(captureRequests()).toBe(asked + 1);
    expect(control?.isActive).toBe(true);
  });

  it('is taken again when a device changes under a muted track, and not for a mute alone', async () => {
    await startCapture();
    const asked = captureRequests();

    // NULL: a mute is an ordinary gap until something says otherwise.
    await during(() => tracks[0].mute());
    act(() => {
      jest.advanceTimersByTime(60_000);
    });
    await settle();
    expect(captureRequests()).toBe(asked);

    // POSITIVE CONTROL: a device changed while it was muted.
    await during(() => fakeDevices().changeDevices());
    expect(captureRequests()).toBe(asked + 1);
    expect(control?.isActive).toBe(true);
  });

  it('is taken again when it mutes after a device change it has heard nothing since', async () => {
    await startCapture();
    const asked = captureRequests();

    // NULL: sound came through after the device change, so the change was
    // somebody else's device and this mute is a pause.
    await during(() => fakeDevices().changeDevices());
    signal.amplitude = 0.5;
    act(() => tickAudio(UPDATE_INTERVAL_MS));
    await during(() => tracks[0].mute());
    expect(captureRequests()).toBe(asked);

    // POSITIVE CONTROL: a device change, then silence, then the mute.
    tracks[0].unmute();
    signal.amplitude = 0;
    await during(() => fakeDevices().changeDevices());
    act(() => tickAudio(UPDATE_INTERVAL_MS));
    await during(() => tracks[0].mute());
    expect(captureRequests()).toBe(asked + 1);
    expect(control?.isActive).toBe(true);
  });

  it('starts again when its track ends, with nothing on a timer', async () => {
    await startCapture();
    const asked = captureRequests();
    await during(() => tracks[0].end());
    expect(captureRequests()).toBe(asked + 1);
    expect(control?.isActive).toBe(true);
    expect(jest.getTimerCount()).toBe(0);
  });

  it('starts again when its context will not resume', async () => {
    await startCapture();
    const asked = captureRequests();
    const [context] = contexts;
    context.resumeResult = () =>
      Promise.reject(new DOMException('gone', 'InvalidStateError'));
    await during(() => context.becomes('suspended'));
    expect(captureRequests()).toBe(asked + 1);
    expect(contexts).toHaveLength(2);
    expect(control?.isActive).toBe(true);
  });
});
