/* FluidEQ — GPL-3.0-or-later */

import fs from 'fs';
import path from 'path';
import {
  LINK_SWITCHES_ON,
  isLinkSwitches,
  linkSwitchesInEffect,
  type ILinkSwitches,
  type IRemoteDuplex,
} from '../common/remoteAudio';

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
 * The two switches on each link — "Send my sound", "Play it here" — and its
 * volume are remembered by the other computer's name, because a link's peer
 * id is new at every connection and a switch the user turned off must hold
 * from the first packet of the next one, not from whenever the window gets
 * to it. A paused link sends and plays nothing and says so; the two switches
 * keep what they were for when it resumes. The Pause lasts for the
 * connection it was pressed on: every new connection starts playing.
 */

interface IPeer {
  name: string;
  joined: boolean;
  /** What the other computer last said; absent until it says. */
  heard?: IRemoteDuplex;
}

const FILE_NAME = 'remote-audio-links.json';
const MAX_REMEMBERED = 64;

/**
 * A remembered entry, read leniently: a file written before the Pause and
 * the volume has the two switches alone, and those links were neither paused
 * nor turned down.
 */
const storedSwitches = (value: unknown): ILinkSwitches | undefined => {
  if (typeof value !== 'object' || value === null) {
    return undefined;
  }
  const { send, play, paused, volume } = value as Partial<ILinkSwitches>;
  if (
    typeof send !== 'boolean' ||
    typeof play !== 'boolean' ||
    (paused !== undefined && typeof paused !== 'boolean')
  ) {
    return undefined;
  }
  const level =
    typeof volume === 'number' && Number.isFinite(volume)
      ? Math.min(1, Math.max(0, volume))
      : 1;
  return { send, play, paused: paused === true, volume: level };
};

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
          const switches = storedSwitches(value);
          if (switches && name.length <= 128) {
            remembered.set(name, switches);
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

  /** What this computer does with one link, as the switches, the Pause and
   * the platform allow it. */
  const switches = (peer: IPeer): { send: boolean; play: boolean } => {
    const chosen = linkSwitchesInEffect(
      remembered.get(peer.name) ?? LINK_SWITCHES_ON,
    );
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
    const paused = remembered.get(peer.name)?.paused === true;
    // `paused` only when it is: the message an older FluidEQ already reads
    // is unchanged for every link that is not.
    announce(peerId, {
      sends: send,
      plays: play,
      ...(paused ? { paused } : {}),
    });
  };

  return {
    connected(peerId: string, name: string, joined: boolean) {
      // A Pause holds for one connection. A new one starts playing (Ivan,
      // 2026-10-14: "it cannot start as paused"); the two switches and the
      // volume stay as they were left.
      const kept = remembered.get(name);
      if (kept?.paused) {
        remembered.set(name, { ...kept, paused: false });
        persist();
      }
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
      if (!isLinkSwitches(chosen) || name.length === 0 || name.length > 128) {
        throw new Error('Invalid Share Audio switches.');
      }
      remembered.delete(name);
      remembered.set(name, {
        send: chosen.send,
        play: chosen.play,
        paused: chosen.paused,
        volume: chosen.volume,
      });
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
    /**
     * Whether sound from `peerId` is to arrive and play here: played here,
     * and the other computer has not said it stopped sending. A FluidEQ from
     * before both ways never says, and sends.
     */
    hears(peerId: string): boolean {
      const peer = peers.get(peerId);
      return (
        peer !== undefined && switches(peer).play && peer.heard?.sends !== false
      );
    },
    /** How loud the sound arriving from `peerId` plays here, 0 to 1. */
    volume(peerId: string): number {
      const peer = peers.get(peerId);
      return peer ? (remembered.get(peer.name)?.volume ?? 1) : 1;
    },
    switchesFor(name: string): ILinkSwitches {
      return remembered.get(name) ?? LINK_SWITCHES_ON;
    },
    reset() {
      peers.clear();
      refresh();
    },
  };
};

export type IRemoteAudioLinks = ReturnType<typeof createRemoteAudioLinks>;
