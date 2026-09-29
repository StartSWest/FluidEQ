/*
<AQUA: System-wide parametric audio equalizer interface>
Copyright (C) <2023>  <AQUA Dev Team>
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

import {
  LEGACY_WORKSPACE_TABS,
  WORKSPACE_TABS,
  type TWorkspaceTab,
} from '../workspaceTabs';

/**
 * The five tabs that are one place: the equaliser and the things that set it.
 *
 * The strip had grown to eight, which is not a row of tabs any more but a
 * menu bar somebody has to read. Four of these are the same subject seen from
 * different sides — the bands, the presets that fill them, the voicing over
 * them, the impulse under them — and Config is the one that reports what is
 * on disk when a tuning is not doing what it should. They live behind one
 * tab, with a row of pills inside it, and the strip is left with the four
 * things that are genuinely different places: EQ, Media, Library, Karaoke,
 * and DSP. Everything behind EQ writes or inspects Equalizer APO; DSP has its
 * own top-level destination because it processes only FluidEQ's player.
 *
 * Config last among them, for the reason it was last in the strip: it is the
 * only one that changes nothing, so it is where you go when something is
 * wrong rather than somewhere you pass through on the way to a tuning.
 */
export const EQ_GROUP_TABS: readonly TWorkspaceTab[] = [
  'eq',
  'presets',
  'convolution',
  'games',
  'config',
];

export const EQ_GROUP_LABEL_KEYS = {
  eq: 'tabs.eqMain',
  presets: 'tabs.presets',
  convolution: 'tabs.convolution',
  games: 'tabs.games',
  config: 'tabs.config',
} as const;

/**
 * The width below which the media tab is named in one word instead of two.
 *
 * 1280 is where the titlebar already stops giving everything its full
 * presentation — the meter drops from 420px to 320 and both outer tracks
 * start being sized from their contents. Everything the strip does below that
 * only makes the words smaller, which is not enough for a name that runs to
 * "Multimedia en línea" in Spanish and "オンラインメディア" in Japanese: at
 * five tabs those two extra words cost more room than the whole EQ tab.
 *
 * So the qualifier goes and the noun stays. It costs nothing to lose, because
 * this is the only place in the app that plays anything from a URL — "online"
 * says which media tab only while there is room to say it.
 */
export const MEDIA_TAB_ONE_WORD_QUERY = '(max-width: 1280px)';

/**
 * A laptop's height: `$bp-laptop-height` in `_constant.scss`, where the shell
 * puts its chrome away. Here it is where a page other than the EQ's keeps its
 * own split, with the graph starting as a strip (`shortWindowPaneKey`).
 */
export const SHORT_WINDOW_QUERY = '(max-height: 900px)';

/**
 * `$bp-three-column` in `_constant.scss`: under it the sound panel is a rail
 * that opens over the page rather than a column beside it, so its button
 * opens and shuts the drawer instead of folding the column.
 */
export const SOUND_PANE_DRAWER_QUERY = '(max-width: 1560px)';

export const isEqGroupTab = (tab: TWorkspaceTab): boolean =>
  EQ_GROUP_TABS.includes(tab);

const FULLSCREEN_MEDIA_TABS: readonly TWorkspaceTab[] = [
  'video',
  'library',
  'karaoke',
];

export const isFullscreenMediaTab = (tab: TWorkspaceTab): boolean =>
  FULLSCREEN_MEDIA_TABS.includes(tab);

/** Independent response-graph visibility overrides for each workspace tab. */
export const GRAPH_VISIBILITY_BY_TAB_KEY = 'fluideq.graphVisibilityByTab';

export type TWorkspaceGraphVisibility = Partial<Record<TWorkspaceTab, boolean>>;

export const readWorkspaceGraphVisibility = ():
  TWorkspaceGraphVisibility | undefined => {
  try {
    const stored = window.localStorage.getItem(GRAPH_VISIBILITY_BY_TAB_KEY);
    if (!stored) {
      return undefined;
    }
    const parsed = JSON.parse(stored) as Record<string, unknown>;
    const visibility: TWorkspaceGraphVisibility = {};
    // Retired names first and current names second, so that if a profile holds
    // both, what was written under today's name wins regardless of key order.
    Object.entries(LEGACY_WORKSPACE_TABS).forEach(([legacy, tab]) => {
      if (typeof parsed?.[legacy] === 'boolean') {
        visibility[tab] = parsed[legacy] as boolean;
      }
    });
    WORKSPACE_TABS.forEach((tab) => {
      if (typeof parsed?.[tab] === 'boolean') {
        visibility[tab] = parsed[tab] as boolean;
      }
    });
    return Object.keys(visibility).length ? visibility : undefined;
  } catch {
    return undefined;
  }
};
