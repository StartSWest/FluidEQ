/* FluidEQ — GPL-3.0-or-later */
import crypto from 'crypto';
import type {
  ILanRemoteAudioSignal,
  TRemoteAudioSignal,
} from '../common/remoteAudio';
import {
  MAX_AUDIO_GROUP_COMPUTERS,
  type IAudioGroupEndpoint,
  type IAudioGroupHello,
  type IAudioGroupLink,
} from '../common/remoteAudioGroup';
import { isPrivateIpv4 } from './remoteAudioLanAddresses';

interface IGroupPeer {
  computerId: string;
  hello?: IAudioGroupHello;
}
interface IGroupDeps {
  self(): { endpoint: IAudioGroupEndpoint; secret: string } | undefined;
  saved(): readonly IAudioGroupLink[];
  known(): readonly string[];
  revoked(id: string): boolean;
  save(link: IAudioGroupLink): void;
  join(link: IAudioGroupLink): void;
  send(message: ILanRemoteAudioSignal): void;
}

/** Trusted introductions, then direct encrypted audio. There is no relay or
 * permanent host secret in the roster. Losing the introducing PC leaves the
 * other pairs connected. Revoking a pair blocks every automatic introduction.
 * The lowest issuer ID wins concurrent introductions, so both ends retain
 * the same credential. Its HMAC is stable across issuer restarts, and one
 * pair's derived key gives no authority over any other pair. */
const createRemoteAudioGroup = (deps: IGroupDeps) => {
  const peers = new Map<string, IGroupPeer>();
  const introduced = new Set<string>();
  const own = () => deps.self();
  const send = (peerId: string, signal: TRemoteAudioSignal) =>
    deps.send({ peerId, signal });
  const hello = (peerId: string) => {
    const self = own();
    if (self) {
      send(peerId, {
        kind: 'stream-mode',
        mode: 'video',
        group: {
          version: 1,
          endpoint: self.endpoint,
          known: [
            ...new Set([
              ...deps.known(),
              ...[...peers.values()].map((p) => p.computerId),
            ]),
          ].slice(0, MAX_AUDIO_GROUP_COMPUTERS),
        },
      });
    }
  };
  const remember = (link: IAudioGroupLink) => {
    const self = own();
    if (
      !self ||
      link.computerId === self.endpoint.computerId ||
      deps.revoked(link.computerId) ||
      !link.addresses.every(isPrivateIpv4)
    ) {
      return;
    }
    const saved = deps.saved();
    const previous = saved.find((item) => item.computerId === link.computerId);
    if (!previous && saved.length >= MAX_AUDIO_GROUP_COMPUTERS) {
      return;
    }
    if (
      previous &&
      (previous.issuer < link.issuer ||
        (previous.issuer === link.issuer && previous.secret !== link.secret))
    ) {
      return;
    }
    deps.save(link);
    deps.join(link);
  };
  const secretFor = (first: string, second: string) => {
    const self = own();
    if (!self) {
      throw new Error('Share Audio is not listening.');
    }
    return crypto
      .createHmac('sha256', self.secret)
      .update(`FluidEQ group pair v1\0${[first, second].sort().join('\0')}`)
      .digest('base64url');
  };
  const introduce = () => {
    const self = own();
    if (!self) {
      return;
    }
    const ready = [...peers.entries()].filter(([, peer]) => peer.hello);
    ready.forEach(([firstId, first], index) => {
      ready.slice(index + 1).forEach(([secondId, second]) => {
        if (
          !first.hello ||
          !second.hello ||
          first.computerId === second.computerId
        ) {
          return;
        }
        const key = [first.computerId, second.computerId].sort().join(':');
        if (
          introduced.has(key) ||
          (first.hello.known.includes(second.computerId) &&
            second.hello.known.includes(first.computerId))
        ) {
          return;
        }
        introduced.add(key);
        const secret = secretFor(first.computerId, second.computerId);
        const issuer = self.endpoint.computerId;
        send(firstId, {
          kind: 'group-link',
          link: { ...second.hello.endpoint, issuer, secret },
        });
        send(secondId, {
          kind: 'group-link',
          link: { ...first.hello.endpoint, issuer, secret },
        });
      });
    });
  };
  return {
    connected(peerId: string, computerId?: string) {
      if (!computerId) {
        return;
      }
      peers.set(peerId, { computerId });
      hello(peerId); // A known message kind; old apps ignore its new field.
    },
    disconnected(peerId: string) {
      peers.delete(peerId);
      introduced.clear();
    },
    receive({ peerId, signal }: ILanRemoteAudioSignal): boolean {
      const peer = peers.get(peerId);
      if (!peer) {
        return signal.kind === 'group-link';
      }
      if (signal.kind === 'stream-mode' && signal.group) {
        const { group } = signal;
        if (
          group.endpoint.computerId !== peer.computerId ||
          !group.endpoint.addresses.every(isPrivateIpv4)
        ) {
          return false;
        }
        const first = peer.hello === undefined;
        peer.hello = group;
        const known = deps
          .saved()
          .find((link) => link.computerId === peer.computerId);
        if (
          known &&
          (known.deviceName !== group.endpoint.deviceName ||
            known.port !== group.endpoint.port ||
            known.addresses.join(',') !== group.endpoint.addresses.join(','))
        ) {
          deps.save({ ...known, ...group.endpoint });
        }
        const self = own();
        // The listener's first description can follow auth-accepted in the
        // same TCP read, before a joiner's transport listener is attached.
        // Answer the first hello explicitly; the joiner's hello is sent only
        // after attachment. This is a handshake, never a timed retry.
        if (first) {
          hello(peerId);
        }
        if (first && self && !known) {
          // Also save the reverse direction of a manually paired link. An
          // inbound-only member must survive a restart and appear offline.
          const secret = secretFor(self.endpoint.computerId, peer.computerId);
          const issuer = self.endpoint.computerId;
          remember({ ...group.endpoint, secret, issuer, introduced: false });
          send(peerId, {
            kind: 'group-link',
            link: { ...self.endpoint, secret, issuer },
          });
        }
        introduce();
      } else if (signal.kind === 'group-link') {
        if (peer.hello && signal.link.issuer === peer.computerId) {
          remember({
            ...signal.link,
            introduced: signal.link.computerId !== peer.computerId,
          });
        }
        return true; // Credentials stay in main; never in the renderer.
      }
      return false;
    },
    reset() {
      peers.clear();
      introduced.clear();
    },
  };
};
export default createRemoteAudioGroup;
