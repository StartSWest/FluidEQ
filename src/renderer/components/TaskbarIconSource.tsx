/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { useEffect } from 'react';
import { startTaskbarIconSync } from '../utils/taskbarIconSync';

/**
 * The taskbar button in the window's colours (`taskbarIconSync.ts`). Renders
 * nothing; mounted beside `RainbowSource`, at the root, because the colours
 * belong to the window whatever page or mode it is in.
 */
const TaskbarIconSource = () => {
  useEffect(() => {
    const setTaskbarIcon = window.electron?.ipcRenderer?.setTaskbarIcon;
    if (!setTaskbarIcon) {
      return undefined;
    }
    return startTaskbarIconSync(setTaskbarIcon);
  }, []);
  return null;
};

export default TaskbarIconSource;
