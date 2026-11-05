/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * Which game's own sound the playing output has on, as main says, kept for
 * every surface that has to show it: the Gaming Lab, the DSP page while it
 * is paused, the bar at the foot of the window.
 *
 * Asked again whenever main says the output's sound changed — a game's sound
 * going on or off is exactly that — and after the window's own requests,
 * which say so too. Nothing here guesses: an answer that has not come yet is
 * "no game", the state every output starts in.
 */

import { useEffect, useState } from 'react';
import type { IGameSoundState } from '../../common/gaming';
import { readGameSoundState } from '../utils/gamingApi';
import { reportError } from '../utils/logger';

const CHANGED = 'fluideq-game-sound-changed';

let now: IGameSoundState = {};

/**
 * Main builds the answer the same way every time (`clampDspSettings` lays
 * the rack out in one order), so the same state reads as the same text.
 */
const take = (next: IGameSoundState): void => {
  if (JSON.stringify(next) === JSON.stringify(now)) {
    return;
  }
  now = next;
  window.dispatchEvent(new Event(CHANGED));
};

/**
 * Ask main again; every caller is told through the event.
 *
 * Where there is no main to ask (a test, a drawing of the page), nothing is
 * asked and the state stays "no game", as an unanswered one does — the
 * stores beside it check the bridge the same way. The check is for the one
 * thing a request is sent through: a bridge stood in with only its
 * listeners (the media transport's tests) is no way to ask either, and
 * asking through it logged a TypeError in every one of them. A request that
 * fails as it is sent is reported like one main refused: sent from a plain
 * function, the bridge's own TypeError escaped into the effect that asked
 * and failed every test that rendered the EQ page's quick pick (10. DSP,
 * 2026-11-03).
 */
export const refreshGameSoundState = async (): Promise<void> => {
  if (typeof window.electron?.ipcRenderer?.sendMessage !== 'function') {
    return;
  }
  try {
    take(await readGameSoundState());
  } catch (error: unknown) {
    reportError('Could not read which game’s sound is on', error);
  }
};

/** For a test that starts from nothing, as a fresh window would. */
export const resetGameSoundState = (): void => {
  now = {};
};

export const readLoadedGame = (): IGameSoundState => now;

let listening = false;

const listen = (): void => {
  if (listening) {
    return;
  }
  listening = true;
  // Never rejects: it reports its own failures.
  window.addEventListener('fluideq-output-changed', () => {
    refreshGameSoundState();
  });
  refreshGameSoundState();
};

/** Which game's sound is on, re-rendered whenever that changes. */
export const useLoadedGame = (): IGameSoundState => {
  const [state, setState] = useState(now);
  useEffect(() => {
    listen();
    const changed = () => setState(now);
    window.addEventListener(CHANGED, changed);
    changed();
    return () => window.removeEventListener(CHANGED, changed);
  }, []);
  return state;
};
