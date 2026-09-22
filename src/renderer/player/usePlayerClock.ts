/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { useCallback, useEffect, useRef, useState } from 'react';
import type { ITransportSource } from '../audio/transportSource';
import useSmoothFrames from '../utils/useSmoothFrames';

/**
 * How far into the song the player is, to the second.
 *
 * Counted on from the source's last report while it plays, because the
 * sources report at their own rates — the Library four times a second, the
 * Media page when it samples, another program when Windows says — and a
 * clock that only moved on a report would tick unevenly. Counted by the
 * frame loop, which stops on its own once the song is paused; the React
 * state changes once a second, when the display would.
 */
const usePlayerClock = (source: ITransportSource | undefined) => {
  const durationMs = source?.durationMs ?? 0;
  const hasPosition = durationMs > 0;
  const [second, setSecond] = useState<number | undefined>(undefined);
  const reportRef = useRef({ positionMs: 0, at: 0, isPlaying: false });

  useEffect(() => {
    reportRef.current = {
      positionMs: source?.positionMs ?? 0,
      at: performance.now(),
      isPlaying: source?.isPlaying ?? false,
    };
  }, [source?.positionMs, source?.isPlaying]);

  const tick = useCallback(() => {
    const report = reportRef.current;
    const at = report.isPlaying
      ? report.positionMs + (performance.now() - report.at)
      : report.positionMs;
    const next = Math.floor(Math.min(at, durationMs || at) / 1000);
    setSecond((previous) => (previous === next ? previous : next));
    return report.isPlaying;
  }, [durationMs]);
  const kick = useSmoothFrames(tick, { isEnabled: hasPosition });
  useEffect(() => {
    kick();
  }, [kick, source?.positionMs, source?.isPlaying]);

  return { second, durationMs, hasPosition };
};

export default usePlayerClock;
