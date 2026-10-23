/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import type { BrowserWindow, Streams } from 'electron';
import { PRODUCT_NAME } from '../common/branding';

/**
 * The live capture's sources on a Mac: the system's sound, with FluidEQ's own
 * window as the video Chromium insists on, named by the window's own id.
 *
 * Windows looks the window up in a list of every window (`mainWindow.ts`).
 * A Mac does not: on macOS that list comes from ScreenCaptureKit, which
 * refuses it to an app not allowed to record the screen, and Electron hands
 * that refusal back as a rejection its own promise never handled — so the
 * crash guard saw an unhandled rejection and closed the app, although the
 * caller awaited the list and caught its failure (2026-10-02, launched with
 * the screen permission taken away: "Fatal main-process error Failed to get
 * sources."). The window's own id is the one the list was searched for, and
 * asking for it lists nothing; a refused capture is then an ordinary failure
 * the window reports (`LiveCaptureFailedNotice`).
 *
 * `undefined` everywhere else, where the list is still what answers.
 */
const macLoopbackStreams = (
  platform: NodeJS.Platform,
  window: BrowserWindow,
): Streams | undefined =>
  platform === 'darwin'
    ? {
        video: { id: window.getMediaSourceId(), name: PRODUCT_NAME },
        audio: 'loopback',
      }
    : undefined;

export default macLoopbackStreams;
