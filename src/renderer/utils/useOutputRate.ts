/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { useEffect, useState } from 'react';
import { getAudioDevices } from './equalizerApi';
import { reportError } from './logger';

/**
 * The rate Windows runs the output being listened to at: its shared-mode
 * format, the "Default Format" in Sound settings, read off the output list.
 * That is the rate either engine processes the output at, which is what the
 * equaliser's title shows beside its name as the DSP page's does (Ivan,
 * 2026-09-22: "put the Hz also in the main EQ similar to DSP, the real output
 * thing"). Undefined until the list has answered, or for an output Windows
 * would not describe.
 */
const useOutputRate = (): number | undefined => {
  const [rate, setRate] = useState<number>();

  useEffect(() => {
    let isLive = true;
    let asked = 0;
    const read = () => {
      asked += 1;
      const request = asked;
      // Called inside the chain, so a bridge that throws rather than rejects
      // costs the rate and not the page it sits on: the effect that threw
      // would have taken the whole equaliser down with it.
      Promise.resolve()
        .then(() => getAudioDevices())
        .then((devices) => {
          if (isLive && request === asked) {
            const found = devices.find(
              (device) => device.isDefault,
            )?.sampleRate;
            setRate(found !== undefined && found > 0 ? found : undefined);
          }
          return undefined;
        })
        .catch((error) =>
          reportError(
            'The output rate could not be read for the EQ page',
            error,
          ),
        );
    };
    read();
    // A change of output is announced (`DeviceProfiles`). A format changed in
    // Sound settings is not, and it is changed away from this window, so the
    // list is read again whenever the window is come back to.
    window.addEventListener('fluideq-output-changed', read);
    window.addEventListener('focus', read);
    return () => {
      isLive = false;
      window.removeEventListener('fluideq-output-changed', read);
      window.removeEventListener('focus', read);
    };
  }, []);

  return rate;
};

export default useOutputRate;
