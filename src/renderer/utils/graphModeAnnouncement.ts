/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU General Public License as published by
the Free Software Foundation, either version 3 of the License, or
(at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
GNU General Public License for more details.

You should have received a copy of the GNU General Public License
along with this program.  If not, see <https://www.gnu.org/licenses/>.
*/

import { useSyncExternalStore } from 'react';
import type { TranslationKey } from 'common/i18n/en';

// The line the graph shows as it changes mode - expanded, full screen, a
// look - and how long it stays.

/**
 * What the plot just became, said once in the middle of it.
 *
 * A shortcut that changes five things at once is fast to use and impossible to
 * learn: the drawing rearranges and nothing says which of the five you are now
 * in or how many are left. Naming it for a moment turns the key into something
 * somebody can walk without counting.
 *
 * Only for the key. Choosing a state deliberately from the menu or the legend
 * does not need to be told what it did — the control that was pressed says so,
 * and a caption appearing over the graph in answer to a press on the graph's own
 * legend is the app talking over the user.
 *
 * A store rather than state on the chart, because the thing that fires it is a
 * window key handler and the thing that draws it is a div three components down.
 *
 * How long it stays is the caption's own animation (`graph-mode-announce` in
 * `GraphTheme.scss`), and its end is what takes the caption away
 * (`endGraphModeAnnouncement`). It was a timer here of the same length as that
 * animation — two clocks, agreeing only while the window painted; behind a
 * minimised window the timer ran and the caption was gone before anyone saw it.
 */
export interface IGraphModeAnnouncement {
  /**
   * What is said, as the key of its words, so the caption is in the language
   * on screen; empty when nothing is. It was the English words themselves,
   * and every caption but one stayed English in every other language.
   */
  label: TranslationKey | '';
  /** Bumped per announcement, so the same mode twice still reads as twice. */
  id: number;
}

/**
 * One value, replaced whole, so that the caption ending is a change a render
 * can see. The snapshot used to be the id alone, which an ending does not
 * move: the words were cleared and nothing re-rendered, so the caption stayed
 * mounted, faded to nothing, until something else redrew the chart.
 */
let announcement: IGraphModeAnnouncement = { label: '', id: 0 };

const announcementListeners = new Set<() => void>();

const emitAnnouncement = () => {
  announcementListeners.forEach((listener) => listener());
};

export const announceGraphMode = (label: TranslationKey) => {
  // No chart mounted, nobody to say it to — and said anyway, it would wait
  // for the next chart to mount and name a key pressed long before.
  if (announcementListeners.size === 0) {
    return;
  }
  announcement = { label, id: announcement.id + 1 };
  emitAnnouncement();
};

/**
 * The caption named by `id` has been shown, so it is over.
 *
 * By id: a key pressed again while a caption is up replaces it with a new one,
 * and the old one's end must not take the new one down.
 */
export const endGraphModeAnnouncement = (id: number) => {
  if (id !== announcement.id || announcement.label === '') {
    return;
  }
  announcement = { label: '', id };
  emitAnnouncement();
};

const subscribeAnnouncement = (listener: () => void) => {
  announcementListeners.add(listener);
  return () => {
    announcementListeners.delete(listener);
    // The chart that showed it has gone — another tab opened — and the
    // animation that would have ended it with it. Kept, the caption would
    // come back over the next chart mounted, naming a key pressed long ago.
    if (announcementListeners.size === 0 && announcement.label !== '') {
      announcement = { label: '', id: announcement.id };
    }
  };
};

/**
 * The caption and a key that changes with every announcement.
 *
 * The key is what lets the same words animate again: React reuses an element
 * whose key has not changed, so cycling back to a mode you were in a moment ago
 * would otherwise put the caption up with its entrance already over.
 */
export const useGraphModeAnnouncement = (): IGraphModeAnnouncement =>
  useSyncExternalStore(
    subscribeAnnouncement,
    () => announcement,
    () => announcement,
  );
