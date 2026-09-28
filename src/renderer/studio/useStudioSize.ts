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
 */
export default function useStudioSize() {
  const [isFull, setIsFull] = useState(false);
  const exitFullscreen = useCallback(() => setIsFull(false), []);
  const toggleFullscreen = useCallback(() => setIsFull((full) => !full), []);
  const size: TStudioSize = isFull ? 'full' : 'graph';
  return { size, exitFullscreen, toggleFullscreen };
}
