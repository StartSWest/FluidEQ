/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * A window hidden in the tray, let go when nothing needs it, and built again
 * when it is opened (the core split's step 7).
 *
 * The close button hides the window rather than quitting (`tray.ts`), and a
 * hidden window is still a whole Chromium page: its renderer, its GPU work
 * and every store it holds, for somebody who has put it away and may not open
 * it again until tomorrow. Main now does the app's work without it — the
 * engine, the outputs, the Library's player, game sound, Auto normalize — so
 * a window in the tray that holds nothing is destroyed, and the tray, a second
 * launch or the Dock builds a new one, which opens on the same state because
 * main kept it.
 *
 * WHAT HOLDS IT. The page says what it is doing that only it can do
 * (`common/windowHold.ts`): a web player or Karaoke playing, the Library heard
 * from it or from the host whose rack it hands back, the Maker's models.
 * Main holds it for what main learns first: the song memories' clock where
 * the core cannot hear the output (the window's players tick it), the desk
 * lights drawn by the page, Share Audio's links that it answers, the
 * desktop's backgrounds that hear the music through it where the core
 * cannot, and the Studio's door and chat, whose scenes it draws. Any one of
 * them keeps the window. The songs themselves main names while there is no
 * window (`nowPlayingFeed.ts`).
 *
 * A PAGE THAT HAS NOT SPOKEN HOLDS IT. Until the page loading says what it
 * holds, it is not idle — it is starting — so a window hidden at launch
 * (`startsHidden`) waits for the page's first word, and a page that crashed
 * or is reloading holds it until the next one has spoken.
 */
import type { TWindowHold } from '../common/windowHold';

/** What main keeps the window loaded for; see the note above. */
export type TMainWindowHold =
  | 'songs'
  | 'lighting'
  | 'share-audio'
  | 'desktop-sound'
  | 'studio-chat'
  | 'studio-agent';

export interface IWindowUnload {
  /** The page's holds, every time they change. */
  pageSaid: (holds: readonly TWindowHold[]) => void;
  /** The page went — reloading, crashed, or gone with its window. */
  pageLeft: () => void;
  /** Hidden into the tray (true), or shown again (false). */
  hiddenInTray: (isHidden: boolean) => void;
  /** One of main's own holds, on or off. */
  hold: (reason: TMainWindowHold, isHeld: boolean) => void;
}

export interface IWindowUnloadDeps {
  /** Destroys the window; main builds a new one when it is opened. */
  unload: () => void;
  log: (message: string) => void;
}

export const createWindowUnload = ({
  unload,
  log,
}: IWindowUnloadDeps): IWindowUnload => {
  /** What the page last said; `undefined` while no page has spoken. */
  let pageHolds: readonly TWindowHold[] | undefined;
  let isHidden = false;
  const mainHolds = new Set<TMainWindowHold>();

  const holding = (): string[] => [
    ...(pageHolds ?? ['the page loading']),
    ...mainHolds,
  ];

  const decide = () => {
    if (!isHidden || holding().length > 0) {
      return;
    }
    // Forgotten before the window goes: the next window starts shown, and
    // its page has said nothing yet.
    isHidden = false;
    pageHolds = undefined;
    log('The window is in the tray with nothing to do: letting it go.');
    unload();
  };

  return {
    pageSaid: (holds) => {
      pageHolds = holds;
      decide();
    },
    pageLeft: () => {
      pageHolds = undefined;
    },
    hiddenInTray: (hidden) => {
      isHidden = hidden;
      const kept = holding();
      if (hidden && kept.length > 0) {
        // Said once per hide, so a report can tell why a window in the tray
        // was still using memory.
        log(`The window stays loaded in the tray for: ${kept.join(', ')}.`);
      }
      decide();
    },
    hold: (reason, isHeld) => {
      if (isHeld) {
        mainHolds.add(reason);
      } else {
        mainHolds.delete(reason);
      }
      decide();
    },
  };
};
