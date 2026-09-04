/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { RefObject, useEffect } from 'react';
import type { IPcmMixer } from './pcmMixer';
import resolveSelectedOutputSinkId from './selectedOutput';

const useSelectedRemoteAudioOutput = (
  activeDeviceId: string,
  mixerRef: RefObject<IPcmMixer | undefined>,
  outputSinkIdRef: RefObject<string>,
) => {
  useEffect(() => {
    let cancelled = false;
    const followSelectedOutput = async () => {
      let sinkId = 'default';
      try {
        sinkId = await resolveSelectedOutputSinkId(activeDeviceId);
      } catch {
        // The default alias is the only safe fallback when labels are hidden.
      }
      if (cancelled) {
        return;
      }
      const mixer = mixerRef.current;
      if (!mixer) {
        outputSinkIdRef.current = sinkId;
        return;
      }
      try {
        await mixer.setOutput(sinkId);
        if (!cancelled) {
          outputSinkIdRef.current = sinkId;
        }
      } catch {
        if (cancelled || sinkId === 'default') {
          return;
        }
        try {
          await mixer.setOutput('default');
          if (!cancelled) {
            outputSinkIdRef.current = 'default';
          }
        } catch {
          // Keep the last confirmed output; the audio stream stays alive.
        }
      }
    };
    followSelectedOutput().catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [activeDeviceId, mixerRef, outputSinkIdRef]);
};

export default useSelectedRemoteAudioOutput;
