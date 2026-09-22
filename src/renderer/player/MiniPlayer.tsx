/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import PaneResizer from '../components/PaneResizer';
import { useTranslation } from '../utils/I18nContext';
import EqDeck from './EqDeck';
import FoldStrip from './FoldStrip';
import PlayerBandFloor from './PlayerBandFloor';
import PlayerDeck from './PlayerDeck';
import PlayerTitleStrip, { type TPlayerPage } from './PlayerTitleStrip';
import QueueDeck from './QueueDeck';
import VisDeck from './VisDeck';
import {
  PLAYER_VIS_MIN,
  setPlayerColumns,
  usePlayerDecks,
  usePlayerFold,
  usePlayerVisFull,
  usePlayerVisHeight,
  type TPlayerDeck,
} from './playerLayout';
import usePlayerHeightLimit from './usePlayerHeightLimit';
import { resizePlayerWindow } from './windowModeStore';
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

/**
 * The heights the visualizer and the queue stand at, while they are open.
 *
 * A deck opening or closing may only change the window's height and its own:
 * every other deck stays exactly as tall as it was, however it got there —
 * the divider between these two, or the window grown by hand around whichever
 * of them is taking that growth. So the two are measured as they stand and
 * held at those heights for the measurement that decides how much the window
 * moves by (`--player-held-vis`, `--player-held-queue` in `MiniPlayer.scss`).
 */
interface IHeldHeights {
  vis?: number;
  queue?: number;
}

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
 * The window as a player: the title strip, the deck, and the decks under it
 * — the equalizer, the visualizer, the queue — each opened and closed from
 * the deck's lamps, growing and shrinking the window by what it takes.
 * Folded, one line.
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
  const { t } = useTranslation();
  const host = usePlayerHost();
  const { decks, setDeck } = usePlayerDecks();
  const { isFolded, fold, unfold } = usePlayerFold();
  // One column or two, read off the row itself rather than worked out from
  // the window's width: the stylesheet decides where it splits, and the
  // visualizer keeps a height for each of the two.
  const [columns, setColumns] = useState(1);
  // The visualizer alone on the whole screen: everything else stands down.
  const isVisFull = usePlayerVisFull();
  const { visHeight, setVisHeight, saveVisHeight } =
    usePlayerVisHeight(columns);
  const rootRef = useRef<HTMLDivElement>(null);
  // The layout's height before a deck opened or closed, and the heights the
  // other decks stood at then, until it has drawn.
  const toggled = useRef<{ before: number; held: IHeldHeights } | undefined>(
    undefined,
  );
  // What a drag of the divider is measured from: the visualizer's height
  // when it began, and the most it may take from the queue.
  const dividerStart = useRef({ height: visHeight, most: visHeight });
  // The height the divider last set, for the end of a drag to write down: a
  // keyboard step starts, moves and ends in one handler, before any render.
  const visHeightRef = useRef(visHeight);
  // Whether the visualizer stands as a deck of its own: in two columns, and
  // always on a full screen (see the row below). The same question decides
  // whether the window is held to its decks' height.
  const hasVisDeck = decks.vis && (isVisFull || columns >= 2);
  // Before the resizing effect below, so the hold is let go before the
  // window is asked to grow past it.
  usePlayerHeightLimit(rootRef, decks, hasVisDeck, isFolded);

  /**
   * How tall the player stands when nothing stretches: every deck at its own
   * height, the visualizer and the queue at the heights they are held at, and
   * a deck that has just opened at the height it opens at. Read with the
   * layout switched to those sizes for the one measurement and back before
   * anything is painted.
   */
  const naturalHeight = (held: IHeldHeights) => {
    const root = rootRef.current;
    if (!root) {
      return 0;
    }
    root.classList.add('is-measuring');
    if (held.vis !== undefined) {
      root.style.setProperty('--player-held-vis', `${held.vis}px`);
    }
    if (held.queue !== undefined) {
      root.style.setProperty('--player-held-queue', `${held.queue}px`);
    }
    const { height } = root.getBoundingClientRect();
    root.classList.remove('is-measuring');
    root.style.removeProperty('--player-held-vis');
    root.style.removeProperty('--player-held-queue');
    return height;
  };

  /** What the two stretching decks measure right now, while they are open. */
  const heldHeights = (): IHeldHeights => {
    const heightOf = (deck: string) =>
      rootRef.current?.querySelector<HTMLElement>(deck)?.getBoundingClientRect()
        .height;
    return { vis: heightOf('.player-vis'), queue: heightOf('.player-queue') };
  };

  const toggleDeck = (deck: TPlayerDeck) => {
    const held = heldHeights();
    // The visualizer is written down at the height it stands at whenever it
    // stops being the deck that takes the window's growth: when the queue
    // opens under it, so it keeps that height rather than snapping back, and
    // when it closes, so it opens again as tall as it was left.
    if (
      held.vis !== undefined &&
      (deck === 'vis' || (deck === 'queue' && !decks.queue))
    ) {
      const kept = Math.max(PLAYER_VIS_MIN, Math.round(held.vis));
      visHeightRef.current = kept;
      setVisHeight(kept);
      saveVisHeight(kept);
    }
    toggled.current = { before: naturalHeight(held), held };
    setDeck(deck, !decks[deck]);
  };

  // A deck opening grows the window by what it takes and a deck closing
  // gives that back, so a player made taller by hand stays that much taller
  // and every deck but the one toggled keeps the height it had.
  useLayoutEffect(() => {
    const change = toggled.current;
    toggled.current = undefined;
    if (change === undefined) {
      return;
    }
    const grown = naturalHeight(change.held) - change.before;
    if (Math.abs(grown) >= 1) {
      resizePlayerWindow(window.innerHeight + grown).catch(() => undefined);
    }
  }, [decks]);

  // How many columns the deck row is in, followed as the window is dragged.
  useLayoutEffect(() => {
    const row =
      rootRef.current?.querySelector<HTMLElement>('.player-body__row');
    if (!row || typeof ResizeObserver === 'undefined') {
      return undefined;
    }
    const read = () => {
      const count = getComputedStyle(row)
        .gridTemplateColumns.split(' ')
        .filter((track) => track.length > 0).length;
      setColumns(count);
      // Published as well as kept, because it decides where the visualizer
      // is drawn two floors down (`playerLayout.ts`).
      setPlayerColumns(count);
    };
    read();
    const observer = new ResizeObserver(read);
    observer.observe(row);
    return () => observer.disconnect();
  }, [isFolded]);

  // Focus inside the player, so the keys typed there are the player's: a
  // press on something that takes no focus of its own lands on the player.
  useEffect(() => {
    rootRef.current?.focus({ preventScroll: true });
  }, [isFolded]);

  /**
   * The divider between the visualizer and the queue: the visualizer takes
   * height from the queue or gives it back, never less than its own floor
   * nor more than leaves the queue its own. The two floors are read off the
   * decks' own styles when the drag begins, so they are said once, there.
   */
  const startDivider = () => {
    const vis = rootRef.current?.querySelector<HTMLElement>('.player-vis');
    const queue = rootRef.current?.querySelector<HTMLElement>('.player-queue');
    if (!vis || !queue) {
      return;
    }
    const { height } = vis.getBoundingClientRect();
    const queueFloor = parseFloat(getComputedStyle(queue).minHeight) || 0;
    dividerStart.current = {
      height,
      most: Math.max(
        PLAYER_VIS_MIN,
        height + queue.getBoundingClientRect().height - queueFloor,
      ),
    };
  };
  const dragDivider = (deltaY: number) => {
    const { height, most } = dividerStart.current;
    const next = Math.round(
      Math.min(most, Math.max(PLAYER_VIS_MIN, height + deltaY)),
    );
    visHeightRef.current = next;
    setVisHeight(next);
  };
  const dividerPercent = (() => {
    const { most } = dividerStart.current;
    const span = most - PLAYER_VIS_MIN;
    return span > 0
      ? Math.round(
          Math.min(
            100,
            Math.max(0, ((visHeight - PLAYER_VIS_MIN) / span) * 100),
          ),
        )
      : 0;
  })();

  return createPortal(
    <div
      ref={rootRef}
      className={`mini-player${isFolded ? ' is-folded' : ''}${
        isVisFull ? ' is-vis-full' : ''
      }`}
      tabIndex={-1}
      role="region"
      aria-label={t('player.aria')}
    >
      <PlayerBandFloor rootRef={rootRef} />
      {isFolded ? (
        <FoldStrip onUnfold={unfold} />
      ) : (
        <>
          <PlayerTitleStrip onFold={fold} onOpenPage={onOpenPage} />
          <div className="player-body">
            <div className="player-body__row">
              <PlayerDeck decks={decks} onToggleDeck={toggleDeck} />
              {decks.eq && <EqDeck />}
            </div>
            {/* A DECK OF ITS OWN IN TWO COLUMNS, and always on a full
                screen. Stacked, the player is tall enough without a third
                block and the visualizer is drawn inside the equalizer's
                screen instead (`useIsVisInsideCurve`).

                `isVisFull` has to be asked as well, and not only
                `columns`: full screen hides the deck row's contents, an
                `auto-fit` grid with nothing in it collapses to one track,
                and the column count then read as one — so the one-column
                rule withheld the visualizer from the one place it was the
                only thing on screen, and full screen was a black window
                (Ivan, 2026-09-22). */}
            {hasVisDeck && <VisDeck height={visHeight} />}
            {hasVisDeck && !isVisFull && decks.queue && (
              <PaneResizer
                ariaLabel={t('player.vis.resize')}
                valuePercent={dividerPercent}
                onStart={startDivider}
                onDrag={dragDivider}
                onEnd={() => saveVisHeight(visHeightRef.current)}
              />
            )}
            {decks.queue && (
              <QueueDeck onOpenLibrary={() => onOpenPage('library')} />
            )}
          </div>
        </>
      )}
    </div>,
    host,
  );
};

export default MiniPlayer;
