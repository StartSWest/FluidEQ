/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU General Public License version 3 or later.
*/

import { useCallback, useState } from 'react';
import type { TStudioSize } from './StudioStage';

type TWindowedSize = Exclude<TStudioSize, 'full'>;

/**
 * The stage's size, and the one it goes back to after full screen.
 *
 * Leaving full screen — Escape, its own button, a double click — used to land
 * on the graph's size whatever the stage had been, so somebody testing the
 * narrow panel was put back on the wide one every time they looked at the
 * scene full screen.
 */
export default function useStudioSize() {
  const [sizing, setSizing] = useState<{
    size: TStudioSize;
    windowed: TWindowedSize;
  }>({ size: 'graph', windowed: 'graph' });

  const choose = useCallback(
    (next: TStudioSize) =>
      setSizing((current) =>
        next === 'full'
          ? { ...current, size: 'full' }
          : { size: next, windowed: next },
      ),
    [],
  );

  const exitFullscreen = useCallback(
    () => setSizing((current) => ({ ...current, size: current.windowed })),
    [],
  );

  const toggleFullscreen = useCallback(
    () =>
      setSizing((current) => ({
        ...current,
        size: current.size === 'full' ? current.windowed : 'full',
      })),
    [],
  );

  return { size: sizing.size, choose, exitFullscreen, toggleFullscreen };
}
