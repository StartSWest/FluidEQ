/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { existsSync } from 'fs';
import path from 'path';
import type { ICoreLog } from '../coreLog';
import type { ISystemSoundSource } from '../systemSound/systemSound';
import { createListenHelperSource } from './windows/listenHelper';

export const LISTEN_EXECUTABLE = 'FluidEQ-Listen.exe';

export interface ISystemSoundSourceOptions {
  /** Where the native helpers are: packaged, then where development builds them. */
  nativeDirs: string[];
  log: ICoreLog;
}

/**
 * This platform's way of hearing the output, or `undefined` where there is
 * none yet — the window then hears it the way it always did. Windows has
 * `FluidEQ-Listen.exe`; the Mac and Linux branches put theirs here.
 */
export const createPlatformSystemSoundSource = ({
  nativeDirs,
  log,
}: ISystemSoundSourceOptions): ISystemSoundSource | undefined => {
  if (process.platform !== 'win32') {
    return undefined;
  }
  const executable = nativeDirs
    .map((dir) => path.join(dir, LISTEN_EXECUTABLE))
    .find((candidate) => existsSync(candidate));
  if (!executable) {
    log.warn(
      `${LISTEN_EXECUTABLE} is not built; the window hears the output itself.`,
    );
    return undefined;
  }
  return createListenHelperSource(executable, log);
};
