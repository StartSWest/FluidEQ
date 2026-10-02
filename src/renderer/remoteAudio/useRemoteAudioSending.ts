/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { useCallback, useEffect, useState } from 'react';
import { useLiveAudioControl } from '../audio/LiveAudioContext';
import { updateRackGate } from '../dsp/rackPlacement';
import { publishSystemDspChain } from '../dsp/store';

/**
 * Whether this computer's sound is going out to a linked computer, as main
 * reports it — main does the capturing (`ipc/remoteAudio.ts`) — and what
 * else follows from that here.
 *
 * While it goes out, the Library player plays it untouched and the FluidEQ
 * Engine runs the rack over it instead (`rackPlacement.ts`). The visualizers
 * follow what goes out only when nothing comes in: with another computer
 * playing here they show this computer's whole sound, the other's included.
 */
const useRemoteAudioSending = ({
  bothWays,
  receiving,
}: {
  bothWays: boolean;
  /** Another computer's sound is playing here now. */
  receiving: boolean;
}) => {
  const { setSharingAudio } = useLiveAudioControl();
  const [sending, setSending] = useState(false);
  const [sendingFailed, setSendingFailed] = useState(false);

  useEffect(() => {
    updateRackGate({ sendingRawAudio: sending });
    publishSystemDspChain();
  }, [sending]);
  useEffect(
    () => () => {
      updateRackGate({ sendingRawAudio: false });
      publishSystemDspChain();
    },
    [],
  );
  useEffect(() => {
    setSharingAudio(bothWays && sending && !receiving);
    return () => setSharingAudio(false);
  }, [bothWays, receiving, sending, setSharingAudio]);
  useEffect(() => {
    const bridge = window.electron?.ipcRenderer;
    const stopSending = bridge?.onRemoteAudioLanSending?.((now) => {
      setSending(now);
      if (now) {
        setSendingFailed(false);
      }
    });
    const stopFailed = bridge?.onRemoteAudioLanSendingFailed?.(() => {
      setSending(false);
      setSendingFailed(true);
    });
    return () => {
      stopSending?.();
      stopFailed?.();
    };
  }, []);

  /** The window's own sender (off Windows) could not capture either. */
  const markSendingFailed = useCallback(() => setSendingFailed(true), []);
  return { sending, sendingFailed, markSendingFailed };
};

export default useRemoteAudioSending;
