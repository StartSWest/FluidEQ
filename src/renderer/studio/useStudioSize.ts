/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU General Public License version 3 or later.
*/

import { useCallback, useState } from 'react';
import type { TStudioSize } from './StudioStage';

/**
 * The stage's size: the graph's own shape, or full screen. Narrow and Wide
 * were sizes of their own until Ivan took them out (2026-09-27: "remove these
 * option from studop no neede"); leaving full screen — Escape, its own
 * button, a double click — lands back on the graph's.
 *
 * The compact player is not a size but a window standing inside either, at
 * the shape the player opens in: tall and narrow, with the scene as its whole
 * background, which is where a scene is seen keeping its important part in
 * view (`common/sceneFraming.ts`). It was a phone first, and Ivan sent it
 * back (2026-09-28: "this app is not for mobile show the amp player
 * instead"). Going full screen and back keeps it.
 */
export default function useStudioSize() {
  const [isFull, setIsFull] = useState(false);
  const [isPlayer, setIsPlayer] = useState(false);
  const exitFullscreen = useCallback(() => setIsFull(false), []);
  const toggleFullscreen = useCallback(() => setIsFull((full) => !full), []);
  const togglePlayer = useCallback(() => setIsPlayer((shown) => !shown), []);
  const size: TStudioSize = isFull ? 'full' : 'graph';
  return { size, isPlayer, exitFullscreen, toggleFullscreen, togglePlayer };
}
