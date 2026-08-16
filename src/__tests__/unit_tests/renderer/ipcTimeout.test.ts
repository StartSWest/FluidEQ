/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU General Public License as published by
the Free Software Foundation, either version 3 of the License, or
(at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
GNU General Public License for more details.

You should have received a copy of the GNU General Public License
along with this program.  If not, see <https://www.gnu.org/licenses/>.
*/

import { getMainPreAmp } from 'renderer/utils/equalizerApi';

/** Replies the test fires by hand, so the timing is entirely ours. */
let listener: ((arg: unknown) => void) | undefined;
const unsubscribe = jest.fn();
const sendMessage = jest.fn();

const installBridge = () => {
  listener = undefined;
  unsubscribe.mockClear();
  sendMessage.mockClear();
  window.electron = {
    ipcRenderer: {
      sendMessage,
      once: (_channel: string, handler: (arg: unknown) => void) => {
        listener = handler;
        return unsubscribe;
      },
    },
  } as unknown as typeof window.electron;
};

/**
 * The renderer waits ten seconds for the main process to answer, and measures
 * that wait with `setTimeout` — a wall-clock deadline.
 *
 * That is fine until the machine sleeps. Chromium fires timers whose deadline
 * passed during suspend the instant it resumes, so a request in flight when the
 * lid closed came back as "Timeout waiting for a response" for a main process
 * that had never been given a chance to reply. The user saw exactly that, on
 * wake, with the window frozen behind it.
 */
describe('waiting for the main process across a sleep', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    installBridge();
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  it('rejects when the reply is genuinely missing', async () => {
    const pending = getMainPreAmp();
    const settled = jest.fn();
    pending.catch(settled);

    // Ten seconds of real waiting: the clock and the timer agree.
    jest.advanceTimersByTime(10_000);
    await Promise.resolve();

    expect(settled).toHaveBeenCalled();
    expect(String(settled.mock.calls[0][0])).toContain('Timeout');
  });

  it('does not reject when the wait was suspended, not slow', async () => {
    const pending = getMainPreAmp();
    const rejected = jest.fn();
    pending.catch(rejected);

    // The machine sleeps for an hour. The timer's deadline passed while
    // nothing was running, so it fires the moment we wake — but the wall clock
    // shows an hour where ten seconds of waiting should be, which is the tell.
    jest.spyOn(Date, 'now').mockReturnValue(Date.now() + 60 * 60 * 1000);
    jest.advanceTimersByTime(10_000);
    await Promise.resolve();

    expect(rejected).not.toHaveBeenCalled();
    expect(unsubscribe).not.toHaveBeenCalled();

    // And the reply that was always coming still resolves it.
    listener?.({ result: -6 });
    await expect(pending).resolves.toBe(-6);
  });

  it('still rejects if nothing answers after the machine is awake again', async () => {
    const pending = getMainPreAmp();
    const rejected = jest.fn();
    pending.catch(rejected);

    const wokeAt = Date.now() + 60 * 60 * 1000;
    jest.spyOn(Date, 'now').mockReturnValue(wokeAt);
    jest.advanceTimersByTime(10_000);
    await Promise.resolve();
    expect(rejected).not.toHaveBeenCalled();

    // A second full window, this time with the clock behaving. The process is
    // awake now, so a reply that has still not arrived is genuinely missing and
    // the forgiveness is not extended twice.
    jest.spyOn(Date, 'now').mockReturnValue(wokeAt + 10_000);
    jest.advanceTimersByTime(10_000);
    await Promise.resolve();

    expect(rejected).toHaveBeenCalled();
    expect(String(rejected.mock.calls[0][0])).toContain('Timeout');
    expect(unsubscribe).toHaveBeenCalled();
  });
});
