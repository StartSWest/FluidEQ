/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * The window's part in the Library player's rack, which runs in the core.
 *
 * Hands the core the rack its host should run — the settings of the output
 * the Library plays on, the preset's curve, and the half of the rack's
 * placement this window knows — whenever any of them moves. Adopts, from the
 * player's view, the half the player decides: whether the Library is heard
 * from its host and whether the FluidEQ Engine took the song. The window
 * stays the one sender of the engine's copy (`store.ts`), so the two copies
 * keep following one rule and the rack runs in exactly one place.
 *
 * And what the window shows of the host: whether it is up (the DSP page says
 * the rack is unavailable when it failed) and how late it plays.
 */
import { useEffect, useRef } from 'react';
import type { IDspSettings } from '../../../common/dsp/chain';
import type {
  ILibraryRackGate,
  TWindowRackGate,
} from '../../../common/library/playerRack';
import type { TLibraryHostState } from '../../../common/library/playerWire';
import { setPlayerProcessingLatency } from '../../dsp/processingLatency';
import { useRackGate } from '../../dsp/rackPlacement';
import {
  setDspNativeState,
  setDspRackGate,
  usePlaybackPresetTone,
} from '../../dsp/store';
import { handRackToPlayer, putPlayerAway } from './corePlayer';

const usePlayerRackHandover = (options: {
  settings: IDspSettings;
  libraryGate: ILibraryRackGate;
  host: TLibraryHostState;
}): void => {
  const { settings, libraryGate, host } = options;
  const tone = usePlaybackPresetTone();
  const gate = useRackGate();
  const windowGate: TWindowRackGate = {
    engine: gate.engine,
    eqEnabled: gate.eqEnabled,
    eqLoaded: gate.eqLoaded,
    engineOff: gate.engineOff,
    sendingRawAudio: gate.sendingRawAudio === true,
  };
  // Sent when it says something new: the gate also moves with the half the
  // core sends back, which is no news to the core.
  const sentRef = useRef('');
  const copy = { settings, ...(tone ? { tone } : {}), gate: windowGate };
  const key = JSON.stringify(copy);
  useEffect(() => {
    if (key !== sentRef.current) {
      sentRef.current = key;
      handRackToPlayer(copy);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- the key is the copy, spelled out.
  }, [key]);

  // Put away: the host may go with it while nothing plays. The next copy
  // sent says the player is out again.
  useEffect(
    () => () => {
      sentRef.current = '';
      putPlayerAway();
    },
    [],
  );

  const { libraryAudible, librarySourceReady } = libraryGate;
  useEffect(() => {
    setDspRackGate({ libraryAudible, librarySourceReady });
  }, [libraryAudible, librarySourceReady]);

  useEffect(() => {
    setDspNativeState(host);
  }, [host]);

  // How late the host plays, for the listened-output readout: from its own
  // telemetry, and only while it is up.
  useEffect(() => {
    const subscribe = window.electron?.ipcRenderer?.onDspHostTelemetry;
    if (host !== 'engaged' || typeof subscribe !== 'function') {
      setPlayerProcessingLatency(undefined);
      return undefined;
    }
    const stop = subscribe((frame) =>
      setPlayerProcessingLatency(
        frame.processingLatency && frame.processingEndpoint
          ? {
              endpoint: frame.processingEndpoint,
              latency: frame.processingLatency,
            }
          : undefined,
      ),
    );
    return () => {
      stop();
      setPlayerProcessingLatency(undefined);
    };
  }, [host]);
};

export default usePlayerRackHandover;
