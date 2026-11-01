/** @jest-environment node */
/* FluidEQ — GPL-3.0-or-later */

/**
 * Reconnect by hand on a link that is up, over real sockets: the link is
 * closed plainly and made again with the saved code, from either side, and
 * neither computer is told to forget the other — Reconnect is not Unlink.
 */

import { EventEmitter } from 'events';
import type { ILanRemoteAudioSignal } from '../../../common/remoteAudio';
import createRemoteAudioLan from '../../../main/remoteAudioLan';
import type {
  ILanHostSession,
  IRemoteAudioLan,
} from '../../../main/remoteAudioLanTypes';

// Only discovery/address policy is substituted, as in the group mesh test:
// TCP, challenge authentication and AES-GCM run on loopback.
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
  /** Linked computers by id, and the peer id of each link. */
  peers: Map<string, string>;
  revoked: Set<string>;
  /** Every link made, counted, so a relink is told from no change. */
  linksMade: number;
}

it('makes a live link again from either side, and unlinks nobody', async () => {
  const changed = new EventEmitter();
  const nodes: INode[] = [];
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
    const item: INode = {
      lan: undefined as unknown as IRemoteAudioLan,
      peers: new Map(),
      revoked: new Set(),
      linksMade: 0,
    };
    const accept = ({ peerId, signal }: ILanRemoteAudioSignal) => {
      if (signal.kind === 'peer-ready' && signal.computerId) {
        item.peers.set(signal.computerId, peerId);
        item.linksMade += 1;
      }
      if (signal.kind === 'stop') {
        [...item.peers.entries()].forEach(([id, peer]) => {
          if (peer === peerId) {
            item.peers.delete(id);
          }
        });
      }
      changed.emit('change');
    };
    item.lan = createRemoteAudioLan(
      accept,
      () => undefined,
      () => undefined,
      () => undefined,
      {
        isRevoked: (id) => item.revoked.has(id),
        revoke: (id) => {
          item.revoked.add(id);
        },
        unrevoke: (id) => {
          item.revoked.delete(id);
        },
        forgetJoin: () => undefined,
        groupLinks: () => [],
        saveGroupLink: () => undefined,
      },
    );
    nodes.push(item);
    return item;
  };
  const a = node();
  const b = node();
  try {
    a.session = await a.lan.start({ port: 0, secret: 'a'.repeat(43) });
    b.session = await b.lan.start({ port: 0, secret: 'b'.repeat(43) });
    if (!a.session.details.code) {
      throw new Error('Missing LAN code');
    }
    const aId = a.session.details.computerId;
    const bId = b.session.details.computerId;
    // Only B holds a code: A's.
    b.lan.join(a.session.details.code, true);
    await waitFor(() => a.peers.has(bId) && b.peers.has(aId));

    // From the side that holds the code: it dials again itself.
    const madeBefore = b.linksMade;
    await expect(b.lan.reconnect({ computerId: aId })).resolves.toBe(true);
    await waitFor(() => b.linksMade > madeBefore && a.peers.has(bId));

    // From the side that holds none: the link is handed back to B to dial.
    const madeAgain = a.linksMade;
    await expect(a.lan.reconnect({ peerId: a.peers.get(bId) })).resolves.toBe(
      true,
    );
    await waitFor(
      () => a.linksMade > madeAgain && a.peers.has(bId) && b.peers.has(aId),
    );

    expect(a.revoked.size).toBe(0);
    expect(b.revoked.size).toBe(0);
  } finally {
    nodes.forEach((item) => item.lan.stop());
    changed.removeAllListeners();
  }
}, 15000);
