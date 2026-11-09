/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU General Public License version 3 or later.
*/

import { useCallback, useState } from 'react';
import type { TStudioSize } from './StudioStage';
import type { TStagePreview } from './studioStageScreen';

/**
 * The stage's size: the graph's own shape, or full screen. Narrow and Wide
 * were sizes of their own until Ivan took them out (2026-09-27: "remove these
 * option from studop no neede"); leaving full screen — Escape, its own
 * button, a double click — lands back on the graph's.
 *
 * What the stage shows the scene as is apart from its size: the stage
 * itself, the EQ graph of an ultra-wide window, or the Compact player, each
 * a window standing inside either size (`studioStageScreen.ts`). One at a
 * time: pressing another moves to it, pressing the one that is on goes back
 * to the stage. Going full screen and back keeps it.
 *
 * The Compact player shows the scene alone in the player's frame unless the
 * author lays the player's parts over it (Ivan, 2026-11-09: "don't show the
 * amp", then "or allow user to select if just the frame and if with amp ui
 * on top"); the choice is kept while the player is put away and shown again.
 */
export default function useStudioSize() {
  const [isFull, setIsFull] = useState(false);
  const [preview, setPreview] = useState<TStagePreview>('stage');
  const [hasPlayerParts, setHasPlayerParts] = useState(false);
  const exitFullscreen = useCallback(() => setIsFull(false), []);
  const toggleFullscreen = useCallback(() => setIsFull((full) => !full), []);
  const togglePreview = useCallback(
    (next: TStagePreview) =>
      setPreview((shown) => (shown === next ? 'stage' : next)),
    [],
  );
  const togglePlayerParts = useCallback(
    () => setHasPlayerParts((shown) => !shown),
    [],
  );
  const size: TStudioSize = isFull ? 'full' : 'graph';
  return {
    size,
    preview,
    hasPlayerParts,
    exitFullscreen,
    toggleFullscreen,
    togglePreview,
    togglePlayerParts,
  };
}
