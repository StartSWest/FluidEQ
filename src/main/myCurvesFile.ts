/* Copyright (C) 2026 Ivan Carmenates Garcia. SPDX-License-Identifier: GPL-3.0-or-later */

import fs from 'fs';
import path from 'path';
import type { IMyCurve } from '../common/myCurves';
import {
  MY_CURVES_FILENAME,
  fromCurveStore,
  toCurveStore,
} from '../common/myCurvesFile';
import writeFileAtomically from './atomicWrite';

interface ILogger {
  error(message: string, ...details: unknown[]): void;
}

/**
 * `my-curves.json` in the app's data folder (`common/myCurvesFile.ts`).
 *
 * No file is an empty list. A file that cannot be read as one is never
 * written over: it is renamed aside, `my-curves.damaged-<time>.json`, and the
 * list starts empty — the curves somebody kept are still on disk to be
 * recovered, where saving over them would have lost them for good.
 */
export const loadMyCurves = (
  userDataDir: string,
  logger: ILogger,
  now: () => number = Date.now,
): IMyCurve[] => {
  const file = path.join(userDataDir, MY_CURVES_FILENAME);
  let contents: string;
  try {
    contents = fs.readFileSync(file, 'utf8');
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      return [];
    }
    throw error;
  }
  const curves = fromCurveStore(contents);
  if (curves) {
    return curves;
  }
  const aside = path.join(userDataDir, `my-curves.damaged-${now()}.json`);
  fs.renameSync(file, aside);
  logger.error(`My curves: ${file} could not be read; kept as ${aside}`);
  return [];
};

export const saveMyCurves = (
  userDataDir: string,
  curves: readonly IMyCurve[],
): void => {
  writeFileAtomically(
    path.join(userDataDir, MY_CURVES_FILENAME),
    toCurveStore(curves),
  );
};
