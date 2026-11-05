/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { useEffect, useRef } from 'react';
import { useTranslation } from '../utils/I18nContext';
import toastColours from './toastColours';
import { useGameSound } from './useGameSound';
import { SoundingTunedWatch } from './useGamingData';

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
 * The one place a game's sound is actually switched, and the one that says so.
 *
 * Headless, and mounted beside the app's other headless engines for the same
 * reason: a game comes to the front while FluidEQ is behind it, and a switch
 * that lived on the Gaming Lab would only work while somebody was looking at
 * the Gaming Lab — which is the one moment nobody is playing. Mounted once,
 * so one caller decides what to put back.
 *
 * What it says goes to main and not onto this page, for the same reason
 * again: this window is behind the game or minimised. Main draws it on the
 * desktop, on the screen the game is on (`gameToast.ts`). The words are made
 * here, because the listener's language is the window's.
 */
const GameSound = () => {
  const { t } = useTranslation();
  const { switched, forgetSwitch, playing, sounding } = useGameSound({
    applies: true,
  });
  // Read when a switch arrives rather than closed over, so a change of
  // language does not run the effect again.
  const latest = useRef(t);
  latest.current = t;

  useEffect(() => {
    if (!switched) {
      return;
    }
    const say = latest.current;
    const back = switched.kind === 'restored';
    const bridge = window.electron?.ipcRenderer as IGameToastBridge | undefined;
    bridge?.showGameToast?.({
      what: back ? say('gaming.toast.restored') : say('gaming.toast.loaded'),
      game: back
        ? say('games.toast.afterGame', { game: switched.game })
        : say('games.toast.forGame', { game: switched.game }),
      ...(switched.icon ? { icon: switched.icon } : {}),
      colors: toastColours(),
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

  // Whether the game's copy on now is tuned, for the presets pick to say so
  // wherever it stands (the EQ page, the player).
  return <SoundingTunedWatch gameId={sounding?.id} />;
};

export default GameSound;
