/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { useEffect, useRef } from 'react';
import { useDspPresetCatalog } from '../dsp/dspPresetCatalog';
import { useTranslation } from '../utils/I18nContext';
import { useGameSound } from './useGameSound';

interface IGameToastBridge {
  showGameToast?: (said: {
    what: string;
    game: string;
    icon?: string;
    colors?: Record<string, string>;
  }) => void;
  setGamePlaying?: (playing: boolean) => void;
}

/**
 * The five colours the card is painted with, as this window wears them now.
 *
 * Read rather than remembered: a listener switches theme, and a scene tints
 * the whole window with its own accent over whichever theme that is. The card
 * is drawn by a file on disk that has none of this app's stylesheets, so the
 * answer has to travel with the card, and it has to be the answer at the
 * moment the card is asked for.
 */
const windowColours = (): Record<string, string> => {
  const style = getComputedStyle(document.documentElement);
  const found: Record<string, string> = {};
  const take = (name: string, token: string) => {
    const value = style.getPropertyValue(token).trim();
    if (value !== '') {
      found[name] = value;
    }
  };
  take('accent', '--accent');
  take('panel', '--surface-panel');
  take('base', '--surface-base');
  take('text', '--text-primary');
  take('muted', '--text-muted');
  return found;
};

/**
 * The one place a game's sound is actually switched, and the one that says so.
 *
 * Headless, and mounted beside the app's other headless engines for the same
 * reason: a game comes to the front while FluidEQ is behind it, and a switch
 * that lived on the Games page would only work while somebody was looking at
 * the Games page — which is the one moment nobody is playing. Mounted once,
 * so one memory decides what to put back.
 *
 * What it says goes to main and not onto this page, for the same reason
 * again: this window is behind the game or minimised. Main draws it on the
 * desktop, on the screen the game is on (`gameToast.ts`). The words are made
 * here, because the chain's name and the listener's language are the window's.
 */
const GameSound = () => {
  const { t } = useTranslation();
  const { catalog } = useDspPresetCatalog(t);
  const { switched, forgetSwitch, playing } = useGameSound({ applies: true });
  // Read when a switch arrives rather than closed over: a listener renames
  // nothing, but the catalogue is rebuilt whenever their saved chains change.
  const latest = useRef({ catalog, t });
  latest.current = { catalog, t };

  useEffect(() => {
    if (!switched) {
      return;
    }
    const { catalog: known, t: say } = latest.current;
    const named = known.find((one) => one.id === switched.presetId)?.name;
    const back = switched.kind === 'restored';
    // A restore to nothing is the rack going off, which has no name in the
    // catalogue: "Custom" there would be the card inventing a chain.
    const preset = named ?? say('dsp.eqPreset.custom');
    const wentBack =
      switched.presetId === ''
        ? say('games.toast.restoredNone')
        : say('games.toast.restored', { preset });
    const bridge = window.electron?.ipcRenderer as IGameToastBridge | undefined;
    bridge?.showGameToast?.({
      what: back ? wentBack : say('games.toast.loaded', { preset }),
      game: back
        ? say('games.toast.afterGame', { game: switched.game })
        : say('games.toast.forGame', { game: switched.game }),
      ...(switched.icon ? { icon: switched.icon } : {}),
      colors: windowColours(),
    });
    forgetSwitch();
  }, [switched, forgetSwitch]);

  // The desktop backgrounds hold still while a game is in front: they and the
  // game draw on the same graphics card, and the game is the one that matters.
  // Main is told from here because only this window knows which of the
  // programs Windows puts in front are this listener's games.
  useEffect(() => {
    const bridge = window.electron?.ipcRenderer as IGameToastBridge | undefined;
    bridge?.setGamePlaying?.(playing !== undefined);
  }, [playing]);

  return null;
};

export default GameSound;
