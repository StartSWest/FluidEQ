/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import fs from 'fs';
import { ipcMain, shell } from 'electron';
import { ANIMATION_NAME, ANIMATIONS_DIR } from '../../common/studioAnimation';
import { readProjectAnimation } from '../memberScenes/projectAnimations';
import { insideFolder } from '../studioChat/projectPath';

export type TAnimationShowOutcome = 'shown' | 'missing' | 'closed';

/**
 * "Show in folder" on an animation's card: the file manager opened on its
 * sheet, selected, or on its animation file when the sheet cannot be read.
 * Only a name crosses from the window; the path is found here, inside the
 * open project, so the window can never ask for somewhere else.
 */
export const registerStudioAnimationShow = ({
  mayEdit,
  activeFolder,
}: {
  mayEdit: () => boolean;
  activeFolder: () => string | undefined;
}): (() => void) => {
  ipcMain.handle(
    'studio-animation-show',
    async (_event, name: unknown): Promise<TAnimationShowOutcome> => {
      const folder = activeFolder();
      if (!folder || !mayEdit()) {
        return 'closed';
      }
      if (typeof name !== 'string' || !ANIMATION_NAME.test(name)) {
        return 'missing';
      }
      const read = await readProjectAnimation(folder, name);
      const shown = [
        read ? insideFolder(folder, read.animation.sheet) : undefined,
        insideFolder(folder, `${ANIMATIONS_DIR}/${name}.json`),
      ].find((target) => target !== undefined && fs.existsSync(target));
      if (!shown) {
        return 'missing';
      }
      shell.showItemInFolder(shown);
      return 'shown';
    },
  );
  return () => ipcMain.removeHandler('studio-animation-show');
};
