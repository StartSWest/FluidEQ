/*
<AQUA: System-wide parametric audio equalizer interface>
Copyright (C) <2023>  <AQUA Dev Team>
Copyright (C) <2026>  <FluidEQ multiple-output contributors>

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

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  DeviceMatchEnum,
  IAudioDeviceMatch,
  IMediaOutputDevice,
  isEligibleMirrorTarget,
  matchAudioDevices,
} from 'common/audioDeviceBridge';
import { IAudioDevice } from 'common/constants';
import { hasVirtualRouting } from 'common/virtualAudioDevices';
import { getAudioDevices } from '../utils/equalizerApi';
import { useLiveAudioControl } from './LiveAudioContext';
import { IOutputMirror, startOutputMirror } from './outputMirror';

/** One endpoint, and whether it can currently be mirrored to. */
export interface IMirrorTarget {
  device: IAudioDevice;
  match: IAudioDeviceMatch;
  /** False when it is the captured endpoint or is not active. */
  isEligible: boolean;
  /** Everything lines up and this can be switched on right now. */
  isUsable: boolean;
}

/**
 * Read the outputs Chromium is willing to talk about.
 *
 * Separated so the absence of `enumerateDevices` — jsdom, and any preview
 * environment — is one quiet empty list rather than an exception thrown
 * through a render.
 */
const listMediaOutputs = async (): Promise<IMediaOutputDevice[]> => {
  if (!navigator.mediaDevices?.enumerateDevices) {
    return [];
  }
  const devices = await navigator.mediaDevices.enumerateDevices();
  return devices
    .filter((device) => device.kind === 'audiooutput')
    .map((device) => ({
      deviceId: device.deviceId,
      label: device.label,
      groupId: device.groupId,
    }));
};

/**
 * Own the mirror: which endpoints could take it, which one is chosen, and the
 * running graph itself.
 *
 * The chosen target is held as a **GUID**, never a sink id, and re-resolved
 * whenever the device list or the capture changes. Chromium's sink ids are
 * salted per origin and reset with site data, so a stored one can quietly come
 * back meaning a different speaker — see `resolveMirrorSinkId`.
 */
const useOutputMirror = () => {
  const { capture } = useLiveAudioControl();
  const [devices, setDevices] = useState<IAudioDevice[]>([]);
  const [outputs, setOutputs] = useState<IMediaOutputDevice[]>([]);
  const [selectedGuid, setSelectedGuid] = useState<string | undefined>(
    undefined,
  );
  const [error, setError] = useState('');
  const mirrorRef = useRef<IOutputMirror | undefined>(undefined);

  const refresh = useCallback(async () => {
    try {
      const [nextDevices, nextOutputs] = await Promise.all([
        getAudioDevices(),
        listMediaOutputs(),
      ]);
      setDevices(nextDevices);
      setOutputs(nextOutputs);
    } catch {
      // A failed enumeration is not worth an error banner: the list simply
      // stays as it was, and the next device change refreshes it again.
    }
  }, []);

  useEffect(() => {
    refresh();
    if (!navigator.mediaDevices?.addEventListener) {
      return undefined;
    }
    // Plugging a headset in changes both halves at once, and a stale list is
    // how a mirror ends up pointed at something that is no longer there.
    navigator.mediaDevices.addEventListener('devicechange', refresh);
    return () =>
      navigator.mediaDevices.removeEventListener('devicechange', refresh);
  }, [refresh]);

  /** The endpoint the loopback is capturing, which can never be a target. */
  const captureSourceGuid = useMemo(
    () => devices.find((device) => device.isDefault)?.guid,
    [devices],
  );

  const targets = useMemo<IMirrorTarget[]>(() => {
    const matches = matchAudioDevices(devices, outputs);
    return devices.map((device, index) => {
      const match = matches[index];
      const isEligible = isEligibleMirrorTarget(device, captureSourceGuid);
      return {
        device,
        match,
        isEligible,
        isUsable: isEligible && match.status === DeviceMatchEnum.MATCHED,
      };
    });
  }, [captureSourceGuid, devices, outputs]);

  const isVirtualRoutingAvailable = useMemo(
    () => hasVirtualRouting(devices),
    [devices],
  );

  const active = useMemo(
    () => targets.find((target) => target.device.guid === selectedGuid),
    [selectedGuid, targets],
  );

  // One effect owns the running graph, keyed on the sink actually in use and
  // the capture it hangs off. Either changing tears the old one down first —
  // two mirrors on one capture would play the same audio twice into the same
  // speaker, slightly apart, which sounds like a fault rather than a feature.
  const sinkId = active?.isUsable ? active.match.sinkId : undefined;
  useEffect(() => {
    if (!capture || !sinkId) {
      return undefined;
    }
    let isCancelled = false;
    setError('');
    startOutputMirror({
      context: capture.context,
      source: capture.source,
      sinkId,
    })
      .then((mirror) => {
        if (isCancelled) {
          // The effect was torn down while the sink was being selected.
          mirror.stop();
          return mirror;
        }
        mirrorRef.current = mirror;
        return mirror;
      })
      .catch((mirrorError: unknown) => {
        if (!isCancelled) {
          setError(
            mirrorError instanceof Error
              ? mirrorError.message
              : 'The second output could not be started.',
          );
        }
      });

    return () => {
      isCancelled = true;
      mirrorRef.current?.stop();
      mirrorRef.current = undefined;
    };
  }, [capture, sinkId]);

  const selectTarget = useCallback((guid: string | undefined) => {
    setError('');
    setSelectedGuid(guid);
  }, []);

  return {
    error,
    isVirtualRoutingAvailable,
    /** Present and chosen, whether or not it is currently able to run. */
    selected: active,
    /** True only while audio is genuinely going somewhere. */
    isMirroring: Boolean(capture && sinkId),
    refresh,
    selectTarget,
    targets,
  };
};

export default useOutputMirror;
