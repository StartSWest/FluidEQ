/* FluidEQ — GPL-3.0-or-later */

import log from 'electron-log';

type TListener = () => void;

const listeners = new Set<TListener>();

/**
 * Windows audio was restarted by the engine's setup helper and is running
 * again.
 *
 * A restart of Windows audio ends every audio stream on the machine, not only
 * the ones the engine processes: Share Audio's capture and its player die
 * with it, and nothing told them to open again. Every engine switch restarts
 * Windows audio, so Share Audio fell silent at each one until it was turned
 * off and on (Ivan, 2026-10-25). The helper returns only once both services
 * are running again (`wait_running` in its `services.cpp`), so its exit is
 * the moment a stream can be opened again, not a guess at it.
 */
export const onWindowsAudioRestarted = (listener: TListener): (() => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};

export const windowsAudioRestarted = (): void => {
  [...listeners].forEach((listener) => {
    try {
      listener();
    } catch (error) {
      log.error('Could not reopen audio after Windows audio restarted', error);
    }
  });
};
