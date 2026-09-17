/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * One order and one set of group names for the settings a visualizer has,
 * followed by both places they are offered: the graph's View menu and the
 * Studio.
 *
 * The two surfaces grew apart. The same five things — the grid, the wave's
 * height and position, the scene's own controls, how it answers the music,
 * and how hard it may drive the graphics card — sat in a different order on
 * each, under different headings, mixed in among rows that exist on only one
 * of them. A member tuning a scene in the Studio and then looking at it on
 * the graph had to find every control twice. Ivan, looking at the menu:
 * "this is a mess".
 *
 * So the order lives here and nowhere else, and each surface renders it in
 * its own way — the menu as rows with icons and shortcuts, the Studio as
 * cards with headings and sliders. Same order, same grouping, same names;
 * two looks, because a menu that floats over the graph and a card in a
 * column are not the same thing and should not pretend to be.
 *
 * `settingsGroups.test.ts` holds both surfaces to this list, so a row added
 * to one and not the other, or added in the wrong place, is a failing test
 * rather than something nobody notices until the two are compared.
 */

import type { TranslationKey } from './i18n/en';

/**
 * The groups every surface shows, in the order it shows them.
 *
 * `own` is each surface's own — the graph's view modes, the Studio's preview
 * audio — and is deliberately last in this list and first on the surface:
 * what a surface alone can do belongs at the top of it, and what the two
 * share has to read the same way down the rest.
 */
export const SETTINGS_GROUPS = [
  'picture',
  'visualizer',
  'drawing',
  'own',
] as const;

export type TSettingsGroup = (typeof SETTINGS_GROUPS)[number];

/**
 * What each shared group is called, in both places, word for word: the
 * headings are half of what makes the two read as one arrangement.
 */
export const SETTINGS_GROUP_TITLE: Record<
  Exclude<TSettingsGroup, 'own'>,
  TranslationKey
> = {
  picture: 'settings.group.picture',
  visualizer: 'settings.group.visualizer',
  drawing: 'settings.group.drawing',
};

/**
 * The one group whose name differs, because its rows do: on the graph it is
 * about the window the picture is drawn in, and in the Studio it is about
 * testing a scene that is not finished. Naming it for what it holds is what
 * makes the separation Ivan asked for visible — everything under it is this
 * surface's alone, everything below it is on both.
 */
export const OWN_GROUP_TITLE: Record<'graph' | 'studio', TranslationKey> = {
  graph: 'settings.group.thisView',
  studio: 'settings.group.studioOnly',
};

/**
 * Every row either surface offers, in the order it is offered, and where it
 * exists.
 *
 * `both` is the point of the file: those rows are the same setting, read and
 * written in the same place, and they appear in this order on the graph and
 * in the Studio alike. `graph` and `studio` rows keep their place in the
 * order too — a surface that has no row for a step simply does not draw it,
 * and everything around it stays where the other surface has it.
 */
export interface ISettingsRow {
  id: string;
  group: TSettingsGroup;
  on: 'both' | 'graph' | 'studio';
}

export const SETTINGS_ROWS: readonly ISettingsRow[] = [
  // The picture: what is drawn over the sound, and how much room it takes.
  { id: 'showing', group: 'picture', on: 'graph' },
  { id: 'wave', group: 'picture', on: 'graph' },
  { id: 'topWave', group: 'picture', on: 'graph' },
  { id: 'grid', group: 'picture', on: 'both' },
  { id: 'bands', group: 'picture', on: 'graph' },
  { id: 'meter', group: 'picture', on: 'graph' },
  { id: 'waveHeight', group: 'picture', on: 'both' },
  { id: 'wavePosition', group: 'picture', on: 'both' },

  // The visualizer: which one, what it offers, and how it hears.
  { id: 'style', group: 'visualizer', on: 'graph' },
  { id: 'controls', group: 'visualizer', on: 'both' },
  { id: 'response', group: 'visualizer', on: 'both' },
  { id: 'ambient', group: 'visualizer', on: 'studio' },

  // How it is drawn: the same six answers in both places, because there is
  // only one answer. The graph, the Studio and the desktop all draw under
  // the same choice — see `common/scenePerformance.ts`.
  { id: 'frameRate', group: 'drawing', on: 'both' },
  { id: 'resolution', group: 'drawing', on: 'both' },
  { id: 'floor', group: 'drawing', on: 'both' },
  { id: 'scaler', group: 'drawing', on: 'both' },
  { id: 'smoothing', group: 'drawing', on: 'both' },
  { id: 'gpu', group: 'drawing', on: 'both' },

  // Each surface's own, in its own group so that what is shared is plain to
  // see. The graph's are about the window it is drawn in; the Studio's are
  // about testing a scene that is not finished.
  { id: 'expand', group: 'own', on: 'graph' },
  { id: 'fullscreen', group: 'own', on: 'graph' },
  { id: 'topBar', group: 'own', on: 'graph' },
  { id: 'seeThrough', group: 'own', on: 'graph' },
  { id: 'blur', group: 'own', on: 'graph' },
  { id: 'wallpaper', group: 'own', on: 'graph' },
  { id: 'signals', group: 'own', on: 'studio' },
  { id: 'size', group: 'own', on: 'studio' },
  { id: 'tint', group: 'own', on: 'studio' },
];

/** The rows one surface draws, in order. */
export const rowsFor = (
  surface: 'graph' | 'studio',
  group: TSettingsGroup,
): readonly string[] =>
  SETTINGS_ROWS.filter(
    (row) => row.group === group && (row.on === 'both' || row.on === surface),
  ).map((row) => row.id);
