/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import fs from 'fs/promises';
import path from 'path';
import type { IState } from '../common/constants';
import {
  DEFAULT_CURVE_COMPARISON,
  isCurveComparison,
  TCurveComparison,
} from '../common/curveComparison';
import {
  DEFAULT_TREBLE_DESIGN,
  isTrebleDesign,
  ITrebleDesigns,
} from '../common/filterDesign';
import {
  OUTPUT_CONFIG_BASENAMES,
  outputConfigFileName,
  TOutputConfigFile,
} from '../common/outputConfigFiles';
import { scheduleWrite } from './asyncWriter';

export interface IOutputDesigns {
  trebleDesigns: ITrebleDesigns;
  eqPhase: TCurveComparison;
  curvePhase: TCurveComparison;
}

/** Saved profile JSON may predate the fields or contain hand-edited values. */
export const outputDesignsOf = (
  state: Pick<IState, 'trebleDesigns' | 'eqPhase' | 'curvePhase'>,
): IOutputDesigns => ({
  trebleDesigns: {
    eq: isTrebleDesign(state.trebleDesigns?.eq)
      ? state.trebleDesigns.eq
      : DEFAULT_TREBLE_DESIGN,
    curves: isTrebleDesign(state.trebleDesigns?.curves)
      ? state.trebleDesigns.curves
      : DEFAULT_TREBLE_DESIGN,
  },
  eqPhase: isCurveComparison(state.eqPhase)
    ? state.eqPhase
    : DEFAULT_CURVE_COMPARISON,
  curvePhase: isCurveComparison(state.curvePhase)
    ? state.curvePhase
    : DEFAULT_CURVE_COMPARISON,
});

/** Called inside the endpoint rack operation, before the rack is published. */
export const writeOutputDesigns = async (
  configDirPath: string,
  endpoint: string,
  designs: IOutputDesigns,
): Promise<void> => {
  const safe = outputDesignsOf(designs);
  const values: Array<[TOutputConfigFile, string]> = [
    ['eqPhase', safe.eqPhase],
    ['curvePhase', safe.curvePhase],
    ['eqTreble', safe.trebleDesigns.eq],
    ['curveTreble', safe.trebleDesigns.curves],
  ];
  await Promise.all(
    values.map(([kind, value]) => {
      const filename = outputConfigFileName(kind, endpoint);
      if (!filename) {
        throw new TypeError('Output design files need a valid output GUID');
      }
      return scheduleWrite(
        path.resolve(configDirPath, filename),
        `${value}\r\n`,
      );
    }),
  );
};

const legacyText = async (
  configDirPath: string,
  kind: TOutputConfigFile,
): Promise<string | undefined> => {
  try {
    return (
      await fs.readFile(
        path.join(configDirPath, OUTPUT_CONFIG_BASENAMES[kind]),
        'utf8',
      )
    ).trim();
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      return undefined;
    }
    throw error;
  }
};

/** Migration input only. Live output writers never consult the shared files. */
export const readLegacyOutputDesigns = async (
  configDirPath: string,
): Promise<IOutputDesigns> => {
  const [eq, curves, eqPhase, curvePhase] = await Promise.all([
    legacyText(configDirPath, 'eqTreble'),
    legacyText(configDirPath, 'curveTreble'),
    legacyText(configDirPath, 'eqPhase'),
    legacyText(configDirPath, 'curvePhase'),
  ]);
  return outputDesignsOf({
    trebleDesigns: {
      eq: isTrebleDesign(eq) ? eq : DEFAULT_TREBLE_DESIGN,
      curves: isTrebleDesign(curves) ? curves : DEFAULT_TREBLE_DESIGN,
    },
    eqPhase: isCurveComparison(eqPhase) ? eqPhase : DEFAULT_CURVE_COMPARISON,
    curvePhase: isCurveComparison(curvePhase)
      ? curvePhase
      : DEFAULT_CURVE_COMPARISON,
  });
};
