/* FluidEQ — GPL-3.0-or-later */

import { useEffect } from 'react';
import type {
  ILanRemoteAudioChunk,
  ILanRemoteAudioSignal,
} from '../../common/remoteAudio';

interface IBridgeSubscriptionOptions {
  acceptAudioRef: { current(chunk: ILanRemoteAudioChunk): void };
  acceptSignalRef: { current(signal: ILanRemoteAudioSignal): void };
  acceptStreamingRef: { current(peerId: string): void };
  handleError(): void;
}

/** Renderer reloads replace callbacks, not the main-process LAN session. */
const useRemoteAudioBridgeSubscriptions = ({
  acceptAudioRef,
  acceptSignalRef,
  acceptStreamingRef,
  handleError,
}: IBridgeSubscriptionOptions) => {
  useEffect(() => {
    const bridge = window.electron?.ipcRenderer;
    const unsubscribeSignal =
      bridge?.onRemoteAudioLanSignal?.((signal) => {
        acceptSignalRef.current(signal);
      }) ?? (() => undefined);
    const unsubscribeAudio =
      bridge?.onRemoteAudioLanAudio?.((chunk) => {
        acceptAudioRef.current(chunk);
      }) ?? (() => undefined);
    const unsubscribeError =
      bridge?.onRemoteAudioLanError?.(handleError) ?? (() => undefined);
    const unsubscribeStreaming =
      bridge?.onRemoteAudioLanStreaming?.((peerId) =>
        acceptStreamingRef.current(peerId),
      ) ?? (() => undefined);
    return () => {
      unsubscribeSignal();
      unsubscribeAudio();
      unsubscribeError();
      unsubscribeStreaming();
    };
  }, [acceptAudioRef, acceptSignalRef, acceptStreamingRef, handleError]);
};

export default useRemoteAudioBridgeSubscriptions;
