/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026> <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import {
  type CSSProperties,
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from 'react';
import { useLiveAudioCapture } from '../audio/LiveAudioContext';
import LiveTraceCanvas from '../graph/LiveTraceCanvas';
import usePlayerTrace from '../player/playerTrace';
import { useSceneLook } from '../utils/graphStyle';
import { publishSceneKaraokeHost } from '../utils/sceneCover';
import { useIsAppBackdrop } from '../utils/useIsBackdrop';
import { useKaraokeSceneAppearance } from './karaokeSceneAppearance';

/** The stage's box on the root, where the window's blur is cut away. */
const GLASS_BOX = [
  '--karaoke-glass-x',
  '--karaoke-glass-y',
  '--karaoke-glass-w',
  '--karaoke-glass-h',
] as const;

/**
 * The lyric window's glass over the window's own scene, under the Backdrop:
 * the Karaoke's See through and Blur act on it (`SceneCover.scss`). Its box
 * is written on the root for the window's blur to be cut away over it, so
 * the stage's blur replaces the window's there instead of adding to it.
 */
function KaraokeSceneGlass() {
  const glass = useRef<HTMLDivElement>(null);
  const { opacity, blur } = useKaraokeSceneAppearance();

  useLayoutEffect(() => {
    const element = glass.current;
    if (!element) {
      return undefined;
    }
    const root = document.documentElement;
    const write = () => {
      const box = element.getBoundingClientRect();
      [box.x, box.y, box.width, box.height].forEach((value, index) =>
        root.style.setProperty(GLASS_BOX[index], `${Math.round(value)}px`),
      );
    };
    write();
    // The stage's size, for a dragged playlist or full screen; the window's,
    // for a move that keeps the stage's size (a side pane opening).
    const observer = new ResizeObserver(write);
    observer.observe(element);
    observer.observe(root);
    return () => {
      observer.disconnect();
      GLASS_BOX.forEach((name) => root.style.removeProperty(name));
    };
  }, []);

  return (
    <div
      ref={glass}
      className="karaoke-stage-glass"
      aria-hidden="true"
      style={
        {
          '--karaoke-glass-share': 1 - 0.85 * opacity,
          '--karaoke-glass-blur': `${blur}px`,
        } as CSSProperties
      }
    />
  );
}

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
 * The app's look behind the words. Under the Backdrop, no picture of the
 * stage's own: the window's scene shows through the page, as it does through
 * the Library's, under the stage's own glass (Ivan, 2026-11-16: "it needs to
 * only be the scene as the lib"). Without it, the same scene moved onto the
 * stage, or the wave where the look is not a scene.
 */
export default function KaraokeGraphBackground() {
  const isBackdrop = useIsAppBackdrop();
  const hasScene = useSceneLook() !== null;
  if (isBackdrop) {
    return <KaraokeSceneGlass />;
  }
  return hasScene ? <KaraokeSceneLayer /> : <KaraokeTraceBackground />;
}
