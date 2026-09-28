/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { MouseEvent } from 'react';
import {
  frequencyScale,
  gainScale,
  graphFrequencyRange,
} from '../graph/ChartController';
import LiveTraceCanvas from '../graph/LiveTraceCanvas';
import { liveLevelScaleFor } from '../graph/graphPaper';
import liveTraceCurves from '../graph/liveTraceCurves';
import {
  toggleGraphGrid,
  useGraphGridHidden,
  useGraphLook,
  useWatchedGraphWave,
  useWaveOrientation,
} from '../utils/graphStyle';
import { reportError } from '../utils/logger';
import PlayerPaper from './PlayerPaper';
import PlayerStageBar from './PlayerStageBar';
import { playerPaperFor } from './paperRules';
import { usePlayerVisFull } from './playerLayout';
import switchVisFullScreen from './visFullScreen';

interface IPlayerGapProps {
  /** A Plus visualizer is the picture behind the whole window. */
  isScene: boolean;
  /** One is on its way: nothing is drawn here in the meantime. */
  isLoading: boolean;
}

/**
 * The open space between the dock and the sheet, where the picture is seen
 * with nothing in front of it (the Stage, Ivan 2026-09-27), and the
 * visualizer's own bar at its foot (`PlayerStageBar`).
 *
 * A Plus visualizer is drawn behind the whole window (`PlayerStage`) and this
 * is the window onto it. Any other look is drawn here, by the graph's own
 * live trace from the graph's own settings — the look the graph is set to,
 * so the picker, the arrows and the switching here move the graph's
 * selection, and the full app comes back on the look the amp was left on.
 *
 * A double-press on the picture takes the whole screen and a second one, or
 * Escape, gives it back (Ivan, 2026-09-22).
 */
const PlayerGap = ({ isScene, isLoading }: IPlayerGapProps) => {
  const orientation = useWaveOrientation();
  // The wave as it is set for watching — full screen's. The amp is a picture
  // to watch, like a desktop background, not one of the graph's view modes.
  const { height: waveHeight, position: wavePosition } = useWatchedGraphWave();
  const look = useGraphLook();
  const isGridHidden = useGraphGridHidden();
  const gapRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<HTMLDivElement>(null);
  const isFull = usePlayerVisFull();
  const [box, setBox] = useState({ width: 0, height: 0 });

  const toggleFull = useCallback((next: boolean) => {
    // A refusal is an answer and comes back quietly; anything thrown is a
    // fault, and the switch has already put the player back in view.
    switchVisFullScreen(next, gapRef.current).catch((error: unknown) =>
      reportError('Player full screen switch failed', error),
    );
  }, []);

  // Escape gives the window back, wherever the focus is: a picture with no
  // chrome on it has nothing to press.
  useEffect(() => {
    if (!isFull) {
      return undefined;
    }
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        toggleFull(false);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isFull, toggleFull]);

  // Ctrl+G shows and hides the grid here as it does on the graph, and it is
  // the graph's own switch: the trace stretches edge to edge exactly when
  // that switch is off (Ivan, 2026-09-24). The graph behind the amp stands
  // its own Ctrl+G down (`FrequencyResponseChart`).
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (
        (event.ctrlKey || event.metaKey) &&
        !event.altKey &&
        !event.repeat &&
        event.key.toLowerCase() === 'g'
      ) {
        event.preventDefault();
        toggleGraphGrid();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  useEffect(() => {
    const view = viewRef.current;
    if (!view || typeof ResizeObserver === 'undefined') {
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
    observer.observe(view);
    return () => observer.disconnect();
  }, []);

  const traceCurves = useMemo(
    () =>
      liveTraceCurves({
        orientation,
        height: waveHeight,
        position: wavePosition,
        opacity: 1,
      }),
    [orientation, waveHeight, wavePosition],
  );
  const isTrace = !isScene && !isLoading;
  // The main graph's grid under a measuring view, from the graph's own grid
  // switch (`paperRules.ts`).
  const paper = playerPaperFor(look.style, { isTrace, isGridHidden });
  const { padding } = paper;
  const xScale = useMemo(
    () =>
      frequencyScale(
        box.width,
        padding.left,
        padding.right,
        graphFrequencyRange(!paper.frequency),
      ),
    [box.width, padding, paper.frequency],
  );
  const yScale = useMemo(
    () => gainScale(box.height, padding.top, padding.bottom),
    [box.height, padding],
  );
  // The analyser's scale where the watched wave puts it, which the numbers
  // down the right describe.
  const levelScale = useMemo(
    () =>
      liveLevelScaleFor({
        gain: yScale,
        liveCurve: traceCurves[traceCurves.length - 1],
        height: box.height,
        marginTop: 0,
      }),
    [yScale, traceCurves, box.height],
  );
  const hasBox = box.width > 0 && box.height > 0;

  // On the picture and not on the bar over it, so a double-press on a key is
  // not the picture being asked for.
  const onDoubleClick = (event: MouseEvent<HTMLDivElement>) => {
    if (
      event.target instanceof Element &&
      event.target.closest('.player-stagebar')
    ) {
      return;
    }
    toggleFull(!isFull);
  };

  return (
    <div
      className={`player-gap${isTrace ? ' is-trace' : ''}`}
      ref={gapRef}
      onDoubleClick={onDoubleClick}
    >
      {/* The drawing stands above the bar, never under it: its labels and
          its legend are read, and the bar's glass would blur them. */}
      <div className="player-gap__view" ref={viewRef}>
        {hasBox && isTrace && (
          <div className="player-gap__trace" aria-hidden="true">
            <LiveTraceCanvas
              curves={traceCurves}
              xScale={xScale}
              yScale={yScale}
              width={box.width}
              height={box.height}
              offsetLeft={0}
              offsetTop={0}
              isForeground
            />
          </div>
        )}
        {hasBox && (paper.frequency || paper.level) && (
          <PlayerPaper
            width={box.width}
            height={box.height}
            paper={paper}
            frequency={xScale}
            level={levelScale}
          />
        )}
      </div>
      <PlayerStageBar
        isScene={isScene}
        isFull={isFull}
        onFull={() => toggleFull(!isFull)}
      />
    </div>
  );
};

export default PlayerGap;
