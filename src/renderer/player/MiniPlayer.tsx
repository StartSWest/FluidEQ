/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { useLayoutEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import useIsBackdrop from '../utils/useIsBackdrop';
import ClassicAmp from './classic/ClassicAmp';
import StageAmp from './StageAmp';
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

/** Which amp the window is: the glass Stage, or the 2.0 amp. */
export type TAmp = 'stage' | 'classic';

/**
 * The window as a player — one of two, the way the full app is one of two
 * (Ivan, 2026-09-28: "when ambient is set to backdrop we do this one, but
 * when set to other than that we do the other one we used to have, similar
 * to what the app does"). With the Backdrop the amp is the Stage, its panes
 * glass floating over the picture (`StageAmp`); in every other mode it is the
 * 2.0 amp, solid decks on the window's floor (`ClassicAmp`).
 *
 * Both are drawn outside the app's own root, which stays mounted and hidden
 * while the window is the player, so everything that plays keeps playing and
 * nothing the app listens for hears the player's keys (`stopAtHost`).
 *
 * THE DOCUMENT SAYS WHICH (`data-amp` on its root). The two amps were built
 * with the same class names for the same parts — a title strip, a deck of
 * equalizer keys, a queue — and each one's stylesheet is scoped to its own
 * word (`MiniPlayer.scss`), so neither ever paints the other. On the root and
 * not on the amp, because the amp's menus are portalled to the foot of the
 * document and are the amp's too.
 */
const MiniPlayer = ({
  onOpenPage,
}: {
  onOpenPage: (page: TPlayerPage) => void;
}) => {
  const host = usePlayerHost();
  const amp: TAmp = useIsBackdrop() ? 'stage' : 'classic';
  useLayoutEffect(() => {
    const root = document.documentElement;
    root.dataset.amp = amp;
    return () => {
      delete root.dataset.amp;
    };
  }, [amp]);
  return createPortal(
    amp === 'stage' ? (
      <StageAmp onOpenPage={onOpenPage} />
    ) : (
      <ClassicAmp onOpenPage={onOpenPage} />
    ),
    host,
  );
};

export default MiniPlayer;
