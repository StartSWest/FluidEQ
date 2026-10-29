/* Copyright (C) 2026 Ivan Carmenates Garcia. SPDX-License-Identifier: GPL-3.0-or-later */

import { useEffect } from 'react';
import ChannelEnum from '../../common/channels';
import { useSelectedLookId } from './graphStyle';

/**
 * Tells main what is on screen whenever it changes, so the processor time
 * every process spends is booked to the page and the look that cost it
 * (`main/performanceLog.ts`), and a bug report from a slow machine says
 * which feature was heavy. Ids only, in the characters main accepts.
 */
const usePerformanceContext = (page: string, windowMode: string) => {
  const look = useSelectedLookId();
  useEffect(() => {
    const screen = `${page}, ${windowMode}, look ${look}`
      .replace(/[^A-Za-z0-9 ._:-]/g, '-')
      .slice(0, 80);
    try {
      window.electron.ipcRenderer.sendMessage(ChannelEnum.PERFORMANCE_CONTEXT, [
        screen,
      ]);
    } catch {
      // No preload (a harness): nothing measures, and nothing is lost.
    }
  }, [page, windowMode, look]);
};

export default usePerformanceContext;
