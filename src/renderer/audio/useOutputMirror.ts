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
import { IAudioDevice, IState } from 'common/constants';
import { hasVirtualRouting } from 'common/virtualAudioDevices';
import { getAudioDevices, getStateForAudioDevice } from '../utils/equalizerApi';
import { useFluidEqContext } from '../utils/FluidEqContext';
import { useLiveAudioControl } from './LiveAudioContext';
import {
  createMirrorEqChain,
  getMirrorFilters,
  TMirrorFilter,
} from './mirrorEq';
import { IOutputMirror, startOutputMirror } from './outputMirror';

/** The EQ one mirror should apply. Compared by reference, so it is memoised. */
interface IMirrorEqSettings {
  filters: TMirrorFilter[];
  preAmp: number;
}

/**
 * Where the chosen mirrors live between runs.
 *
 * GUIDs, never sink ids. Chromium salts sink ids per origin and drops them
 * with site data, so a stored one can come back meaning a different speaker;
 * the GUID is what Windows and APO already agree on.
 */
const MIRROR_TARGETS_KEY = 'fluideq-mirror-target-guids';

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
  /** The EQ controls are currently editing this output's profile. */
  isBeingTuned: boolean;
}

/** A mirror that should be running, and what it should be running with. */
interface IDesiredMirror {
  guid: string;
  sinkId: string;
  eq?: IMirrorEqSettings;
}

/** A mirror that is running, kept so the reconciler can spot a change. */
interface IRunningMirror {
  sinkId: string;
  eq?: IMirrorEqSettings;
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
 * Own the mirrors: which endpoints could take one, which ones are chosen, and
 * the running graphs themselves.
 *
 * Several at once, because that is the feature — one capture fanned out to as
 * many outputs as asked for, each carrying its own device's profile. The
 * capture is shared and read-only to all of them, so the cost of another is a
 * filter chain and a stream, not another `getDisplayMedia`.
 */
const useOutputMirror = () => {
  const { capture } = useLiveAudioControl();
  // The live editing session. When the output being tuned is also one being
  // mirrored, the mirror follows the bands as they move rather than waiting
  // for a save — otherwise setting one up means dragging a slider and hearing
  // nothing change on the speaker it belongs to.
  //
  // Destructured rather than held whole: the context value is a fresh literal
  // every render, so depending on it would rebuild every mirror continuously.
  // These fields only change when the tuning actually does.
  const {
    activeDeviceId,
    bypassed: liveBypassed,
    driver: liveDriver,
    eqFormat: liveEqFormat,
    filters: liveFilters,
    graphicEq: liveGraphicEq,
    headphone: liveHeadphone,
    isFlat: liveIsFlat,
    preAmp: livePreAmp,
    smartEq: liveSmartEq,
    voicing: liveVoicing,
  } = useFluidEqContext();
  const [devices, setDevices] = useState<IAudioDevice[]>([]);
  const [outputs, setOutputs] = useState<IMediaOutputDevice[]>([]);
  const [selectedGuids, setSelectedGuids] = useState<string[]>(loadSelection);
  const [profiles, setProfiles] = useState<Record<string, IState>>({});
  const [runningGuids, setRunningGuids] = useState<string[]>([]);
  const [error, setError] = useState('');
  const runningRef = useRef(new Map<string, IRunningMirror>());
  /** Starts in flight, so one effect run cannot launch the same sink twice. */
  const pendingRef = useRef(new Set<string>());

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
        isSelected: selectedGuids.includes(device.guid),
        isRunning: runningGuids.includes(device.guid),
        isBeingTuned: Boolean(activeDeviceId && device.id === activeDeviceId),
      };
    });
  }, [
    activeDeviceId,
    captureSourceGuid,
    devices,
    outputs,
    runningGuids,
    selectedGuids,
  ]);

  const isVirtualRoutingAvailable = useMemo(
    () => hasVirtualRouting(devices),
    [devices],
  );

  const selectedTargets = useMemo(
    () => targets.filter((target) => target.isSelected),
    [targets],
  );

  // Each mirrored device's OWN profile, which is the point of per-mirror EQ.
  // Keyed on the endpoint ids alone: the target objects are rebuilt on every
  // device refresh, and refetching every profile each time would be pointless
  // traffic and would restart every running mirror.
  const profileKey = useMemo(
    () =>
      selectedTargets
        .map((target) => target.device.id)
        .sort()
        .join('|'),
    [selectedTargets],
  );
  const selectedTargetsRef = useRef(selectedTargets);
  selectedTargetsRef.current = selectedTargets;

  useEffect(() => {
    const wanted = selectedTargetsRef.current;
    if (wanted.length === 0) {
      setProfiles({});
      return undefined;
    }
    let isCancelled = false;
    Promise.all(
      wanted.map(async (target) => {
        try {
          return [
            target.device.guid,
            await getStateForAudioDevice(target.device.id),
          ] as const;
        } catch {
          // No profile is a real answer: that device plays flat rather than
          // borrowing the primary device's correction, which is the one thing
          // it must never do.
          return [target.device.guid, undefined] as const;
        }
      }),
    ).then((entries) => {
      if (!isCancelled) {
        setProfiles(
          Object.fromEntries(
            entries.filter((entry): entry is [string, IState] =>
              Boolean(entry[1]),
            ),
          ),
        );
      }
      return entries;
    });
    return () => {
      isCancelled = true;
    };
  }, [profileKey]);

  // Memoised on the fields themselves, not on the context object, which is a
  // fresh literal on every render. Feeding that straight into `desired` would
  // make the reconciler restart every mirror on every render — the same shape
  // of loop the running-set publish had.
  const liveEq = useMemo<IMirrorEqSettings>(
    () => ({
      filters: getMirrorFilters({
        bypassed: liveBypassed,
        driver: liveDriver,
        eqFormat: liveEqFormat,
        filters: liveFilters,
        graphicEq: liveGraphicEq,
        headphone: liveHeadphone,
        isFlat: liveIsFlat,
        smartEq: liveSmartEq,
        voicing: liveVoicing,
      }),
      preAmp: livePreAmp,
    }),
    [
      liveBypassed,
      liveDriver,
      liveEqFormat,
      liveFilters,
      liveGraphicEq,
      liveHeadphone,
      liveIsFlat,
      livePreAmp,
      liveSmartEq,
      liveVoicing,
    ],
  );

  const savedEq = useMemo<Record<string, IMirrorEqSettings>>(
    () =>
      Object.fromEntries(
        Object.entries(profiles).map(([guid, state]) => [
          guid,
          { filters: getMirrorFilters(state), preAmp: state.preAmp },
        ]),
      ),
    [profiles],
  );

  const desired = useMemo<IDesiredMirror[]>(
    () =>
      selectedTargets.flatMap((target) =>
        target.isUsable && target.match.sinkId
          ? [
              {
                guid: target.device.guid,
                sinkId: target.match.sinkId,
                // The output being tuned right now takes the live state; every
                // other one takes what its profile says on disk.
                eq:
                  target.device.id === activeDeviceId
                    ? liveEq
                    : savedEq[target.device.guid],
              },
            ]
          : [],
      ),
    [activeDeviceId, liveEq, savedEq, selectedTargets],
  );
  const desiredRef = useRef(desired);
  desiredRef.current = desired;

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
      // EQ compared by identity: both sides are memoised, so a new object
      // means the filters genuinely changed and the chain has to be rebuilt.
      if (!want || want.sinkId !== entry.sinkId || want.eq !== entry.eq) {
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
        // Bands, voicing, driver compensation and Smart EQ, all from the
        // shared derivation. GraphicEQ and convolution are still absent —
        // see `getMirrorFilters` for why each needs more than a biquad.
        eq: want.eq
          ? createMirrorEqChain(
              capture.context,
              want.eq.filters,
              want.eq.preAmp,
            )
          : undefined,
      })
        .then((mirror) => {
          pendingRef.current.delete(want.guid);
          // It may have been switched off, or its profile replaced, while the
          // sink was being selected. Anything no longer wanted stops itself
          // rather than leaking a live element nothing holds.
          const stillWanted = desiredRef.current.find(
            (candidate) =>
              candidate.guid === want.guid &&
              candidate.sinkId === want.sinkId &&
              candidate.eq === want.eq,
          );
          if (!stillWanted) {
            mirror.stop();
            return mirror;
          }
          running.set(want.guid, {
            sinkId: want.sinkId,
            eq: want.eq,
            mirror,
          });
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

  return {
    error,
    isVirtualRoutingAvailable,
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
