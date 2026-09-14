/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import type { TSceneRefusal } from 'main/sceneRefusals';

/**
 * A scene's code would not run here, from somewhere other than the graph —
 * the gallery's preview, the lamps, the worker drawing its picture. The main
 * process keeps it by source (`sceneRefusals.ts`), so every other place that
 * would run the same code stops, this session and the next.
 *
 * Nothing waits on it: whatever reported it has already stopped drawing the
 * scene, and a window older than the channel is simply not told.
 */
export default function reportRefusedSceneSource(
  source: string,
  reason: TSceneRefusal,
): void {
  window.electron?.ipcRenderer
    ?.reportSceneSourceRefused?.(source, reason)
    ?.catch(() => undefined);
}
