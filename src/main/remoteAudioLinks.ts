/* FluidEQ — GPL-3.0-or-later */

import fs from 'fs';
import path from 'path';
import type { IRemoteDuplex } from '../common/remoteAudio';

/**
 * Share Audio both ways: who this computer sends its sound to, and whose
 * sound it plays.
 *
 * Every linked computer is one of two kinds. The one this computer JOINED
 * (pasted the code of) has always played what it is sent, so it is sent to
 * unless it says it is not playing (`plays: false`) — a FluidEQ from before
 * both ways never says anything, and never needs to. A computer that joined
 * THIS one is sent to only once it has said it plays (`duplex.plays`): an
 * older one never asks, and must not be sent sound it would only throw away.
 *
 * The two switches on each link — "Send my sound", "Play it here" — are
 * remembered by the other computer's name, because a link's peer id is new
 * at every connection and a switch the user turned off must hold from the
 * first packet of the next one, not from whenever the window gets to it.
 */

export interface ILinkSwitches {
  send: boolean;
  play: boolean;
}

interface IPeer {
  name: string;
  joined: boolean;
  /** What the other computer last said; absent until it says. */
  heard?: IRemoteDuplex;
}

const FILE_NAME = 'remote-audio-links.json';
const MAX_REMEMBERED = 64;
const ON: ILinkSwitches = { send: true, play: true };

const isSwitches = (value: unknown): value is ILinkSwitches =>
  typeof value === 'object' &&
  value !== null &&
  typeof (value as Partial<ILinkSwitches>).send === 'boolean' &&
  typeof (value as Partial<ILinkSwitches>).play === 'boolean';

export interface IRemoteAudioLinkDeps {
  /** Tell one computer what this one does with their link. */
  announce(peerId: string, duplex: IRemoteDuplex): void;
  /** The computers this one's sound goes to changed. */
  targetsChanged(targets: readonly string[]): void;
  /**
   * Whether this computer can play another's sound while it sends its own.
   * Only on Windows: elsewhere the capture hears everything this computer
   * plays, the other computer's sound with it, and would send it straight
   * back. There a link runs one way, as it always did.
   */
  bothWays: boolean;
  userDataDir: string;
}

export const createRemoteAudioLinks = ({
  announce,
  targetsChanged,
  bothWays,
  userDataDir,
}: IRemoteAudioLinkDeps) => {
  const filePath = path.join(userDataDir, FILE_NAME);
  const peers = new Map<string, IPeer>();
  let remembered = new Map<string, ILinkSwitches>();
  let lastTargets = '';

  try {
    const stored: unknown = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    if (typeof stored === 'object' && stored !== null) {
      Object.entries(stored as Record<string, unknown>)
        .slice(0, MAX_REMEMBERED)
        .forEach(([name, value]) => {
          if (isSwitches(value) && name.length <= 128) {
            remembered.set(name, { send: value.send, play: value.play });
          }
        });
    }
  } catch {
    // Nothing remembered yet, or a file that is not ours: every link is on.
    remembered = new Map();
  }

  const persist = () => {
    const temporary = `${filePath}.tmp`;
    try {
      fs.mkdirSync(userDataDir, { recursive: true });
      fs.writeFileSync(
        temporary,
        JSON.stringify(Object.fromEntries(remembered)),
        'utf8',
      );
      fs.renameSync(temporary, filePath);
    } catch {
      // A switch that could not be saved still holds for this session.
    }
  };

  /** What this computer does with one link, as the switches and the
   * platform allow it. */
  const switches = (peer: IPeer): ILinkSwitches => {
    const chosen = remembered.get(peer.name) ?? ON;
    if (bothWays) {
      return chosen;
    }
    // One way, as before both ways: a computer that joined sends, the one
    // whose code it used plays.
    return peer.joined
      ? { send: chosen.send, play: false }
      : { send: false, play: chosen.play };
  };

  const sendsTo = (peer: IPeer): boolean => {
    if (!switches(peer).send) {
      return false;
    }
    return peer.joined
      ? peer.heard?.plays !== false
      : peer.heard?.plays === true;
  };

  const refresh = () => {
    const targets = [...peers.entries()]
      .filter(([, peer]) => sendsTo(peer))
      .map(([peerId]) => peerId)
      .sort();
    const key = targets.join('\n');
    if (key !== lastTargets) {
      lastTargets = key;
      targetsChanged(targets);
    }
  };

  const tell = (peerId: string, peer: IPeer) => {
    const { send, play } = switches(peer);
    announce(peerId, { sends: send, plays: play });
  };

  return {
    connected(peerId: string, name: string, joined: boolean) {
      const peer: IPeer = { name, joined };
      peers.set(peerId, peer);
      tell(peerId, peer);
      refresh();
    },
    heard(peerId: string, duplex: IRemoteDuplex) {
      const peer = peers.get(peerId);
      if (peer) {
        peer.heard = duplex;
        refresh();
      }
    },
    disconnected(peerId: string) {
      if (peers.delete(peerId)) {
        refresh();
      }
    },
    /** The user's switches for the computer called `name`, every link to it.
     * Checked here, because they arrive from the window. */
    choose(name: string, chosen: unknown) {
      if (!isSwitches(chosen) || name.length === 0 || name.length > 128) {
        throw new Error('Invalid Share Audio switches.');
      }
      remembered.delete(name);
      remembered.set(name, { send: chosen.send, play: chosen.play });
      while (remembered.size > MAX_REMEMBERED) {
        const [oldest] = remembered.keys();
        remembered.delete(oldest);
      }
      persist();
      peers.forEach((peer, peerId) => {
        if (peer.name === name) {
          tell(peerId, peer);
        }
      });
      refresh();
    },
    /** Whether the sound arriving from `peerId` is played here. */
    plays(peerId: string): boolean {
      const peer = peers.get(peerId);
      return peer !== undefined && switches(peer).play;
    },
    switchesFor(name: string): ILinkSwitches {
      return remembered.get(name) ?? ON;
    },
    reset() {
      peers.clear();
      refresh();
    },
  };
};

export type IRemoteAudioLinks = ReturnType<typeof createRemoteAudioLinks>;
