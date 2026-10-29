/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026> <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { useEffect, useRef, useState } from 'react';
import { useLiveAudioCapture } from '../audio/LiveAudioContext';
import LiveTraceCanvas from '../graph/LiveTraceCanvas';
import usePlayerTrace from '../player/playerTrace';
import useGraphScenePack from '../player/useGraphScenePack';
import ScenePreview from '../plus/ScenePreview';

/** A second surface for the selected look, independent of the response graph. */
export default function KaraokeGraphBackground() {
  const frame = useRef<HTMLDivElement>(null);
  const [box, setBox] = useState({ width: 0, height: 0 });
  const scene = useGraphScenePack();
  const [failedIdentity, setFailedIdentity] = useState<string>();
  useLiveAudioCapture(true);
  const { curves, xScale, yScale } = usePlayerTrace(box.width, box.height);

  useEffect(() => {
    const element = frame.current;
    if (!element) {
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

  const playsScene =
    scene.state === 'ready' && failedIdentity !== scene.identity;
  return (
    <div
      ref={frame}
      className="karaoke-stage-media karaoke-graph-background"
      aria-hidden="true"
      inert
    >
      {playsScene && scene.state === 'ready' && (
        <ScenePreview
          identity={scene.identity}
          madeBy={scene.madeBy}
          pack={scene.pack}
          label={scene.label}
          tuning={scene.tuning}
          wave={scene.wave}
          onTrouble={() => setFailedIdentity(scene.identity)}
        />
      )}
      {!playsScene &&
        scene.state !== 'loading' &&
        box.width > 0 &&
        box.height > 0 && (
          <LiveTraceCanvas
            curves={curves}
            xScale={xScale}
            yScale={yScale}
            width={box.width}
            height={box.height}
            offsetLeft={0}
            offsetTop={0}
            isForeground
            hasKey={false}
          />
        )}
    </div>
  );
}
