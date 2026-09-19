/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * What the rest of the machine is playing, by whichever means this platform
 * has for saying so.
 *
 * Every operating system answers this differently and none of the answers
 * resemble each other: Windows publishes every player's session through WinRT
 * (`systemMedia.ts`, reached through PowerShell), macOS closed its system-wide
 * equivalent to third-party apps in 15.4 and leaves the broadcasts individual
 * players make (`systemMediaMac.ts`). What they share is the shape the bar is
 * drawn from — `ISystemMediaSnapshot` — and the five things the window can ask
 * for, so that is the whole of this interface.
 *
 * One source per platform rather than a platform test inside each function:
 * main started the Windows watcher on a Mac because nothing stood between the
 * window's request and a PowerShell spawn, and the launch died of it. A
 * platform with no source gets one that says, truthfully, that nothing is
 * known to be playing — it does not get somebody else's.
 */
import { sendMediaTransportKey } from './mediaKeys';
import {
  ISystemMediaSnapshot,
  TSystemMediaCommand,
  pauseOtherSystemPlayers,
  sendSystemMediaCommand,
  stopWatchingSystemMedia,
  watchSystemMedia,
} from './systemMedia';
import { macSystemMediaSource } from './systemMediaMac';

export interface ISystemMediaSource {
  /** Start reporting; the subscriber is always answered at least once. */
  watch(onSnapshot: (snapshot: ISystemMediaSnapshot | undefined) => void): void;
  stopWatching(): void;
  sendCommand(command: TSystemMediaCommand, positionMs?: number): Promise<void>;
  /** Pause every other program that is playing, sparing the one named. */
  pauseOthers(exceptApp: string): Promise<void>;
  /** The titlebar's previous / play-pause / next, by name. */
  sendTransportKey(action: unknown): Promise<void>;
}

/** Windows: exactly the functions main called before this file existed. */
const windowsSource: ISystemMediaSource = {
  watch: watchSystemMedia,
  stopWatching: stopWatchingSystemMedia,
  sendCommand: sendSystemMediaCommand,
  pauseOthers: pauseOtherSystemPlayers,
  sendTransportKey: sendMediaTransportKey,
};

/**
 * A platform this app has no way of asking. The subscriber is still answered,
 * because a window that asked and heard nothing cannot tell "nothing is
 * playing" from "still starting".
 */
const noSource: ISystemMediaSource = {
  watch: (onSnapshot) => onSnapshot(undefined),
  stopWatching: () => undefined,
  sendCommand: async () => undefined,
  pauseOthers: async () => undefined,
  sendTransportKey: async () => undefined,
};

/** macOS: what Music and Spotify broadcast about themselves. */
const macSource: ISystemMediaSource = macSystemMediaSource;

export const systemMediaSourceFor = (
  platform: NodeJS.Platform,
): ISystemMediaSource => {
  if (platform === 'win32') {
    return windowsSource;
  }
  return platform === 'darwin' ? macSource : noSource;
};
