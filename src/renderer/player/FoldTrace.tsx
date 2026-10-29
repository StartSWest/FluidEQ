/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { useEffect, useRef, useState } from 'react';
import { useLiveAudioCapture } from '../audio/LiveAudioContext';
import LiveTraceCanvas from '../graph/LiveTraceCanvas';
import usePlayerTrace from './playerTrace';

/**
 * A STANDARD LOOK BEHIND THE FOLDED LINE (Ivan, 2026-10-26: "lets fisplay
 * the standa viz also in the one line in the bg very suttle"), as a Plus
 * scene already moves behind it (`PlayerStage`): the graph's look, drawn as
 * the top panel draws it (`usePlayerTrace`), faint, and fading out toward
 * the top where the song's title stands (`_miniPlayerFold.scss`).
 *
 * Still one drawing for the whole amp: folded, the top panel that draws the
 * look unfolded (`PlayerHero`) is gone, and with a Plus scene on, this is not
 * mounted at all (`PlayerAmp`).
 */
const FoldTrace = () => {
  const boxRef = useRef<HTMLDivElement>(null);
  const [box, setBox] = useState({ width: 0, height: 0 });
  useLiveAudioCapture(true);
  const { curves, xScale, yScale } = usePlayerTrace(box.width, box.height);

  useEffect(() => {
    const element = boxRef.current;
    if (!element || typeof ResizeObserver === 'undefined') {
      return undefined;
    }
    const observer = new ResizeObserver(([entry]) => {
      const width = Math.round(entry.contentRect.width);
      const height = Math.round(entry.contentRect.height);
      setBox((previous) =>
        previous.width === width && previous.height === height
          ? previous
          : { width, height },
      );
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  return (
    <div className="player-fold-trace" ref={boxRef} aria-hidden="true">
      {box.width > 0 && box.height > 0 && (
        <LiveTraceCanvas
          curves={curves}
          xScale={xScale}
          yScale={yScale}
          width={box.width}
          height={box.height}
          offsetLeft={0}
          offsetTop={0}
          isForeground
          // The song stands over it: the picture names nothing.
          hasKey={false}
        />
      )}
    </div>
  );
};

export default FoldTrace;
