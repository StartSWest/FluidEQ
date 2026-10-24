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

interface ICaptureSource {
  context: AudioContext;
  source: MediaStreamAudioSourceNode;
  close(): void;
}

/**
 * This computer's sound for the network where main cannot capture it: off
 * Windows and macOS the window sends from here, to
 * every computer that is to hear it — from the Linux engine's "FluidEQ
 * Send" where there is one, otherwise from the live capture it already has.
 * One capture for all of them: what goes out is the same sound.
 *
 * `peerIds` are those computers; empty while nobody is to hear it.
 */
/**
 * The Linux engine's "FluidEQ Send": what this computer played, before its
 * EQ and without the other computers' sound (`useLinuxShareDevices.ts`).
 * Opened at its own rate, so nothing is resampled on the way out.
 */
const openSendInput = async (deviceId: string): Promise<ICaptureSource> => {
  const stream = await navigator.mediaDevices.getUserMedia({
    audio: {
      deviceId: { exact: deviceId },
      autoGainControl: false,
      echoCancellation: false,
      noiseSuppression: false,
    },
    video: false,
  });
  const [track] = stream.getAudioTracks();
  const sampleRate = track?.getSettings().sampleRate;
  const context = new AudioContext(sampleRate ? { sampleRate } : undefined);
  return {
    context,
    source: context.createMediaStreamSource(stream),
    close: () => {
      stream.getTracks().forEach((each) => each.stop());
      context.close().catch(() => undefined);
    },
  };
};

const useRemoteAudioPcmSender = ({
  peerIds,
  sendInputId,
  publishMeter,
  onSending,
  onFailure,
  recoveryAttempt = 0,
}: {
  peerIds: readonly string[];
  /** Linux with the engine's "FluidEQ Send": sent from there rather than
   * from the window's live capture, which is after the EQ. */
  sendInputId?: string;
  publishMeter: TRemoteAudioMeterListener;
  onSending(active: boolean): void;
  onFailure(): void;
  recoveryAttempt?: number;
}) => {
  const { capture: liveCapture, error: captureError } = useLiveAudioControl();
  const platform = window.electron?.platform;
  const active =
    platform !== 'win32' && platform !== 'darwin' && peerIds.length > 0;
  useLiveAudioCapture(active && sendInputId === undefined, 'work');
  const callbacksRef = useRef({ publishMeter, onSending, onFailure });
  callbacksRef.current = { publishMeter, onSending, onFailure };
  // Read as each block goes out, so a computer joining or leaving the list
  // never restarts the capture the others are hearing.
  const peerIdsRef = useRef(peerIds);
  peerIdsRef.current = peerIds;

  useEffect(() => {
    // A live-capture refusal never creates a capture object, so waiting for
    // that object silently left Share Audio looking ready while sending none.
    if (active && !sendInputId && !liveCapture && captureError) {
      callbacksRef.current.onFailure();
    }
  }, [active, captureError, liveCapture, sendInputId]);

  useEffect(() => {
    if (!active || (!liveCapture && sendInputId === undefined)) {
      return undefined;
    }
    let cancelled = false;
    let close: (() => void) | undefined;
    let own: ICaptureSource | undefined;
    let started = false;
    const open = async () => {
      own = sendInputId ? await openSendInput(sendInputId) : undefined;
      const capture = own ?? liveCapture;
      if (cancelled || !capture) {
        own?.close();
        return;
      }
      const sender = await createPcmSender(capture, (chunk) => {
        if (cancelled) {
          return;
        }
        if (!started) {
          started = true;
          callbacksRef.current.onSending(true);
        }
        callbacksRef.current.publishMeter(measureRemoteAudioChunk(chunk));
        peerIdsRef.current.forEach((peerId) =>
          window.electron.ipcRenderer.sendRemoteAudioLanAudio({
            peerId,
            ...chunk,
          }),
        );
      });
      if (cancelled) {
        sender.close();
        own?.close();
        return;
      }
      close = () => {
        sender.close();
        own?.close();
      };
    };
    open().catch(() => {
      own?.close();
      if (!cancelled) {
        callbacksRef.current.onSending(false);
        callbacksRef.current.onFailure();
      }
    });
    return () => {
      cancelled = true;
      close?.();
      callbacksRef.current.onSending(false);
    };
  }, [active, liveCapture, sendInputId, recoveryAttempt]);
};

export default useRemoteAudioPcmSender;
