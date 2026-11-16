/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026> <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { useCallback, useEffect, useRef, useState } from 'react';
import { useLiveAudioCapture } from '../audio/LiveAudioContext';
import LiveTraceCanvas from '../graph/LiveTraceCanvas';
import usePlayerTrace from '../player/playerTrace';
import { useSceneLook } from '../utils/graphStyle';
import { publishSceneKaraokeHost } from '../utils/sceneCover';
import { useIsAppBackdrop } from '../utils/useIsBackdrop';

/**
 * The stage's place for the app's scene while the window has no Backdrop to
 * show it: the one renderer above the pages (`GraphScene`) moves its canvas
 * in here while this stands, and back where it was when it goes. The stage
 * used to start a player of its own, a second worker and GPU context drawing
 * the same scene the Backdrop was already drawing behind the window (Ivan,
 * 2026-11-16: "instead of loading 2 viz make sure only the app one stays").
 */
function KaraokeSceneLayer() {
  const attach = useCallback((element: HTMLDivElement | null) => {
    publishSceneKaraokeHost(element);
  }, []);
  return (
    <div
      ref={attach}
      className="karaoke-stage-media karaoke-graph-background"
      data-scene-layer="karaoke"
      aria-hidden="true"
      inert
    />
  );
}

/** A standard look has no scene: the stage draws the live wave instead. */
function KaraokeTraceBackground() {
  const frame = useRef<HTMLDivElement>(null);
  const [box, setBox] = useState({ width: 0, height: 0 });
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

  return (
    <div
      ref={frame}
      className="karaoke-stage-media karaoke-graph-background"
      aria-hidden="true"
      inert
    >
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
          hasKey={false}
        />
      )}
    </div>
  );
}

/**
 * The app's look behind the words. Under the Backdrop, nothing of the
 * stage's own: the window's scene shows through the page's glass, as it
 * does through the Library's (Ivan, 2026-11-16: "it needs to only be the
 * scene as the lib"). Without it, the same scene moved onto the stage, or
 * the wave where the look is not a scene.
 */
export default function KaraokeGraphBackground() {
  const isBackdrop = useIsAppBackdrop();
  const hasScene = useSceneLook() !== null;
  if (isBackdrop) {
    return null;
  }
  return hasScene ? <KaraokeSceneLayer /> : <KaraokeTraceBackground />;
}
