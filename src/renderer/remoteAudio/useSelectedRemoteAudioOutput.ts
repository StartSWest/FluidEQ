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
      try {
        const sinkId = await resolveSelectedOutputSinkId(activeDeviceId);
        if (cancelled) {
          return;
        }
        outputSinkIdRef.current = sinkId;
        await mixerRef.current?.setOutput(sinkId);
      } catch {
        // The right-pane selection also becomes the Windows default output,
        // so the default alias remains safe when Chromium hides device names.
      }
    };
    followSelectedOutput().catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [activeDeviceId, mixerRef, outputSinkIdRef]);
};

export default useSelectedRemoteAudioOutput;
