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
import { reportInfo } from '../utils/logger';
import { useLiveAudioControl } from './LiveAudioContext';
import {
  clampMirrorVolume,
  IOutputMirror,
  MAX_MIRROR_VOLUME,
  startOutputMirror,
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

/** A mirror that should be running. */
interface IDesiredMirror {
  guid: string;
  sinkId: string;
}

/** A mirror that is running, kept so the reconciler can spot a change. */
interface IRunningMirror {
  sinkId: string;
  mirror: IOutputMirror;
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
 * What the capture still carries is the *primary* device's correction, baked
 * in before FluidEQ ever sees it. That is the one real defect left in this
 * path, and the fix if it proves audible is to apply the inverse of the
 * primary's chain — not to re-apply the target's.
 */
const useOutputMirror = () => {
  const { capture } = useLiveAudioControl();
  const [devices, setDevices] = useState<IAudioDevice[]>([]);
  const [outputs, setOutputs] = useState<IMediaOutputDevice[]>([]);
  const [assignments, setAssignments] = useState<
    IDeviceProfileSettings | undefined
  >(undefined);
  const [selectedGuids, setSelectedGuids] = useState<string[]>(loadSelection);
  const [volumes, setVolumes] = useState<Record<string, number>>(loadVolumes);
  const [runningGuids, setRunningGuids] = useState<string[]>([]);
  const [error, setError] = useState('');
  const runningRef = useRef(new Map<string, IRunningMirror>());
  /** Starts in flight, so one effect run cannot launch the same sink twice. */
  const pendingRef = useRef(new Set<string>());

  const refresh = useCallback(async () => {
    try {
      const [nextDevices, nextOutputs, nextSettings] = await Promise.all([
        getAudioDevices(),
        listMediaOutputs(),
        getDeviceProfileSettings(),
      ]);
      setDevices(nextDevices);
      setOutputs(nextOutputs);
      setAssignments(nextSettings);
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
        isSelected: selectedGuids.includes(device.guid),
        isRunning: runningGuids.includes(device.guid),
        presetName: assignments?.assignments[device.id]?.presetName ?? '',
        volume: volumes[device.guid] ?? MAX_MIRROR_VOLUME,
      };
    });
  }, [
    assignments,
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

  const desired = useMemo<IDesiredMirror[]>(
    () =>
      selectedTargets.flatMap((target) =>
        target.isUsable && target.match.sinkId
          ? [{ guid: target.device.guid, sinkId: target.match.sinkId }]
          : [],
      ),
    [selectedTargets],
  );
  const desiredRef = useRef(desired);
  desiredRef.current = desired;
  // Read by the reconciler when it starts a mirror, but deliberately not a
  // dependency of it: a level is not a reason to tear a stream down and build
  // another, and doing so would put a gap in the audio every time the slider
  // moved. The effect below carries changes to the mirrors already running.
  const volumesRef = useRef(volumes);
  volumesRef.current = volumes;

  // Reconcile what is running against what is wanted.
  //
  // Deliberately not a cleanup-and-rebuild: this effect re-runs whenever the
  // device list refreshes, and tearing everything down each time would drop a
  // hole in every other mirror because one of them changed. Only what actually
  // differs is touched. Full teardown belongs to unmount, below.
  useEffect(() => {
    const running = runningRef.current;
    // Publishing the same set must not produce a new array.
    //
    // `targets` reads this, `desired` is derived from `targets`, and this
    // effect is keyed on `desired` — so handing React a fresh array every run
    // closes a loop that re-renders forever. Returning the previous reference
    // when nothing changed makes React bail out and the cycle stops.
    const publish = () => {
      const next = [...running.keys()];
      setRunningGuids((current) =>
        current.length === next.length &&
        current.every((guid, index) => guid === next[index])
          ? current
          : next,
      );
    };

    if (!capture) {
      running.forEach((entry) => entry.mirror.stop());
      running.clear();
      publish();
      return undefined;
    }

    running.forEach((entry, guid) => {
      const want = desired.find((candidate) => candidate.guid === guid);
      if (!want || want.sinkId !== entry.sinkId) {
        entry.mirror.stop();
        running.delete(guid);
      }
    });

    desired.forEach((want) => {
      if (running.has(want.guid) || pendingRef.current.has(want.guid)) {
        return;
      }
      pendingRef.current.add(want.guid);
      startOutputMirror({
        context: capture.context,
        source: capture.source,
        sinkId: want.sinkId,
        volume: volumesRef.current[want.guid] ?? MAX_MIRROR_VOLUME,
      })
        .then((mirror) => {
          pendingRef.current.delete(want.guid);
          // It may have been switched off while the sink was being selected.
          // Anything no longer wanted stops itself rather than leaking a live
          // element nothing holds.
          const stillWanted = desiredRef.current.find(
            (candidate) =>
              candidate.guid === want.guid && candidate.sinkId === want.sinkId,
          );
          if (!stillWanted) {
            mirror.stop();
            return mirror;
          }
          running.set(want.guid, { sinkId: want.sinkId, mirror });
          publish();
          return mirror;
        })
        .catch((mirrorError: unknown) => {
          pendingRef.current.delete(want.guid);
          setError(
            mirrorError instanceof Error
              ? mirrorError.message
              : 'A second output could not be started.',
          );
        });
    });

    publish();
    return undefined;
  }, [capture, desired]);

  // Levels reach the running mirrors without going near the reconciler, so a
  // slider changes how loud a speaker is and nothing else. `runningGuids` is
  // in here so a mirror that has only just started picks up a level that was
  // set while it was still opening its sink.
  useEffect(() => {
    runningRef.current.forEach((entry, guid) => {
      entry.mirror.setVolume(volumes[guid] ?? MAX_MIRROR_VOLUME);
    });
  }, [runningGuids, volumes]);

  // Unmount only. See the reconciler above for why this is not its cleanup.
  useEffect(() => {
    const running = runningRef.current;
    return () => {
      running.forEach((entry) => entry.mirror.stop());
      running.clear();
    };
  }, []);

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

  return {
    error,
    isVirtualRoutingAvailable,
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
