/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * Who in the window still wants the game watcher running.
 *
 * Two do: the switch itself, while there is a profile to match, and the Games
 * page, so it can say what is in front while a profile is being made. Each
 * asking main directly meant leaving the page stopped the watcher a listener
 * was relying on, mid-game. They ask here instead, and main hears one answer.
 */

interface IGameWatchBridge {
  watchGames?: (wanted: boolean) => void;
}

let wanting = 0;
let told = false;

const tell = (wanted: boolean) => {
  if (wanted === told) {
    return;
  }
  told = wanted;
  const bridge = window.electron?.ipcRenderer as IGameWatchBridge | undefined;
  bridge?.watchGames?.(wanted);
};

/** Ask for the watcher; the answer stops wanting it. */
export const requestGameWatch = (): (() => void) => {
  wanting += 1;
  tell(true);
  let released = false;
  return () => {
    if (released) {
      return;
    }
    released = true;
    wanting -= 1;
    tell(wanting > 0);
  };
};

/** For a test that starts from nothing, as a fresh window would. */
export const resetGameWatchRequests = (): void => {
  wanting = 0;
  told = false;
};
