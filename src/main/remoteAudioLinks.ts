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
 * volume are remembered by its lasting computer ID, because a link's peer
 * id is new at every connection and a switch the user turned off must hold
 * from the first packet of the next one, not from whenever the window gets
 * to it. A paused link sends and plays nothing and says so; the two switches
 * keep what they were for when it resumes. The Pause lasts for the
 * connection it was pressed on: every new connection starts playing.
 */

interface IPeer {
  name: string;
  key: string;
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
  const { send, play, paused, volume, muted } = value as Partial<ILinkSwitches>;
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
  return {
    send,
    play,
    paused: paused === true,
    volume: level,
    ...(muted === true ? { muted: true } : {}),
  };
};

export interface IRemoteAudioLinkDeps {
  /** Tell one computer what this one does with their link. */
  announce(peerId: string, duplex: IRemoteDuplex): void;
  /** The computers this one's sound goes to changed. */
  targetsChanged(targets: readonly string[]): void;
  /**
   * Whether this computer can play another's sound while it sends its own:
   * on Windows, and on Linux once the engine offers "FluidEQ Send" and
   * "FluidEQ Share In" (`setBothWays`). Elsewhere the capture hears
   * everything this computer plays, the other computer's sound with it, and
   * would send it straight back, so a link runs one way, as it always did.
   */
  bothWays: boolean;
  userDataDir: string;
}

export const createRemoteAudioLinks = ({
  announce,
  targetsChanged,
  bothWays: bothWaysAtStart,
  userDataDir,
}: IRemoteAudioLinkDeps) => {
  let bothWays = bothWaysAtStart;
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
      remembered.get(peer.key) ?? LINK_SWITCHES_ON,
    );
    if (remembered.get('@source')?.send === false) {
      chosen.send = false;
    }
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
    const paused = remembered.get(peer.key)?.paused === true;
    // `paused` only when it is: the message an older FluidEQ already reads
    // is unchanged for every link that is not.
    announce(peerId, {
      sends: send,
      plays: play,
      ...(paused ? { paused } : {}),
    });
  };

  return {
    connected(
      peerId: string,
      name: string,
      joined: boolean,
      computerId?: string,
      introduced = false,
    ) {
      const key = computerId ? `id:${computerId}` : name;
      if (introduced && !remembered.has(key)) {
        remembered.set(key, { ...LINK_SWITCHES_ON, play: false });
        persist();
      }
      // Consume a legacy name once, so another PC with the same name cannot
      // inherit or change this PC's receive volume and switches.
      if (computerId && !remembered.has(key) && remembered.has(name)) {
        const legacy = remembered.get(name);
        if (legacy) {
          remembered.set(key, legacy);
        }
        remembered.delete(name);
        persist();
      }
      // A Pause holds for one connection. A new one starts playing (Ivan,
      // 2026-10-14: "it cannot start as paused"); the two switches and the
      // volume stay as they were left.
      const kept = remembered.get(key);
      if (kept?.paused) {
        remembered.set(key, { ...kept, paused: false });
        persist();
      }
      const peer: IPeer = { name, key, joined };
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
        ...(chosen.muted ? { muted: true } : {}),
      });
      while (remembered.size > MAX_REMEMBERED) {
        const [oldest] = remembered.keys();
        remembered.delete(oldest);
      }
      persist();
      peers.forEach((peer, peerId) => {
        if (peer.key === name || name === '@source') {
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
      const choice = peer ? remembered.get(peer.key) : undefined;
      return choice?.muted ? 0 : (choice?.volume ?? 1);
    },
    /** The window found the Linux engine's two Share Audio endpoints come or
     * go; every link is told what this computer now does with it. */
    setBothWays(next: boolean) {
      if (next === bothWays) {
        return;
      }
      bothWays = next;
      peers.forEach((peer, peerId) => tell(peerId, peer));
      refresh();
    },
    /** Every link is told again what this computer does with it: the
     * Smooth playback switch moved, and with it the word it travels in. */
    retell() {
      peers.forEach((peer, peerId) => tell(peerId, peer));
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
