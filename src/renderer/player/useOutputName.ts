/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { useEffect, useState } from 'react';
import { readKnownAudioDevices } from '../utils/equalizerApi';
import { reportError } from '../utils/logger';

/**
 * The name Windows gives the output being played through: the path's output
 * node says it in its tooltip, the amp's foot in words. Read again whenever
 * the output changes; an answer to an older request never replaces a newer
 * one.
 */
const useOutputName = () => {
  const [name, setName] = useState<string>();
  useEffect(() => {
    let isLive = true;
    let request = 0;
    const read = () => {
      request += 1;
      const asked = request;
      readKnownAudioDevices()
        .then((devices) => {
          if (isLive && asked === request) {
            setName(devices.find((device) => device.isDefault)?.name);
          }
          return undefined;
        })
        .catch((error: unknown) =>
          reportError('The output list could not be read for the amp', error),
        );
    };
    read();
    window.addEventListener('fluideq-output-changed', read);
    return () => {
      isLive = false;
      window.removeEventListener('fluideq-output-changed', read);
    };
  }, []);
  return name;
};

export default useOutputName;
