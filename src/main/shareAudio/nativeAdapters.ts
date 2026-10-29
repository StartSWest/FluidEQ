/* FluidEQ — GPL-3.0-or-later */
import type { ILanAudioClient, ILanAudioLease } from '../lanAudioHelper';
import type { INativeRemoteAudioPlayback } from '../nativeRemoteAudioPlayback';
import type { IRemoteAudioCapture } from '../remoteAudioCapture';
import type { ILanRemoteAudioChunk } from '../../common/remoteAudio';
import type { IRemotePlaybackMeter } from '../../common/remoteAudioPlayback';
import { getAudioWorker } from './host';

let requestId = 0;
export { audioWorkerHelperPid } from './host';

export const leaseWorkerAudioHelper = async (
  client: ILanAudioClient,
): Promise<ILanAudioLease> => {
  const host = getAudioWorker();
  const { id, version } = await host.request('helper.lease');
  const unlisten = host.listen((event) => {
    if (event.type === 'helper-reply' && event.id === id) {
      client.reply?.({
        ...event.reply,
        payload: Buffer.from(event.reply.payload),
      });
    } else if (event.type === 'helper-stopped' && event.id === id) {
      client.stopped(new Error('The LAN audio helper stopped.'));
    }
  });
  const onFailure = () => {
    client.stopped(new Error('Share Audio worker stopped.'));
  };
  const unfail = host.onFailure(onFailure);
  return {
    request: (kind, payload) => {
      requestId = requestId === 0xffff_ffff ? 1 : requestId + 1;
      const alias = requestId;
      return {
        id: alias,
        answered: host.request('helper.request', id, alias, kind, payload),
      };
    },
    send: (packet) => {
      host.request('helper.send', id, packet).catch(onFailure);
    },
    version,
    release: () => {
      unlisten();
      unfail();
      host.request('helper.release', id).catch(() => undefined);
    },
  };
};

export const startWorkerPlayback = async (
  onMeter: (meter: IRemotePlaybackMeter) => void,
  onFailure: () => void,
): Promise<INativeRemoteAudioPlayback> => {
  const host = getAudioWorker();
  const id = await host.request('playback.start');
  const unlisten = host.listen((event) => {
    if (event.type === 'meter' && event.id === id) {
      onMeter(event.meter);
    } else if (event.type === 'playback-failed' && event.id === id) {
      onFailure();
    }
  });
  const unfail = host.onFailure(onFailure);
  let closed = false;
  return {
    push: (chunk) => {
      host.request('playback.push', id, chunk).catch(onFailure);
    },
    remove: (peerId) => {
      host.request('playback.remove', id, peerId).catch(onFailure);
    },
    reset: () => {
      host.request('playback.reset', id).catch(onFailure);
    },
    setVolume: (volume) => {
      host.request('playback.volume', id, volume).catch(onFailure);
    },
    setSmooth: (peerId, smooth) => {
      host.request('playback.smooth', id, peerId, smooth).catch(onFailure);
    },
    setOutput: (guid) => host.request('playback.output', id, guid),
    close: async () => {
      if (closed) {
        return;
      }
      closed = true;
      unlisten();
      unfail();
      await host.request('playback.close', id);
    },
  };
};

export const startWorkerCapture = async (
  onAudio: (chunk: ILanRemoteAudioChunk) => void,
  onFailure: () => void,
): Promise<IRemoteAudioCapture> => {
  const host = getAudioWorker();
  const id = await host.request('capture.start');
  const unlisten = host.listen((event) => {
    if (event.type === 'capture' && event.id === id) {
      onAudio(event.chunk);
    } else if (event.type === 'capture-failed' && event.id === id) {
      onFailure();
    }
  });
  const unfail = host.onFailure(onFailure);
  return {
    close: () => {
      unlisten();
      unfail();
      host.request('capture.close', id).catch(() => undefined);
    },
  };
};
