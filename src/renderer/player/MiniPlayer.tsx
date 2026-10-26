/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { useLayoutEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { setAmpHoldsWindow } from '../utils/sceneTintStore';
import PlayerAmp from './PlayerAmp';
import type { TPlayerPage } from './PlayerTitleStrip';
import '../styles/MiniPlayer.scss';

/**
 * The keys the full app may still hear from inside the player.
 *
 * The app stays mounted behind the player, and its shortcuts listen on the
 * whole window: Ctrl+F would put the graph in full screen, Ctrl+A and Delete
 * would take bands nobody can see. Nothing typed in the player gets past its
 * own host but these two — Escape, which every menu borrowed from the app
 * closes on from the window, and Tab.
 */
const PASSES_TO_THE_APP = new Set(['Escape', 'Tab']);

const stopAtHost = (event: KeyboardEvent) => {
  if (!PASSES_TO_THE_APP.has(event.key)) {
    event.stopPropagation();
  }
};

/** The player's own place in the document, beside the app's and not in it. */
const usePlayerHost = () => {
  const [host] = useState(() => {
    const outer = document.createElement('div');
    outer.className = 'mini-player-host';
    const inner = document.createElement('div');
    inner.className = 'mini-player-host__root';
    outer.appendChild(inner);
    return { outer, inner };
  });
  useLayoutEffect(() => {
    const { outer } = host;
    document.body.appendChild(outer);
    // On the outer box, so React — listening on the inner one, where the
    // portal is — has already dispatched the event to the player.
    outer.addEventListener('keydown', stopAtHost);
    outer.addEventListener('keyup', stopAtHost);
    return () => {
      outer.removeEventListener('keydown', stopAtHost);
      outer.removeEventListener('keyup', stopAtHost);
      outer.remove();
    };
  }, [host]);
  return host.inner;
};

/**
 * The amp's word on the document (`data-amp` on its root), said before
 * anything inside the amp measures itself: it stands before the amp in the
 * tree, and React runs an earlier sibling's layout effects first. The amp's
 * stylesheet applies under that word alone (`MiniPlayer.scss`) — on the root
 * and not on the amp, because the amp's menus are portalled to the foot of
 * the document and are the amp's too.
 */
const AmpMark = () => {
  useLayoutEffect(() => {
    const root = document.documentElement;
    root.dataset.amp = '';
    // And the window is the Backdrop while the amp holds it, whatever the
    // app's colour mode (`setAmpHoldsWindow`).
    setAmpHoldsWindow(true);
    return () => {
      delete root.dataset.amp;
      setAmpHoldsWindow(false);
    };
  }, []);
  return null;
};

/**
 * The window as a player: the one amp (Ivan, 2026-10-25: "an unified amp ui
 * so we only have one mode"), whatever the window colours are (`PlayerAmp`).
 *
 * Drawn outside the app's own root, which stays mounted and hidden while the
 * window is the player, so everything that plays keeps playing and nothing
 * the app listens for hears the player's keys (`stopAtHost`).
 */
const MiniPlayer = ({
  onOpenPage,
}: {
  onOpenPage: (page: TPlayerPage) => void;
}) => {
  const host = usePlayerHost();
  return (
    <>
      <AmpMark />
      {createPortal(<PlayerAmp onOpenPage={onOpenPage} />, host)}
    </>
  );
};

export default MiniPlayer;
