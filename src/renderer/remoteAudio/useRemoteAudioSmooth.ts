/* FluidEQ — GPL-3.0-or-later */
import { useCallback, useEffect, useState } from 'react';

/**
 * Share Audio's Smooth playback switch: every link this computer is on plays
 * with a cushion that rides out Wi-Fi stalls, about half a second later and
 * never cut. Kept by main, which tells the other computers.
 */
const useRemoteAudioSmooth = (): readonly [boolean, (on: boolean) => void] => {
  const bridge = window.electron?.ipcRenderer;
  const [smooth, setSmoothState] = useState(false);
  useEffect(() => {
    let current = true;
    bridge
      ?.getRemoteAudioSmooth?.()
      .then((on) => {
        if (current) {
          setSmoothState(on === true);
        }
        return undefined;
      })
      .catch(() => undefined);
    return () => {
      current = false;
    };
  }, [bridge]);
  const setSmooth = useCallback(
    (on: boolean) => {
      setSmoothState(on);
      // Refused, the switch goes back to what is still playing.
      bridge?.setRemoteAudioSmooth?.(on).catch(() => setSmoothState(!on));
    },
    [bridge],
  );
  return [smooth, setSmooth] as const;
};

export default useRemoteAudioSmooth;
