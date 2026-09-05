/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>

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
import { IAudioDevice, IDeviceProfileSettings } from 'common/constants';
import { hasVirtualRouting } from 'common/virtualAudioDevices';
import {
  getAudioDevices,
  getDeviceProfileSettings,
} from '../utils/equalizerApi';
import { reportInfo, reportError } from '../utils/logger';
import { useTranslation } from '../utils/I18nContext';
import { useMirrorPlayback, type IDesiredMirror } from './useMirrorPlayback';
import { useLiveAudioCapture, useLiveAudioControl } from './LiveAudioContext';
import {
  clampMirrorVolume,
  isMirrorMode,
  MAX_MIRROR_VOLUME,
  TMirrorMode,
} from './outputMirror';

/**
 * Where the chosen mirrors live between runs.
 *
 * GUIDs, never sink ids. Chromium salts sink ids per origin and drops them
 * with site data, so a stored one can come back meaning a different speaker;
 * the GUID is what Windows and APO already agree on.
 */
const MIRROR_TARGETS_KEY = 'fluideq-mirror-target-guids';
/** Levels, keyed by the same GUIDs and for the same reason. */
const MIRROR_VOLUMES_KEY = 'fluideq-mirror-volumes';
/**
 * Which way every mirror buffers. One setting rather than one per speaker:
 * it says what is being watched or listened to, and that is true of the
 * whole room at once.
 */
const MIRROR_MODE_KEY = 'fluideq-mirror-mode';

const loadSelection = (): string[] => {
  try {
    const stored = JSON.parse(localStorage.getItem(MIRROR_TARGETS_KEY) ?? '[]');
    return Array.isArray(stored)
      ? stored.filter((guid): guid is string => typeof guid === 'string')
      : [];
  } catch {
    return [];
  }
};

const loadVolumes = (): Record<string, number> => {
  try {
    const stored = JSON.parse(localStorage.getItem(MIRROR_VOLUMES_KEY) ?? '{}');
    if (!stored || typeof stored !== 'object' || Array.isArray(stored)) {
      return {};
    }
    return Object.fromEntries(
      Object.entries(stored as Record<string, unknown>)
        .filter(([, value]) => typeof value === 'number')
        .map(([guid, value]) => [guid, clampMirrorVolume(value as number)]),
    );
  } catch {
    return {};
  }
};

/**
 * Music unless asked otherwise. A mirror nobody has configured is most often
 * a speaker in another room, where a tenth of a second is invisible and a
 * stutter is not; a screen is the case someone notices and switches for.
 */
const loadMode = (): TMirrorMode => {
  const stored = localStorage.getItem(MIRROR_MODE_KEY);
  return isMirrorMode(stored) ? stored : 'music';
};

/** One endpoint, and whether it can currently be mirrored to. */
export interface IMirrorTarget {
  device: IAudioDevice;
  match: IAudioDeviceMatch;
  /** False when it is the captured endpoint or is not active. */
  isEligible: boolean;
  /** Everything lines up and this can be switched on right now. */
  isUsable: boolean;
  /** The user has asked for this one, whether or not it can run. */
  isSelected: boolean;
  /** Audio is genuinely going to it right now. */
  isRunning: boolean;
  /** How loud this mirror plays, 0 to 1. Full unless turned down. */
  volume: number;
  /**
   * The profile attached to this endpoint, exactly as the output picker means
   * it — raw, so the caller can tell an automatic one from a named one and
   * label each the way that panel already does.
   *
   * Read-only here. Equalizer APO applies it to the endpoint itself, so the
   * mirror neither chooses it nor reproduces it; this is only so the row can
   * say which profile the speaker is already playing.
   */
  presetName: string;
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
    reportInfo('[mirror] this environment has no enumerateDevices');
    return [];
  }
  const devices = await navigator.mediaDevices.enumerateDevices();
  const outputs = devices
    .filter((device) => device.kind === 'audiooutput')
    .map((device) => ({
      deviceId: device.deviceId,
      label: device.label,
      groupId: device.groupId,
    }));

  // Logged because this is the join the whole feature rests on, and when it
  // fails it fails silently: the panel can only say "cannot reach it", which
  // covers Chromium offering nothing at all and Chromium offering names that
  // do not match Windows'. Those need opposite fixes, and nothing else in the
  // app can tell them apart afterwards.
  reportInfo(
    `[mirror] Chromium offers ${outputs.length} audio outputs: ${
      outputs
        .map((output) => `${output.deviceId.slice(0, 8)}="${output.label}"`)
        .join(' | ') || 'none'
    }`,
  );

  return outputs;
};

/**
 * Own the mirrors: which endpoints could take one, which ones are chosen, and
 * the running graphs themselves.
 *
 * Several at once, because that is the feature — one capture fanned out to as
 * many outputs as asked for. The capture is shared and read-only to all of
 * them, so the cost of another is a stream, not another `getDisplayMedia`.
 *
 * **The mirror applies no EQ, deliberately.** Equalizer APO hooks every
 * endpoint, and FluidEQ already writes a `Device:` block per assigned output —
 * so the profile for a mirrored speaker is applied to that speaker by APO, on
 * the way out, exactly as it is when you are listening on it directly. A
 * filter chain here would apply the same correction a second time, and a
 * doubled correction is doubled in dB: a 6 dB dip becomes 12, which is audible
 * as a hollow, phasey wrongness rather than as "a bit much".
 *
 */
const useOutputMirror = () => {
  const native = window.electron?.platform === 'win32';
  const { t } = useTranslation();
  const { capture } = useLiveAudioControl();
  const [devices, setDevices] = useState<IAudioDevice[]>([]);
  const [outputs, setOutputs] = useState<IMediaOutputDevice[]>([]);
  const [assignments, setAssignments] = useState<
    IDeviceProfileSettings | undefined
  >(undefined);
  const [selectedGuids, setSelectedGuids] = useState<string[]>(loadSelection);
  const [volumes, setVolumes] = useState<Record<string, number>>(loadVolumes);
  const [mode, setModeState] = useState<TMirrorMode>(loadMode);

  const [error, setError] = useState('');

  const refresh = useCallback(async () => {
    try {
      const [nextDevices, nextOutputs, nextSettings] = await Promise.all([
        getAudioDevices(),
        native ? Promise.resolve([]) : listMediaOutputs(),
        getDeviceProfileSettings(),
      ]);
      setDevices(nextDevices);
      setOutputs(nextOutputs);
      setAssignments(nextSettings);
    } catch {
      // A failed enumeration is not worth an error banner: the list simply
      // stays as it was, and the next device change refreshes it again.
    }
  }, [native]);

  useEffect(() => {
    refresh();
    window.addEventListener('fluideq-output-changed', refresh);
    window.addEventListener('fluideq-presets-changed', refresh);
    if (!navigator.mediaDevices?.addEventListener) {
      return () => {
        window.removeEventListener('fluideq-output-changed', refresh);
        window.removeEventListener('fluideq-presets-changed', refresh);
      };
    }
    // Plugging a headset in changes both halves at once, and a stale list is
    // how a mirror ends up pointed at something that is no longer there.
    navigator.mediaDevices.addEventListener('devicechange', refresh);
    return () => {
      navigator.mediaDevices.removeEventListener('devicechange', refresh);
      window.removeEventListener('fluideq-output-changed', refresh);
      window.removeEventListener('fluideq-presets-changed', refresh);
    };
  }, [refresh]);

  /** The endpoint the loopback is capturing, which can never be a target. */
  const captureSourceGuid = useMemo(
    () => devices.find((device) => device.isDefault)?.guid,
    [devices],
  );

  // Switching the output you listen on switches every mirror off.
  //
  // What a mirror means is "send what I am hearing there as well", and moving
  // the primary changes what that sentence refers to entirely — the room the
  // sound was going to may now be the room you are in, and the device you were
  // mirroring may be the one you just moved to. Rather than guess which of
  // those the user meant, the mirrors stop and wait to be switched on again.
  //
  // Only on a genuine change between two known endpoints. The first reading
  // arrives as undefined and then as a GUID, which is discovery rather than a
  // switch, and clearing on it would throw away the selection restored from
  // the last session every time the app started.
  const lastCaptureSourceRef = useRef<string | undefined>(undefined);
  useEffect(() => {
    const previous = lastCaptureSourceRef.current;
    lastCaptureSourceRef.current = captureSourceGuid;
    if (!previous || !captureSourceGuid || previous === captureSourceGuid) {
      return;
    }
    setSelectedGuids((current) => {
      if (current.length === 0) {
        return current;
      }
      localStorage.setItem(MIRROR_TARGETS_KEY, JSON.stringify([]));
      return [];
    });
  }, [captureSourceGuid]);

  // Windows addresses the endpoint directly; Chromium's salted IDs and device
  // names are only needed by the non-Windows fallback.
  const desired = useMemo<IDesiredMirror[]>(() => {
    const matches = native ? [] : matchAudioDevices(devices, outputs);
    return devices.flatMap((device, index) => {
      const sinkId = native ? device.guid : matches[index]?.sinkId;
      return selectedGuids.includes(device.guid) &&
        isEligibleMirrorTarget(device, captureSourceGuid) &&
        sinkId
        ? [{ guid: device.guid, sinkId, mode }]
        : [];
    });
  }, [native, devices, outputs, selectedGuids, captureSourceGuid, mode]);
  const onMirrorError = useCallback(
    (mirrorError: unknown) => {
      reportError('Second output failed', mirrorError);
      setError(t('extraOutput.unmatched'));
    },
    [t],
  );
  const runningGuids = useMirrorPlayback(
    desired,
    volumes,
    native ? undefined : capture,
    native,
    captureSourceGuid,
    onMirrorError,
  );
  useLiveAudioCapture(!native && selectedGuids.length > 0, 'work');

  const targets = useMemo<IMirrorTarget[]>(() => {
    const matches = matchAudioDevices(devices, outputs);
    return devices.map((device, index) => {
      const match: IAudioDeviceMatch = native
        ? {
            guid: device.guid,
            name: device.name,
            status: DeviceMatchEnum.MATCHED,
            sinkId: device.guid,
          }
        : matches[index];
      const isEligible = isEligibleMirrorTarget(device, captureSourceGuid);
      return {
        device,
        match,
        isEligible,
        isUsable: isEligible && match.status === DeviceMatchEnum.MATCHED,
        isSelected: selectedGuids.includes(device.guid),
        isRunning: runningGuids.includes(device.guid),
        presetName: assignments?.assignments[device.id]?.presetName ?? '',
        volume: volumes[device.guid] ?? MAX_MIRROR_VOLUME,
      };
    });
  }, [
    assignments,
    native,
    captureSourceGuid,
    devices,
    outputs,
    runningGuids,
    selectedGuids,
    volumes,
  ]);

  const isVirtualRoutingAvailable = useMemo(
    () => hasVirtualRouting(devices),
    [devices],
  );

  const selectedTargets = useMemo(
    () => targets.filter((target) => target.isSelected),
    [targets],
  );

  const toggleTarget = useCallback((guid: string) => {
    setError('');
    setSelectedGuids((current) => {
      const next = current.includes(guid)
        ? current.filter((candidate) => candidate !== guid)
        : [...current, guid];
      localStorage.setItem(MIRROR_TARGETS_KEY, JSON.stringify(next));
      return next;
    });
  }, []);

  const setTargetVolume = useCallback((guid: string, value: number) => {
    setVolumes((current) => {
      const next = { ...current, [guid]: clampMirrorVolume(value) };
      localStorage.setItem(MIRROR_VOLUMES_KEY, JSON.stringify(next));
      return next;
    });
  }, []);

  const setMode = useCallback((next: TMirrorMode) => {
    setError('');
    localStorage.setItem(MIRROR_MODE_KEY, next);
    setModeState(next);
  }, []);

  return {
    error,
    isVirtualRoutingAvailable,
    /** Game/Video keeps the sound close to the picture; Music never stutters. */
    mode,
    setMode,
    setTargetVolume,
    /** True while audio is genuinely going somewhere extra. */
    isMirroring: runningGuids.length > 0,
    mirroringCount: runningGuids.length,
    refresh,
    selectedTargets,
    targets,
    toggleTarget,
  };
};

export default useOutputMirror;
