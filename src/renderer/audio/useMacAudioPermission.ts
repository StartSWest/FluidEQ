/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { useEffect, useState } from 'react';
import type { TMacAudioPermission } from 'common/macAudioPermission';
import { isFluidEngineBuiltIn } from 'common/platformCapabilities';
import windowCapabilities from '../utils/windowCapabilities';

type TRead = () => Promise<TMacAudioPermission>;

/**
 * What macOS says to one of its privacy questions, where the engine is part
 * of the app; `undefined` until it has answered, and on every other platform
 * for good.
 *
 * Asked when the window opens and again whenever FluidEQ comes back to the
 * front, which is what returning from System Settings looks like from here:
 * the one moment the answer is likely to have changed, and nothing else
 * changes it. `read` is one of the two below, which never change.
 */
const useMacPermission = (read: TRead): TMacAudioPermission | undefined => {
  const [permission, setPermission] = useState<TMacAudioPermission>();
  const isBuiltIn = isFluidEngineBuiltIn(windowCapabilities());

  useEffect(() => {
    if (!isBuiltIn) {
      return undefined;
    }
    let isCurrent = true;
    const ask = () => {
      read()
        .then((answer) => {
          if (isCurrent) {
            setPermission(answer);
          }
          return undefined;
        })
        // A main that is restarting answers nothing; the next focus asks.
        .catch(() => undefined);
    };
    ask();
    window.addEventListener('focus', ask);
    return () => {
      isCurrent = false;
      window.removeEventListener('focus', ask);
    };
  }, [isBuiltIn, read]);

  return permission;
};

const readAudio: TRead = () =>
  window.electron.ipcRenderer.getMacAudioPermission();
const readScreen: TRead = () =>
  window.electron.ipcRenderer.getMacScreenPermission();

/** The engine hearing the Mac's sound: either list on the page allows it. */
export const useMacAudioPermission = () => useMacPermission(readAudio);

/**
 * FluidEQ recording the screen, the upper list: what the live curve's
 * capture needs on a Mac, and the engine does not.
 */
export const useMacScreenPermission = () => useMacPermission(readScreen);
