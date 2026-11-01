/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import type {
  ILibraryPlayerClock,
  ILibraryPlayerView,
  TLibraryPlayerCommand,
} from '../../common/library/playerWire';
import type {
  ILanRemoteAudioSignal,
  IRemoteNowPlaying,
  TRemoteTransportCommand,
} from '../../common/remoteAudio';
import {
  nowPlayingSenders,
  startedHere,
  wireKey,
  wireMs,
} from '../../common/remoteNowPlaying';
import type { ISystemMediaSnapshot, TSystemMediaCommand } from '../systemMedia';

/**
 * Share Audio's half of "what is playing", for a window let go in the tray.
 *
 * The window decides it while it is there (`useRemoteNowPlayingBroadcast`,
 * `useRemoteNowPlayingSource`): what this computer's bar shows, told to every
 * linked computer, with the press that started it; a linked computer's press
 * carried out on this one's player; and one player at a time across the wire.
 * A link used to keep the whole window loaded for that alone, while the sound
 * itself plays in the native helper on Windows. With no page the only players
 * left are the ones main runs or hears — the Library on its host and the
 * machine's own player — and this does the same for those, by the same rules
 * (`common/remoteNowPlaying.ts`).
 *
 * A page that speaks takes over at once; one that leaves hands back, and this
 * starts by telling every computer what plays as it stands — never as a press:
 * every player already going when the page left is one this end has seen.
 */

type TOwner = 'library' | 'system';

/** A linked computer, as main's links have it. */
export interface IWindowlessPeer {
  id: string;
  /** Paused on either side: it hears nothing of this computer's players. */
  paused: boolean;
  /** Its sound plays here. */
  heardHere: boolean;
  /**
   * This computer joined it (pasted its code). Of two linked computers both
   * already playing, the one whose code was used pauses the other on sight;
   * the press needs no such tie-break.
   */
  joined: boolean;
}

export interface IWindowlessShareDeps {
  send: (message: ILanRemoteAudioSignal) => void;
  library: (command: TLibraryPlayerCommand) => void;
  system: (command: TSystemMediaCommand, positionMs?: number) => void;
  /** Every other program on the machine that plays, paused. */
  pauseOtherPlayers: () => void;
  isSinglePlayer: () => boolean;
  /** The one-player switch, changed by a linked computer. */
  setSinglePlayer: (isOn: boolean) => void;
}

export interface IWindowlessShare {
  /** A page is there and decides. */
  pageSaid: () => void;
  /** The page went: this decides until the next one speaks. */
  pageLeft: () => void;
  linked: (peers: readonly IWindowlessPeer[]) => void;
  libraryViewed: (view: ILibraryPlayerView) => void;
  libraryClock: (clock: ILibraryPlayerClock) => void;
  systemSaid: (snapshot: ISystemMediaSnapshot | undefined) => void;
  /** A message from a linked computer. */
  heard: (message: ILanRemoteAudioSignal) => void;
  /**
   * The switch a linked computer changed while no page was there, for the
   * next page to take up — once.
   */
  takeSwitchFromLink: () => { isOn: boolean; peerId: string } | undefined;
}

interface ISource {
  owner: TOwner;
  playing: IRemoteNowPlaying;
  canToggle: boolean;
  canSeek: boolean;
}

const librarySource = (
  view: ILibraryPlayerView | undefined,
  clock: ILibraryPlayerClock | undefined,
): ISource | undefined => {
  const track = view?.deck === 'host' ? view.track : undefined;
  if (!view || !track || !track.title.trim()) {
    return undefined;
  }
  const timed = clock?.trackId === track.id ? clock : undefined;
  const durationMs = wireMs(timed?.durationMs ?? 0);
  return {
    owner: 'library',
    canToggle: !view.isUnplayable,
    canSeek: durationMs > 0,
    playing: {
      title: track.title.slice(0, 256),
      subtitle: track.artist?.slice(0, 256) || undefined,
      artist: track.artist?.slice(0, 256),
      isPlaying: view.isPlaying,
      positionMs: wireMs(timed?.positionMs ?? 0),
      durationMs,
      canNext: true,
      canPrevious: true,
      canStep: durationMs > 0,
      canStop: false,
    },
  };
};

const systemSource = (
  snapshot: ISystemMediaSnapshot | undefined,
): ISource | undefined => {
  if (!snapshot || !snapshot.title.trim()) {
    return undefined;
  }
  return {
    owner: 'system',
    canToggle: true,
    canSeek: snapshot.canSeek,
    playing: {
      title: snapshot.title.slice(0, 256),
      subtitle: (snapshot.artist || snapshot.app).slice(0, 256) || undefined,
      artist: snapshot.artist.slice(0, 256) || undefined,
      isPlaying: snapshot.isPlaying,
      positionMs: wireMs(snapshot.positionMs),
      durationMs: wireMs(snapshot.durationMs),
      canNext: snapshot.canNext,
      canPrevious: snapshot.canPrevious,
      canStep: snapshot.canSeek,
      canStop: true,
    },
  };
};

export const createWindowlessShare = (
  deps: IWindowlessShareDeps,
): IWindowlessShare => {
  let isPageSpeaking = false;
  let view: ILibraryPlayerView | undefined;
  let clock: ILibraryPlayerClock | undefined;
  let snapshot: ISystemMediaSnapshot | undefined;
  let peers: readonly IWindowlessPeer[] = [];
  /** What each linked computer last said its bar shows. */
  const theirs = new Map<string, IRemoteNowPlaying | undefined>();
  /** What each of this machine's players was last seen doing. */
  const seen = new Map<TOwner, boolean>();
  /** The player last heard playing here, for a bar with nothing playing. */
  let lastOwner: TOwner | undefined;
  /** The computers that have heard the description as it stands. */
  const told = new Set<string>();
  let lastKey: string | undefined;
  /** Linked computers heard playing here, as this end last looked. */
  let knownPlaying = new Set<string>();
  /** The computer whose user pressed play last, while it still plays. */
  let pressed: string | undefined;
  let switchFromLink: { isOn: boolean; peerId: string } | undefined;

  const sources = (): Partial<Record<TOwner, ISource>> => ({
    library: librarySource(view, clock),
    system: systemSource(snapshot),
  });

  /** This computer's own bar, then its own player even when paused. */
  const pick = (): ISource | undefined => {
    const own = sources();
    if (own.library?.playing.isPlaying) {
      return own.library;
    }
    if (own.system?.playing.isPlaying) {
      return own.system;
    }
    return (lastOwner === undefined ? undefined : own[lastOwner]) ?? own.system;
  };

  const peer = (id: string) => peers.find((entry) => entry.id === id);
  const listening = () => peers.filter((entry) => !entry.paused);
  const playingHere = () =>
    peers
      .filter(
        (entry) =>
          entry.heardHere &&
          !entry.paused &&
          theirs.get(entry.id)?.isPlaying === true,
      )
      .map((entry) => entry.id);

  const transport = (peerId: string, command: TRemoteTransportCommand) =>
    deps.send({ peerId, signal: { kind: 'transport', ...command } });

  const pausePlayingComputers = (except?: string) =>
    playingHere()
      .filter((id) => id !== except)
      .forEach((id) => transport(id, { command: 'pause' }));

  const recordSeen = () => {
    const own = sources();
    (['library', 'system'] as const).forEach((owner) => {
      const entry = own[owner];
      if (entry) {
        seen.set(owner, entry.playing.isPlaying);
        if (entry.playing.isPlaying) {
          lastOwner = owner;
        }
      }
    });
  };

  /**
   * Tells the computers what plays here, with the press when there was one,
   * and pauses those playing here when the press was this machine's — the
   * window's `registerPlayer('remote')`, reached by the Library starting and
   * by the machine's own player starting alike.
   */
  const publish = () => {
    if (isPageSpeaking) {
      recordSeen();
      return;
    }
    const source = pick();
    const playing = source?.playing;
    const started =
      source !== undefined &&
      startedHere(seen, {
        owner: source.owner,
        isPlaying: playing?.isPlaying === true,
      });
    const key = wireKey(playing);
    const changed = lastKey !== key;
    lastKey = key;
    const ids = listening().map((entry) => entry.id);
    [...told].forEach((id) => {
      if (!ids.includes(id)) {
        told.delete(id);
      }
    });
    (changed ? ids : ids.filter((id) => !told.has(id))).forEach((peerId) => {
      told.add(peerId);
      deps.send({
        peerId,
        signal: {
          kind: 'now-playing',
          playing,
          ...(changed && started ? { started: true } : {}),
        },
      });
    });
    if (changed && started && deps.isSinglePlayer()) {
      pausePlayingComputers();
    }
    recordSeen();
  };

  /** The one-player rule for what the linked computers play, on sight. */
  const followComputers = () => {
    const now = playingHere();
    const appeared = nowPlayingSenders(knownPlaying, now);
    knownPlaying = new Set(now);
    if (isPageSpeaking) {
      return;
    }
    const own = sources();
    const soundHere =
      own.library?.playing.isPlaying === true ||
      own.system?.playing.isPlaying === true ||
      now.some((id) => !appeared.includes(id));
    if (deps.isSinglePlayer() && soundHere) {
      appeared
        .filter((id) => id !== pressed && peer(id)?.joined === false)
        .forEach((id) => transport(id, { command: 'pause' }));
    }
    if (pressed !== undefined && !now.includes(pressed)) {
      pressed = undefined;
    }
  };

  /** A linked computer's user pressed play over there: ours stop. */
  const acceptStart = (peerId: string) => {
    pressed = peerId;
    if (!deps.isSinglePlayer()) {
      return;
    }
    if (view?.isPlaying) {
      deps.library({ kind: 'setPlaying', isPlaying: false });
    }
    if (snapshot?.isPlaying) {
      deps.pauseOtherPlayers();
    }
    pausePlayingComputers(peerId);
  };

  /** A press on a linked computer's bar, carried out on this one's player. */
  const perform = (command: TRemoteTransportCommand) => {
    const source = pick();
    if (command.command === 'pause' || command.command === 'stop') {
      if (command.command === 'stop' && source?.owner === 'system') {
        deps.system('stop');
      }
      if (view?.isPlaying) {
        deps.library({ kind: 'setPlaying', isPlaying: false });
      }
      deps.pauseOtherPlayers();
      return;
    }
    if (!source) {
      return;
    }
    const { playing } = source;
    if (command.command === 'toggle' || command.command === 'play') {
      if (
        !source.canToggle ||
        (command.command === 'play' && playing.isPlaying)
      ) {
        return;
      }
      if (source.owner === 'system') {
        deps.system(
          command.command === 'toggle' && playing.isPlaying ? 'pause' : 'play',
        );
      } else {
        deps.library({ kind: 'toggle' });
      }
      return;
    }
    if (command.command === 'next' || command.command === 'previous') {
      const isNext = command.command === 'next';
      if (!(isNext ? playing.canNext : playing.canPrevious)) {
        return;
      }
      if (source.owner === 'system') {
        deps.system(command.command);
      } else {
        deps.library({ kind: 'skip', direction: isNext ? 1 : -1 });
      }
      return;
    }
    if (
      (command.command !== 'seek' && command.command !== 'nudge') ||
      !source.canSeek
    ) {
      return;
    }
    const target =
      command.command === 'seek'
        ? command.positionMs
        : playing.positionMs + command.deltaMs;
    const positionMs = Math.max(
      0,
      playing.durationMs > 0 ? Math.min(playing.durationMs, target) : target,
    );
    if (source.owner === 'system') {
      deps.system('seek', positionMs);
    } else {
      deps.library({ kind: 'seek', positionMs });
    }
  };

  return {
    pageSaid: () => {
      isPageSpeaking = true;
    },
    pageLeft: () => {
      if (!isPageSpeaking) {
        return;
      }
      isPageSpeaking = false;
      // Nothing playing now is a press: the page saw all of it start.
      recordSeen();
      told.clear();
      lastKey = undefined;
      knownPlaying = new Set(playingHere());
      publish();
    },
    linked: (next) => {
      peers = next;
      [...theirs.keys()].forEach((id) => {
        if (!next.some((entry) => entry.id === id)) {
          theirs.delete(id);
        }
      });
      publish();
      followComputers();
    },
    libraryViewed: (next) => {
      view = next;
      publish();
    },
    libraryClock: (next) => {
      clock = next;
      publish();
    },
    systemSaid: (next) => {
      snapshot = next;
      publish();
    },
    heard: ({ peerId, signal }) => {
      if (signal.kind === 'now-playing') {
        theirs.set(peerId, signal.playing);
        const from = peer(peerId);
        if (!isPageSpeaking && from && !from.paused) {
          if (signal.singlePlayer !== undefined) {
            switchFromLink = { isOn: signal.singlePlayer, peerId };
            deps.setSinglePlayer(signal.singlePlayer);
            // On to the others, never back where it came from.
            listening()
              .filter((entry) => entry.id !== peerId)
              .forEach((entry) =>
                deps.send({
                  peerId: entry.id,
                  signal: {
                    kind: 'now-playing',
                    playing: pick()?.playing,
                    singlePlayer: signal.singlePlayer,
                  },
                }),
              );
          }
          if (
            signal.started === true &&
            signal.playing?.isPlaying === true &&
            from.heardHere
          ) {
            acceptStart(peerId);
          }
        }
        followComputers();
        return;
      }
      if (signal.kind === 'transport' && !isPageSpeaking) {
        if (peer(peerId)?.paused === false) {
          perform(signal);
        }
      }
    },
    takeSwitchFromLink: () => {
      const taken = switchFromLink;
      switchFromLink = undefined;
      return taken;
    },
  };
};
