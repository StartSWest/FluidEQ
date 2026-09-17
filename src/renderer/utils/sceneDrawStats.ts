/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import type { ISceneDrawReport } from '../graph/sceneRunnerTypes';

/**
 * What every visualizer being drawn in this window is costing right now, by
 * where it is drawn, for the Processes dialog's line under its table.
 *
 * Written after every frame and read whenever the dialog refreshes itself;
 * nothing listens per frame. A place that stops drawing takes its entry
 * away, so a scene put away with its tab is not reported as running.
 */

export type TSceneDrawPlace = 'graph' | 'studio';

export interface ISceneDrawStat {
  place: TSceneDrawPlace;
  name: string;
  report: ISceneDrawReport;
}

const stats = new Map<TSceneDrawPlace, ISceneDrawStat>();

export const reportSceneDraw = (
  place: TSceneDrawPlace,
  name: string,
  report: ISceneDrawReport,
) => {
  stats.set(place, { place, name, report });
};

export const forgetSceneDraw = (place: TSceneDrawPlace) => {
  stats.delete(place);
};

export const readSceneDraws = (): ISceneDrawStat[] => [...stats.values()];
