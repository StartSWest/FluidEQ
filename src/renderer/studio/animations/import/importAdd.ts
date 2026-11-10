/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import type { IDecodedImport } from './importDecode';
import { composeSheet, sheetPng } from './importSheet';
import {
  clipAnimation,
  clipTiming,
  type IImportClipChoice,
} from './useAnimationImport';

/**
 * The chosen animations of an import added to the scene, one after
 * another (`studio-animation-import`): each laid into its sheet, made a
 * PNG and written by main. Stops at the first that fails, saying which and
 * why; those before it are in the scene.
 */

export type TImportAddFailure =
  'closed' | 'invalid' | 'taken' | 'full' | 'failed';

export type TImportAddOutcome =
  | { ok: true; added: string[] }
  | { ok: false; added: string[]; name: string; reason: TImportAddFailure };

export const addImport = async (
  decoded: IDecodedImport,
  choices: readonly IImportClipChoice[],
): Promise<TImportAddOutcome> => {
  const added: string[] = [];
  const write = window.electron?.ipcRenderer?.importStudioAnimation;
  for (let clip = 0; clip < choices.length; clip += 1) {
    const choice = choices[clip];
    if (choice.include) {
      const timing = clipTiming(decoded, clip);
      const sheet = timing ? composeSheet(decoded, timing.cells) : undefined;
      const animation =
        timing && sheet ? clipAnimation(choice, timing, sheet) : undefined;
      // eslint-disable-next-line no-await-in-loop -- one sheet encoded and written at a time, so a failure stops the rest
      const png = sheet ? await sheetPng(sheet) : undefined;
      if (!write) {
        return { ok: false, added, name: choice.name, reason: 'closed' };
      }
      if (!animation || !sheet || !png) {
        return { ok: false, added, name: choice.name, reason: 'failed' };
      }
      // eslint-disable-next-line no-await-in-loop -- as above
      const outcome = await write({
        name: choice.name,
        sheet: png,
        count: animation.count,
        columns: animation.columns,
        fps: Math.round(animation.fps),
        loop: animation.loop,
        ground: animation.ground,
      });
      if (!outcome.ok) {
        return { ok: false, added, name: choice.name, reason: outcome.reason };
      }
      added.push(choice.name);
    }
  }
  return { ok: true, added };
};
