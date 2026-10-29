/* FluidEQ — GPL-3.0-or-later */
import type {
  ILanRemoteAudioNetworkStats,
  ILanRemoteAudioSignal,
} from '../../common/remoteAudio';
import type {
  ILanHostCredentials,
  ILanLinkBook,
  IRemoteAudioLan,
} from '../remoteAudioLanTypes';
import { computerIdOf, decodePairingCode } from '../remoteAudioLanProtocol';
import { getAudioWorker } from './host';

export const createWorkerLan = (
  signal: (message: ILanRemoteAudioSignal) => void,
  failed: () => void,
  network: (stats: ILanRemoteAudioNetworkStats) => void,
  book: ILanLinkBook,
): IRemoteAudioLan => {
  let host = getAudioWorker();
  let identity: ILanHostCredentials | undefined;
  const listen = () =>
    host.listen((event) => {
      if (event.type === 'signal') {
        signal(event.message);
      } else if (event.type === 'network') {
        network(event.stats);
      } else if (event.type === 'lan-failed') {
        failed();
      } else if (event.type === 'book-link') {
        book.saveGroupLink?.(event.link);
      } else if (event.type === 'book') {
        if (event.operation === 'revoke') {
          book.revoke(event.value);
        } else if (event.operation === 'unrevoke') {
          book.unrevoke(event.value);
        } else {
          book.forgetJoin(event.value);
        }
      }
    });
  let unlisten = listen();
  let unfail = host.onFailure(failed);
  return {
    start: async (credentials) => {
      const next = getAudioWorker();
      if (next !== host) {
        unlisten();
        unfail();
        host = next;
        unlisten = listen();
        unfail = host.onFailure(failed);
      }
      const result = await host.request(
        'lan.start',
        credentials,
        book.snapshot?.() ?? {
          revoked: [],
          links: book.groupLinks?.() ?? [],
        },
      );
      identity = result.credentials;
      return result;
    },
    join: (code, fresh) => {
      const pairing = decodePairingCode(code);
      const computerId = computerIdOf(pairing.secret);
      if (identity && computerIdOf(identity.secret) === computerId) {
        throw new Error('That is this computer’s own code.');
      }
      if (typeof code !== 'string') {
        throw new Error('Invalid FluidEQ LAN pairing code.');
      }
      host.request('lan.join', code, fresh).catch(failed);
      return { computerId, deviceName: pairing.deviceName };
    },
    unlink: (target) => {
      host.request('lan.unlink', target).catch(failed);
    },
    retry: () => {
      host.request('lan.retry').catch(failed);
    },
    sendSignal: (message) => {
      host.request('lan.signal', message).catch(failed);
    },
    sendAudio: (chunk) => {
      host.request('lan.audio', chunk).catch(failed);
    },
    setStreamMode: () => undefined,
    stop: () => {
      unlisten();
      unfail();
      host.request('lan.stop').catch(() => undefined);
    },
  };
};
