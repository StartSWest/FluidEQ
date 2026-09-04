/* FluidEQ — GPL-3.0-or-later */

import {
  REMOTE_AUDIO_PORT_CHANNEL,
  type TRemoteAudioPortKind,
} from '../../common/remoteAudioPorts';

const openRemoteAudioPort = (
  kind: TRemoteAudioPortKind,
  signal?: AbortSignal,
): Promise<MessagePort> =>
  new Promise((resolve, reject) => {
    const { port1, port2 } = new MessageChannel();
    const onAbort = () => {
      port1.close();
      port2.close();
      reject(new DOMException('Audio port handoff cancelled.', 'AbortError'));
    };
    if (signal?.aborted) {
      onAbort();
      return;
    }
    const onClose = () => {
      signal?.removeEventListener('abort', onAbort);
      reject(new Error('Audio port closed before the handoff completed.'));
    };
    port1.addEventListener('close', onClose, { once: true });
    signal?.addEventListener('abort', onAbort, { once: true });
    port1.onmessage = ({ data }: MessageEvent<{ kind?: string }>) => {
      if (data.kind === 'ready') {
        port1.onmessage = null;
        port1.removeEventListener('close', onClose);
        signal?.removeEventListener('abort', onAbort);
        resolve(port1);
      }
    };
    window.postMessage({ channel: REMOTE_AUDIO_PORT_CHANNEL, kind }, '*', [
      port2,
    ]);
  });

export default openRemoteAudioPort;
