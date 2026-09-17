/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type {
  IFluidEngineEndpoint,
  IFluidEngineStatus,
  TAudioEngine,
} from 'common/audioEngine';
import type { IAudioDevice } from 'common/constants';
import {
  NO_ENGINE_HEALTH,
  engineReportsCarried,
  engineReportsStatus,
  type IEngineHealth,
} from 'common/engineHealth';
import { getAudioDevices } from '../utils/equalizerApi';
import { reportError } from '../utils/logger';
import { engineTrouble, type TEngineTrouble } from './engineTrouble';
import { useLiveAudioControl } from './LiveAudioContext';
import { OUTPUT_SIGNAL_EVENT, type IOutputSignalDetail } from './outputSignal';

const bridge = () => window.electron?.ipcRenderer;

/** One empty list for every render that has none, so nothing recomputes. */
const NO_ENDPOINTS: readonly IFluidEngineEndpoint[] = [];

/** The capture that is running, and the output it is a loopback of. */
interface ICaptureBinding {
  context: AudioContext;
  guid: Promise<string | undefined>;
}

/**
 * Whether the FluidEQ Engine is failing where it can be heard — see
 * `engineTrouble` for what that means, and this for how the facts are got.
 *
 * WHY THE SOUND DECIDES WHEN TO ASK.
 *
 * "The engine is not running this output" is only a fault while something is
 * playing there, and the one thing in this window that knows something is
 * playing is the live capture. So the question is asked at the moment it
 * starts hearing sound (`OUTPUT_SIGNAL_EVENT`), and asked of the disk, not of
 * what was last pushed: the engine writes its status inside Windows' lock for
 * the output, before any audio can pass through it, so a read that starts
 * after the sound was heard sees the status of the very stream that made it.
 * A pushed copy could still be on its way.
 *
 * Sound starting costs that one read and nothing else. Listing the devices
 * starts a PowerShell, and music with gaps in it starts sound over and over;
 * so the list is taken when a capture starts and when the output changes,
 * and which outputs the engine is on — and which version of it is installed —
 * comes from the setup helper's answer the window already holds, which every
 * action that changes either re-reads.
 *
 * The capture is a loopback of whichever output was the default when it
 * started, and stays bound to it — which is why the output it heard is looked
 * up when the capture starts, not when the sound does.
 */
const useEngineTrouble = (
  engine: TAudioEngine | null,
  fluid: IFluidEngineStatus | undefined,
  /**
   * Whether this app carries an engine the machine does not have installed
   * (`IAudioEngineStatus.fluidUpdateReady`), which is the usual reason its
   * DSP rack will not start. It sits beside the engine's own status rather
   * than in it: the comparison is main's, between two sets of files.
   */
  engineUpdateReady: boolean,
): TEngineTrouble | undefined => {
  const { capture } = useLiveAudioControl();
  const isFluid = engine === 'fluid';
  const fluidEndpoints = fluid?.endpoints ?? NO_ENDPOINTS;
  const reportsStatus = engineReportsStatus(fluid?.dllVersion);
  const reportsCarried = engineReportsCarried(fluid?.dllVersion);
  const [devices, setDevices] = useState<IAudioDevice[]>([]);
  const [health, setHealth] = useState<IEngineHealth>(NO_ENGINE_HEALTH);
  const [heardGuid, setHeardGuid] = useState<string | undefined>();
  const bindingRef = useRef<ICaptureBinding | undefined>(undefined);

  // What the engine says, as it changes. Main pushes a change only when
  // there is one, so the first read is asked for.
  useEffect(() => {
    if (!isFluid) {
      setHealth(NO_ENGINE_HEALTH);
      return undefined;
    }
    let isLive = true;
    const api = bridge();
    const stop = api?.onEngineHealth?.(setHealth) ?? (() => undefined);
    const readFirst = async () => {
      const first = await api?.getEngineHealth?.();
      if (isLive && first) {
        setHealth(first);
      }
    };
    readFirst().catch((error) =>
      reportError("The engine's health could not be read", error),
    );
    return () => {
      isLive = false;
      stop();
    };
  }, [isFluid]);

  // The outputs, for their names and which one is the default.
  useEffect(() => {
    if (!isFluid) {
      return undefined;
    }
    let isLive = true;
    const read = async () => {
      const next = await getAudioDevices();
      if (isLive) {
        setDevices(next);
      }
    };
    const refresh = () => {
      // The list stays as it was, and the log says why it is stale.
      read().catch((error) =>
        reportError(
          'The output list could not be read for the engine notice',
          error,
        ),
      );
    };
    refresh();
    window.addEventListener('fluideq-output-changed', refresh);
    return () => {
      isLive = false;
      window.removeEventListener('fluideq-output-changed', refresh);
    };
  }, [isFluid]);

  // Whichever of the capture starting and its first sound reaches here
  // first makes the binding; a new capture is one that has heard nothing.
  const bindTo = useCallback((context: AudioContext): ICaptureBinding => {
    const { current } = bindingRef;
    if (current?.context === context) {
      return current;
    }
    const lookUp = async () => {
      const list = await getAudioDevices();
      const guid = list.find((device) => device.isDefault)?.guid;
      if (bindingRef.current?.context === context) {
        setDevices(list);
      }
      return guid;
    };
    const binding: ICaptureBinding = {
      context,
      guid: lookUp().catch((error) => {
        // Without the default output the capture cannot be matched to an
        // engine status, so no trouble will ever be reported for it — worth
        // knowing when a machine says nothing while its EQ does nothing.
        reportError('The capture could not be matched to an output', error);
        return undefined;
      }),
    };
    bindingRef.current = binding;
    setHeardGuid(undefined);
    return binding;
  }, []);

  useEffect(() => {
    if (!isFluid || !capture) {
      bindingRef.current = undefined;
      setHeardGuid(undefined);
      return;
    }
    bindTo(capture.context);
  }, [bindTo, capture, isFluid]);

  useEffect(() => {
    if (!isFluid) {
      return undefined;
    }
    let isLive = true;
    const hear = async (binding: ICaptureBinding) => {
      // The read's answer reaches `health` through the push main sends
      // before it replies, whenever it differs from what this window already
      // holds — so once it resolves, `health` is at least as new as the
      // sound. The reply itself is not used, for the same reason a push is
      // not trusted on its own: it could be overtaken.
      const [guid] = await Promise.all([
        binding.guid,
        bridge()?.getEngineHealth?.(),
      ]);
      if (isLive && bindingRef.current === binding) {
        setHeardGuid(guid);
      }
    };
    const onSignal = (event: Event) => {
      const { detail } = event as CustomEvent<IOutputSignalDetail | undefined>;
      if (!detail?.context) {
        return;
      }
      // The capture's first frames can beat the effect above that records it
      // starting, and an edge dropped here would not come again until the
      // sound had stopped and started over.
      hear(bindTo(detail.context)).catch((error) =>
        reportError(
          'Sound was heard but the engine could not be checked',
          error,
        ),
      );
    };
    window.addEventListener(OUTPUT_SIGNAL_EVENT, onSignal);
    return () => {
      isLive = false;
      window.removeEventListener(OUTPUT_SIGNAL_EVENT, onSignal);
    };
  }, [bindTo, isFluid]);

  return useMemo(
    () =>
      engineTrouble({
        engine,
        devices,
        fluidEndpoints,
        reportsStatus,
        health,
        heardGuid,
        hasEverRun: fluid?.everRan,
        reportsCarried,
        engineUpdateReady,
      }),
    [
      engine,
      devices,
      fluidEndpoints,
      reportsStatus,
      health,
      heardGuid,
      fluid?.everRan,
      reportsCarried,
      engineUpdateReady,
    ],
  );
};

export default useEngineTrouble;
