/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * The window's view of the Library player, which runs in the app's core
 * (`main/libraryPlayer/`): what it says to draw and where the song is, as
 * it pushes them, and the presses sent back. Nothing here decides what
 * plays — a window reloading, hidden or closed changes nothing the player
 * does.
 */
import { useSyncExternalStore } from 'react';
import { PLAYER_RACK_CHANNEL } from '../../../common/library/playerRack';
import type { IPlayerRackCopy } from '../../../common/library/playerRack';
import {
  LIBRARY_PLAYER_CHANNEL,
  NO_PLAYER_VIEW,
  type ILibraryPlayerClock,
  type ILibraryPlayerView,
  type TLibraryPlayerCommand,
  type TWindowDeckReport,
} from '../../../common/library/playerWire';
import { sendRequest, simpleResponseHandler } from '../../utils/ipcRequest';

const NO_CLOCK: ILibraryPlayerClock = { positionMs: 0, durationMs: 0 };

let view: ILibraryPlayerView = NO_PLAYER_VIEW;
let clock: ILibraryPlayerClock = NO_CLOCK;
const viewListeners = new Set<() => void>();
const clockListeners = new Set<() => void>();

const listenTo =
  (listeners: Set<() => void>) =>
  (listener: () => void): (() => void) => {
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  };
const subscribeView = listenTo(viewListeners);
const subscribeClock = listenTo(clockListeners);

/** Optional, like every bridge call: a test's partial bridge has none. */
const send = (channel: string, args: unknown[]): void =>
  window.electron?.ipcRenderer?.sendMessage?.(channel, args);

/** What the core sends is what the core built; the shape is still checked. */
const isView = (value: unknown): value is ILibraryPlayerView =>
  typeof value === 'object' &&
  value !== null &&
  typeof (value as ILibraryPlayerView).isPlaying === 'boolean' &&
  typeof (value as ILibraryPlayerView).deck === 'string' &&
  Array.isArray((value as ILibraryPlayerView).added);

const isClock = (value: unknown): value is ILibraryPlayerClock =>
  typeof value === 'object' &&
  value !== null &&
  typeof (value as ILibraryPlayerClock).positionMs === 'number' &&
  typeof (value as ILibraryPlayerClock).durationMs === 'number';

const askAgain = (): void => send(LIBRARY_PLAYER_CHANNEL.ask, []);

/**
 * Follow what the core says from now on: asked once, then told — and asked
 * again whenever the window comes back into sight, because the clock is not
 * sent to a window nobody can see.
 */
export const followCorePlayer = (): (() => void) => {
  const api = window.electron?.ipcRenderer;
  const stops = [
    api?.on?.(LIBRARY_PLAYER_CHANNEL.view, (payload) => {
      if (isView(payload)) {
        view = payload;
        viewListeners.forEach((listener) => listener());
      }
    }),
    api?.on?.(LIBRARY_PLAYER_CHANNEL.clock, (payload) => {
      if (isClock(payload)) {
        clock = payload;
        clockListeners.forEach((listener) => listener());
      }
    }),
  ];
  const onVisible = () => {
    if (document.visibilityState === 'visible') {
      askAgain();
    }
  };
  document.addEventListener('visibilitychange', onVisible);
  askAgain();
  return () => {
    document.removeEventListener('visibilitychange', onVisible);
    stops.forEach((stop) => stop?.());
  };
};

export const useCorePlayerView = (): ILibraryPlayerView =>
  useSyncExternalStore(
    subscribeView,
    () => view,
    () => NO_PLAYER_VIEW,
  );

export const useCorePlayerClock = (): ILibraryPlayerClock =>
  useSyncExternalStore(
    subscribeClock,
    () => clock,
    () => NO_CLOCK,
  );

/** A press; the core answers by sending the view again. */
export const pressPlayer = (command: TLibraryPlayerCommand): void =>
  send(LIBRARY_PLAYER_CHANNEL.command, [command]);

/** An add, answered with how many songs joined. */
export const addToCoreQueue = (
  trackIds: readonly string[],
  beforeIds?: readonly string[],
): Promise<number> =>
  sendRequest<number>(
    LIBRARY_PLAYER_CHANNEL.command,
    [
      beforeIds === undefined
        ? { kind: 'add', trackIds }
        : { kind: 'add', trackIds, beforeIds },
    ],
    simpleResponseHandler<number>(),
  );

/** What the window's own element did, while it is the deck. */
export const reportDeck = (report: TWindowDeckReport): void =>
  send(LIBRARY_PLAYER_CHANNEL.deck, [report]);

/** The rack the player's host should run (`common/library/playerRack.ts`). */
export const handRackToPlayer = (copy: IPlayerRackCopy): void =>
  send(PLAYER_RACK_CHANNEL, [copy]);

/** The window's Library player is put away; the rack copy says it is back. */
export const putPlayerAway = (): void => send(LIBRARY_PLAYER_CHANNEL.away, []);

/** The window's old copy of the session, once. */
export const handLegacyPlayback = (legacy: unknown): void =>
  send(LIBRARY_PLAYER_CHANNEL.legacy, [legacy]);
