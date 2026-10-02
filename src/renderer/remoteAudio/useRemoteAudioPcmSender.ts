/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { useEffect, useRef } from 'react';
import {
  useLiveAudioCapture,
  useLiveAudioControl,
} from '../audio/LiveAudioContext';
import {
  measureRemoteAudioChunk,
  type TRemoteAudioMeterListener,
} from './meter';
import { createPcmSender } from './pcmSender';

/**
 * This computer's sound for the network where main cannot capture it: off
 * Windows, there is no process loopback, so the window taps the system
 * loopback it already has and sends from here. That loopback hears everything
 * this computer plays, which is why off Windows a link runs one way: this
 * computer sends to the one it joined and plays nothing of it.
 *
 * `peerId` is that computer while sending is wanted, otherwise undefined.
 */
const useRemoteAudioPcmSender = ({
  peerId,
  publishMeter,
  onFailure,
}: {
  peerId: string | undefined;
  publishMeter: TRemoteAudioMeterListener;
  onFailure(): void;
}) => {
  const { capture } = useLiveAudioControl();
  const active = window.electron?.platform !== 'win32' && peerId !== undefined;
  useLiveAudioCapture(active, 'work');
  const callbacksRef = useRef({ publishMeter, onFailure });
  callbacksRef.current = { publishMeter, onFailure };

  useEffect(() => {
    if (!active || !peerId || !capture) {
      return undefined;
    }
    let cancelled = false;
    let close: (() => void) | undefined;
    const open = async () => {
      const sender = await createPcmSender(capture, (chunk) => {
        callbacksRef.current.publishMeter(measureRemoteAudioChunk(chunk));
        window.electron.ipcRenderer.sendRemoteAudioLanAudio({
          peerId,
          ...chunk,
        });
      });
      if (cancelled) {
        sender.close();
        return;
      }
      close = () => sender.close();
    };
    open().catch(() => {
      if (!cancelled) {
        callbacksRef.current.onFailure();
      }
    });
    return () => {
      cancelled = true;
      close?.();
    };
  }, [active, capture, peerId]);
};

export default useRemoteAudioPcmSender;
