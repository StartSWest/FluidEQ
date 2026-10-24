/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { useEffect, useState } from 'react';
import { subscribeAudioDevices } from '../utils/equalizerApi';

/**
 * The FluidEQ Engine for Linux's two Share Audio endpoints, as Chromium
 * lists them: "FluidEQ Share In", the output other computers' sound plays
 * into, and "FluidEQ Send", the input this computer's sound is sent from
 * (`native/linux/engine/pw_share.cpp`, `pulse_share.cpp`).
 *
 * With both, a link runs both ways on Linux as it does on Windows: what goes
 * out is what this computer played, untouched, and what comes in is mixed in
 * after that and EQ'd here, so it is never sent back. Without them — no
 * engine, or one from before them — a link runs one way, as it always did
 * off Windows. Chromium's Linux audio service can omit `devicechange` when
 * the engine publishes these virtual devices, so main's native output
 * notification also triggers discovery after startup or an engine restart.
 */
export const SHARE_IN_LABEL = 'FluidEQ Share In';
export const SEND_LABEL = 'FluidEQ Send';

export interface ILinuxShareDevices {
  shareOutputId?: string;
  sendInputId?: string;
}

const readShareDevices = async (): Promise<ILinuxShareDevices> => {
  const devices = await navigator.mediaDevices.enumerateDevices();
  return {
    shareOutputId: devices.find(
      (device) =>
        device.kind === 'audiooutput' && device.label === SHARE_IN_LABEL,
    )?.deviceId,
    sendInputId: devices.find(
      (device) => device.kind === 'audioinput' && device.label === SEND_LABEL,
    )?.deviceId,
  };
};

const useLinuxShareDevices = (): ILinuxShareDevices => {
  const [devices, setDevices] = useState<ILinuxShareDevices>({});
  useEffect(() => {
    const media = navigator.mediaDevices;
    if (window.electron?.platform !== 'linux' || !media?.enumerateDevices) {
      return undefined;
    }
    let cancelled = false;
    const read = () => {
      readShareDevices()
        .then((next) => {
          if (!cancelled) {
            setDevices((current) =>
              current.shareOutputId === next.shareOutputId &&
              current.sendInputId === next.sendInputId
                ? current
                : next,
            );
          }
          return undefined;
        })
        .catch(() => undefined);
    };
    read();
    media.addEventListener('devicechange', read);
    const unsubscribe = subscribeAudioDevices((reading) => {
      reading.then(read, read);
    });
    return () => {
      cancelled = true;
      unsubscribe();
      media.removeEventListener('devicechange', read);
    };
  }, []);
  return devices;
};

export default useLinuxShareDevices;
