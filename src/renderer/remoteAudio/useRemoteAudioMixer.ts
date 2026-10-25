/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { useCallback, useEffect, useRef } from 'react';
import type { TRemoteAudioMeterListener } from './meter';
import { createPcmMixer, type IPcmMixer } from './pcmMixer';

/**
 * The output the other computers' sound plays through, open exactly while
 * some linked computer is played here.
 *
 * It used to open with the listener's code, before anybody had connected,
 * and held the device for as long as the code was shown. Now any computer
 * may play another's — the one that joined as much as the one that waited —
 * so it opens on the first link that plays here and gives the device back
 * when the last one stops.
 */
const useRemoteAudioMixer = ({
  wanted,
  outputSinkIdRef,
  onBlocked,
  onMeter,
  onFailure,
  recoveryAttempt = 0,
}: {
  wanted: boolean;
  outputSinkIdRef: { current: string };
  onBlocked(blocked: boolean): void;
  onMeter: TRemoteAudioMeterListener;
  onFailure(): void;
  recoveryAttempt?: number;
}) => {
  const mixerRef = useRef<IPcmMixer | undefined>(undefined);
  const callbacksRef = useRef({ onBlocked, onMeter, onFailure });
  callbacksRef.current = { onBlocked, onMeter, onFailure };

  useEffect(() => {
    if (!wanted) {
      return undefined;
    }
    let cancelled = false;
    let opened: IPcmMixer | undefined;
    const open = async () => {
      const openedOn = outputSinkIdRef.current;
      const mixer = await createPcmMixer(
        openedOn,
        (blocked) => callbacksRef.current.onBlocked(blocked),
        (meter) => callbacksRef.current.onMeter(meter),
        1,
      );
      if (cancelled) {
        await mixer.close();
        return;
      }
      opened = mixer;
      mixerRef.current = mixer;
      // An output chosen while it was opening found no mixer to switch and
      // only wrote the ref (`useSelectedRemoteAudioOutput`); on Linux that
      // left other computers' sound in "FluidEQ" itself rather than in
      // "FluidEQ Share In", where this computer's Send would have carried it
      // straight back.
      if (outputSinkIdRef.current !== openedOn) {
        await mixer.setOutput(outputSinkIdRef.current);
      }
    };
    open().catch(() => {
      if (!cancelled) {
        callbacksRef.current.onFailure();
      }
    });
    return () => {
      cancelled = true;
      if (mixerRef.current === opened) {
        mixerRef.current = undefined;
      }
      opened?.close().catch(() => undefined);
    };
  }, [outputSinkIdRef, wanted, recoveryAttempt]);

  const removePeer = useCallback((peerId: string) => {
    mixerRef.current?.removePeer(peerId);
  }, []);
  const resume = useCallback(async () => {
    await mixerRef.current?.resume();
  }, []);
  return { mixerRef, removePeer, resume };
};

export default useRemoteAudioMixer;
