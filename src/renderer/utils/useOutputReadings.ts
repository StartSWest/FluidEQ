/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { useEffect } from 'react';
import type { IAudioDevice } from 'common/constants';
import { subscribeAudioDevices } from './equalizerApi';

/**
 * When the output panel reads the outputs: on mount, whenever main pushes a
 * list it read because Windows said the outputs moved, and whenever the
 * window is come back to.
 *
 * It used to read them every three seconds while the window was on screen,
 * because nothing told it when somebody plugged in headphones — each read an
 * IPC round trip and a PowerShell enumeration of every endpoint, twenty a
 * minute for the life of the window — and paused while the window was
 * hidden, so main, which only learned of a new output through that read,
 * kept playing the old output's profile until the window was opened. Windows
 * does say, and now main hears it (`outputWatch.ts`), follows the change
 * whether or not the window is showing, and pushes the list it read; the
 * panel takes that list as it is, with no second enumeration.
 *
 * Coming back to the window still reads, because a change made in Sound
 * settings while it was away is exactly what might not have been heard: the
 * page becoming visible and the window taking focus, which a restore from the
 * tray does both of, one right after the other. The second joins the read
 * the first started rather than queuing another — both are the same return,
 * and the read went out after it.
 *
 * Off Windows nothing pushes, and these events are all there is.
 */
const useOutputReadings = (
  refresh: () => Promise<unknown>,
  show: (reading: Promise<IAudioDevice[]>) => Promise<boolean>,
) => {
  useEffect(() => {
    let returning: Promise<unknown> | undefined;
    const read = () => {
      if (returning) {
        return;
      }
      returning = refresh().finally(() => {
        returning = undefined;
      });
    };
    const onVisibilityChange = () => {
      if (!document.hidden) {
        read();
      }
    };
    // The window's own focus only: focus is not heard here from a control
    // inside it, but a target check costs nothing and says so.
    const onFocus = (event: FocusEvent) => {
      if (event.target === window) {
        read();
      }
    };

    read();
    document.addEventListener('visibilitychange', onVisibilityChange);
    window.addEventListener('focus', onFocus);
    const take = async (reading: Promise<IAudioDevice[]>) => {
      // Main switched output but could not adopt the external EQ, and said so
      // instead of the list; the list is still owed, and asking is how the
      // window got it before (the next poll did).
      if (!(await show(reading))) {
        await refresh();
      }
    };
    const stopListening = subscribeAudioDevices((reading) => {
      take(reading);
    });
    return () => {
      document.removeEventListener('visibilitychange', onVisibilityChange);
      window.removeEventListener('focus', onFocus);
      stopListening();
    };
  }, [refresh, show]);
};

export default useOutputReadings;
