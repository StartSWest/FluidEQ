/* FluidEQ — GPL-3.0-or-later */
import { subscribeAudioDevices } from '../utils/equalizerApi';

/** Chromium may omit devicechange when Linux recreates the engine's virtual
 * endpoints, including when their device IDs stay the same. The engine's
 * native output notification is the event that makes those streams reopen. */
const subscribeLinuxShareRecovery = (recover: () => void): (() => void) => {
  if (window.electron?.platform !== 'linux') {
    return () => undefined;
  }
  let active = true;
  const stop = subscribeAudioDevices((reading) => {
    reading.then(
      () => {
        if (active) {
          recover();
        }
        return undefined;
      },
      () => undefined,
    );
  });
  return () => {
    active = false;
    stop();
  };
};

export default subscribeLinuxShareRecovery;
