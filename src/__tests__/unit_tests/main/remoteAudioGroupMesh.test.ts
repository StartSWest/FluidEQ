/** @jest-environment node */
/* FluidEQ — GPL-3.0-or-later */
import { EventEmitter } from 'events';
import type {
  ILanRemoteAudioChunk,
  ILanRemoteAudioSignal,
} from '../../../common/remoteAudio';
import type { IAudioGroupLink } from '../../../common/remoteAudioGroup';
import createRemoteAudioLan from '../../../main/remoteAudioLan';
import { computerIdOf } from '../../../main/remoteAudioLanProtocol';
import type {
  ILanHostSession,
  IRemoteAudioLan,
} from '../../../main/remoteAudioLanTypes';

// Only discovery/address policy is substituted. Actual TCP sockets, challenge
// authentication, per-session AES-GCM and PCM packet encoding run on loopback.
jest.mock('../../../main/remoteAudioLanAddresses', () => ({
  ...jest.requireActual('../../../main/remoteAudioLanAddresses'),
  lanAddresses: () => ['127.0.0.1'],
  isPrivateIpv4: (address: string) => address === '127.0.0.1',
  discoveryTargets: () => [],
}));
jest.mock('dgram', () => ({
  __esModule: true,
  default: {
    createSocket: () => {
      const socket = new EventEmitter();
      return Object.assign(socket, {
        bind: () => queueMicrotask(() => socket.emit('listening')),
        close: () => undefined,
        setBroadcast: () => undefined,
        send: (
          _bytes: Buffer,
          _port: number,
          _address: string,
          done?: () => void,
        ) => done?.(),
      });
    },
  },
}));

interface INode {
  lan: IRemoteAudioLan;
  session?: ILanHostSession;
  peers: Map<string, string>;
  saved: Map<string, IAudioGroupLink>;
  revoked: Set<string>;
  chunks: ILanRemoteAudioChunk[];
}

let cleanupMesh: (() => void) | undefined;
afterEach(() => {
  cleanupMesh?.();
  cleanupMesh = undefined;
});

it.each([false, true])(
  'introduces a four-PC chain, survives an introducer leaving, reconnects from pair credentials and honors unlink (reversed IDs: %s)',
  async (reversed) => {
    const changed = new EventEmitter();
    const nodes: INode[] = [];
    let phase = 'initial mesh';
    cleanupMesh = () => {
      nodes.forEach((item) => item.lan.stop());
      if (phase !== 'complete') {
        throw new Error(
          `Mesh stopped at ${phase}: ${JSON.stringify(nodes.map((item) => ({ id: item.session?.details.computerId, peers: [...item.peers.keys()], saved: [...item.saved.values()].map((link) => ({ id: link.computerId, issuer: link.issuer })), chunks: item.chunks.length })))}`,
        );
      }
    };
    const waitFor = (condition: () => boolean) =>
      new Promise<void>((resolve) => {
        const check = () => {
          if (condition()) {
            changed.removeListener('change', check);
            resolve();
          }
        };
        changed.on('change', check);
        check();
      });
    const node = (): INode => {
      const peers = new Map<string, string>();
      const saved = new Map<string, IAudioGroupLink>();
      const revoked = new Set<string>();
      const chunks: ILanRemoteAudioChunk[] = [];
      const accept = ({ peerId, signal }: ILanRemoteAudioSignal) => {
        if (signal.kind === 'peer-ready' && signal.computerId) {
          peers.set(signal.computerId, peerId);
        }
        if (signal.kind === 'stop') {
          [...peers.entries()].forEach(([id, peer]) => {
            if (peer === peerId) {
              peers.delete(id);
            }
          });
        }
        changed.emit('change');
      };
      const lan = createRemoteAudioLan(
        accept,
        (chunk) => {
          chunks.push(chunk);
          changed.emit('change');
        },
        () => undefined,
        () => undefined,
        {
          isRevoked: (id) => revoked.has(id),
          revoke: (id) => {
            revoked.add(id);
          },
          unrevoke: (id) => {
            revoked.delete(id);
          },
          forgetJoin: (id) => {
            saved.delete(id);
          },
          groupLinks: () => [...saved.values()],
          saveGroupLink: (link) => {
            saved.set(link.computerId, link);
            changed.emit('change');
          },
        },
      );
      const next = { lan, peers, saved, revoked, chunks };
      nodes.push(next);
      return next;
    };
    const a = node();
    const b = node();
    const c = node();
    const d = node();
    try {
      const secrets = ['a', 'b', 'c', 'd']
        .map((letter) => letter.repeat(43))
        .sort((first, second) =>
          computerIdOf(first) < computerIdOf(second) ? -1 : 1,
        );
      if (reversed) {
        secrets.reverse();
      }
      [a.session, b.session, c.session, d.session] = await Promise.all(
        nodes.map((item, index) =>
          item.lan.start({ port: 0, secret: secrets[index] }),
        ),
      );
      if (
        !a.session.details.code ||
        !b.session.details.code ||
        !c.session.details.code
      ) {
        throw new Error('Missing LAN codes');
      }
      b.lan.join(a.session.details.code, true);
      c.lan.join(b.session.details.code, true);
      d.lan.join(c.session.details.code, true);
      await waitFor(() =>
        nodes.every((item) => item.peers.size === 3 && item.saved.size === 3),
      );
      const aId = a.session.details.computerId;
      const cId = c.session.details.computerId;
      const pair = a.saved.get(cId);
      phase = 'pair credentials';
      await waitFor(
        () => a.saved.get(cId)?.secret === c.saved.get(aId)?.secret,
      );
      expect(pair?.secret).toBe(c.saved.get(aId)?.secret);
      expect(pair?.secret).not.toBe(a.session.credentials.secret);
      expect(pair?.secret).not.toBe(c.session.credentials.secret);
      const pcm = Float32Array.from([0.125, -0.25, 0.5, -0.75]);
      const send = () => {
        const peerId = a.peers.get(cId);
        if (!peerId) {
          throw new Error('A and C have no direct connection');
        }
        a.lan.sendAudio({
          peerId,
          sequence: 0,
          sampleRate: 48000,
          channels: 2,
          frames: 2,
          pcm,
        });
      };
      b.lan.stop();
      phase = 'direct PCM with introducer offline';
      send();
      await waitFor(() => c.chunks.length === 1);
      expect(new Float32Array(c.chunks[0].pcm)).toEqual(pcm);
      // Restart the first computer with only its identity and protected pair
      // book. No introducing computer and no pasted codes are needed.
      a.lan.stop();
      phase = 'restart close';
      a.peers.clear();
      await waitFor(() => !c.peers.has(aId));
      a.session = await a.lan.start(a.session.credentials);
      phase = 'restart connection';
      await waitFor(() => a.peers.has(cId) && c.peers.has(aId));
      send();
      phase = 'PCM after restart';
      await waitFor(() => c.chunks.length === 2);
      expect(new Float32Array(c.chunks[1].pcm)).toEqual(pcm);
      a.lan.unlink({ computerId: cId });
      phase = 'unlink';
      await waitFor(() => !a.peers.has(cId) && !c.peers.has(aId));
      expect(a.revoked.has(cId)).toBe(true);
      expect(c.revoked.has(aId)).toBe(true);
      phase = 'complete';
    } finally {
      nodes.forEach((item) => item.lan.stop());
      changed.removeAllListeners();
    }
  },
  15000,
);
