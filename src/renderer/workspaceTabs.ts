/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * The window's places, by name, and which one it was left on.
 *
 * Out of `App.tsx` because the page the window opens on is read twice: by the
 * shell, and before the first frame by `index.tsx`, which fetches that page's
 * code first so the window never opens on an empty page (`workspacePages.ts`).
 */

/** The workspace tab the app was left on. */
export const WORKSPACE_TAB_KEY = 'fluideq.workspaceTab';

export type TWorkspaceTab =
  | 'eq'
  | 'presets'
  | 'convolution'
  | 'dsp'
  | 'share'
  | 'video'
  | 'library'
  | 'karaoke'
  | 'community'
  | 'forum'
  | 'games'
  | 'config';

/**
 * Tab names this build no longer uses, and what they became.
 *
 * Both of the things remembered about a tab — which one you were on, and
 * whether its graph was showing — are keyed by name, so a rename is a silent
 * data loss unless the old name still resolves. `autoeq` became `presets` when
 * the library behind it stopped being AutoEq's.
 */
export const LEGACY_WORKSPACE_TABS: Record<string, TWorkspaceTab> = {
  autoeq: 'presets',
};

/**
 * The tab strip, in the order it is drawn.
 *
 * Config last, and deliberately at the end rather than beside the panels that
 * change the sound. It is the only one that changes nothing — it reports what
 * is on disk — so it is where you go when something is wrong, not somewhere you
 * pass through on the way to a tuning.
 *
 * Reordering this list is safe because what is persisted is the tab's name and
 * not its position: `readWorkspaceTab` looks the stored string up here, so a
 * tab that moves takes its remembered state with it. An index would have sent
 * everybody who left the app on Config to a different tab on the next launch.
 */
export const WORKSPACE_TABS: TWorkspaceTab[] = [
  'eq',
  'presets',
  'convolution',
  'video',
  'library',
  'karaoke',
  'community',
  'forum',
  'dsp',
  'share',
  'games',
  'config',
];

/** A stored tab name, under whatever name that tab had when it was written. */
export const resolveWorkspaceTab = (
  stored: unknown,
): TWorkspaceTab | undefined =>
  typeof stored === 'string'
    ? (WORKSPACE_TABS.find((tab) => tab === stored) ??
      LEGACY_WORKSPACE_TABS[stored])
    : undefined;

/**
 * Which tab to open on.
 *
 * Remembered, which is a departure from the rule the graph's modes follow —
 * solo and full screen are deliberately forgotten, because a mode that outlives
 * a restart is how somebody ends up convinced their bands have vanished. A tab
 * is not that: every one of them is visibly a tab, the one you are on is named
 * in the row, and getting back is one click that is already on screen.
 *
 * And the Video tab is the reason it is worth doing. Something is playing in
 * it. Dropping back to the EQ on every reload stops what was being listened to
 * and puts the app on the pane that was not being used — during development,
 * where a reload happens on every save, that is most of them.
 *
 * Validated against the list rather than cast, because this is storage a user
 * can edit and an older build may have written a name this one no longer has.
 */
export const readWorkspaceTab = (): TWorkspaceTab => {
  try {
    const stored = window.localStorage.getItem(WORKSPACE_TAB_KEY);
    return resolveWorkspaceTab(stored) ?? 'eq';
  } catch {
    // Storage can be unavailable, and the EQ is the right place to land.
    return 'eq';
  }
};
