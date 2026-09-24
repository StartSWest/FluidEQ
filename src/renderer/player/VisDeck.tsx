/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { CSSProperties } from 'react';
import { isMemberLookId } from 'common/memberScenes';
import { isLockedLookId } from 'common/scenePacks';
import { requestAccountPanel } from '../account/accountPanel';
import {
  frequencyScale,
  gainScale,
  graphFrequencyRange,
} from '../graph/ChartController';
import GraphAutoCycle from '../graph/GraphAutoCycle';
import GraphWallpaperToggle from '../graph/GraphWallpaperToggle';
import LightingToggle from '../graph/LightingToggle';
import LiveTraceCanvas from '../graph/LiveTraceCanvas';
import LookPicker from '../graph/LookPicker';
import liveTraceCurves from '../graph/liveTraceCurves';
import SceneLikeButton from '../graph/SceneLikeButton';
import SceneTintToggle from '../graph/SceneTintToggle';
import ScenePreview from '../plus/ScenePreview';
import {
  cycleGraphLook,
  setGraphLook,
  useSelectedLookId,
  useWatchedGraphWave,
  useWaveOrientation,
} from '../utils/graphStyle';
import { useTranslation } from '../utils/I18nContext';
import { useUsableMemberScenes } from '../utils/memberScenes';
import useGraphScenePack from './useGraphScenePack';
import {
  PLAYER_VIS_MIN,
  setPlayerVisFull,
  usePlayerVisFull,
} from './playerLayout';
import { setWindowMode } from './windowModeStore';

/**
 * The player's visualizer: the graph's own look, playing.
 *
 * The same look the graph is set to, drawn by the graph's own renderers —
 * a Plus scene through the runner the Plus page previews with, anything
 * else through the graph's live trace — so the picker, the arrows and the
 * automatic switching here move the graph's selection, and the full app
 * comes back on the look the player was left on. A scene that cannot be
 * read or run here draws the free look it falls back to, as the graph does.
 */
const VisDeck = ({ height }: { height: number }) => {
  const { t } = useTranslation();
  const selectedLookId = useSelectedLookId();
  const scene = useGraphScenePack();
  const memberScenes = useUsableMemberScenes();
  const orientation = useWaveOrientation();
  // The wave as it is set for watching — full screen's. The graph keeps one
  // per view mode and the player is none of them: it is a picture to watch,
  // like a desktop background, and the pane's measuring height is about a
  // card this window does not have.
  const { height: waveHeight, position: wavePosition } = useWatchedGraphWave();
  const stageRef = useRef<HTMLDivElement>(null);
  const isFull = usePlayerVisFull();
  /**
   * The picture alone, on the whole screen, and back again.
   *
   * The window is asked in the same breath as the claim is written down, so
   * the state it announces is never reconciled back out of the mode (see
   * `App.tsx`). A failure leaves both as they were rather than a window and
   * a layout that disagree.
   */
  const toggleFull = useCallback((next: boolean) => {
    setPlayerVisFull(next);
    window.electron?.ipcRenderer
      ?.setWindowFullScreen?.(next)
      ?.catch(() => setPlayerVisFull(!next));
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
  const [box, setBox] = useState({ width: 0, height: 0 });
  // The scene that failed here, so its fallback stays until another is picked.
  const [troubled, setTroubled] = useState<string>();

  useEffect(() => {
    const stage = stageRef.current;
    if (!stage || typeof ResizeObserver === 'undefined') {
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
    observer.observe(stage);
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
  // Gridless, so trimmed to where records have sound, as the main graph is
  // with its grid off (`graphFrequencyRange`).
  const xScale = useMemo(
    () => frequencyScale(box.width, 0, 0, graphFrequencyRange(true)),
    [box.width],
  );
  const yScale = useMemo(() => gainScale(box.height, 0, 0), [box.height]);

  const choose = useCallback((lookId: string) => {
    if (!isLockedLookId(lookId)) {
      setGraphLook(lookId);
      return;
    }
    // Plus is explained and bought in the Account panel, which is the full
    // app's; the look on screen stays put, as it does there.
    setWindowMode('app')
      .then(() => requestAccountPanel())
      .catch(() => undefined);
  }, []);
  const onTrouble = useCallback(() => {
    if (scene.state === 'ready') {
      setTroubled(scene.identity);
    }
  }, [scene]);

  const isScene = scene.state === 'ready' && scene.identity !== troubled;
  const hasBox = box.width > 0 && box.height > 0;
  // A member's scene, which has an author to thank as it does on the graph.
  const memberScene = isMemberLookId(selectedLookId)
    ? memberScenes.find((candidate) => candidate.lookId === selectedLookId)
    : undefined;

  return (
    <section
      className={`player-vis${isFull ? ' is-full' : ''}`}
      aria-label={t('player.vis.aria')}
      // The height the listener gave it, kept while the queue under it takes
      // the window's growth, and the floor the divider stops at
      // (`MiniPlayer.scss`, `_miniPlayerDecks.scss`).
      style={
        {
          '--player-vis-height': `${height}px`,
          '--player-vis-min': `${PLAYER_VIS_MIN}px`,
        } as CSSProperties
      }
    >
      {/* A DOUBLE-PRESS ON THE PICTURE TAKES THE SCREEN (Ivan, 2026-09-22),
          and a second one gives it back — the gesture the Studio's stage
          already uses for the same thing. On the stage and not the deck, so a
          double-press on the strip of controls over it is not the picture
          being asked for. */}
      <div
        className="player-vis__stage"
        ref={stageRef}
        onDoubleClick={() => toggleFull(!isFull)}
      >
        {hasBox && isScene && (
          <ScenePreview
            identity={scene.identity}
            madeBy={scene.madeBy}
            pack={scene.pack}
            label={scene.label}
            tuning={scene.tuning}
            onTrouble={onTrouble}
          />
        )}
        {hasBox && !isScene && scene.state !== 'loading' && (
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
        )}
        {/* The graph's own strip over its picture: its arrows, its picker and
            its automatic switching, under its class. Inside the stage, so it
            is placed against the picture whatever the deck around it does.
            The equalizer is not drawn over the picture here — the deck above
            it already draws it, and a curve over a scene is two of the same
            thing (Ivan, 2026-09-21). */}
        <div className="live-output-controls player-vis__bar">
          <span className="player-vis__looks">
            <button
              type="button"
              className="graph-look-step"
              aria-label={t('graph.style.previous')}
              title={t('graph.style.previous')}
              onClick={() => cycleGraphLook(-1)}
            >
              <svg viewBox="0 0 16 16" aria-hidden>
                <path d="M10 3.5l-4 4.5 4 4.5" />
              </svg>
            </button>
            <LookPicker
              value={selectedLookId}
              disabled={false}
              onChoose={choose}
            />
            <button
              type="button"
              className="graph-look-step"
              aria-label={t('graph.style.next')}
              title={t('graph.style.next')}
              onClick={() => cycleGraphLook(1)}
            >
              <svg viewBox="0 0 16 16" aria-hidden>
                <path d="M6 3.5l4 4.5-4 4.5" />
              </svg>
            </button>
          </span>
          {/* THE GRAPH'S OWN ROW, in the graph's order (Ivan, 2026-09-24:
              "similar to what we have in full app"): automatic switching,
              then on a scene what it does to the window, the heart on a
              member's scene, the desk lights and the desktop background.
              Each is the graph's own control and hides itself where it can do
              nothing. Not the grid switch or the View menu: this picture has
              no grid, and the View menu's modes are the graph's panes, so both
              would be presses that change nothing here. */}
          <GraphAutoCycle
            selectedLookId={selectedLookId}
            isWaveHidden={false}
            isEditing={false}
          />
          {/* What a Plus visualizer does to the window — nothing, its colours,
              or its colours beating with it (Ivan, 2026-09-21). Only on a
              scene: a free look has no colours of its own to lend. */}
          {isScene && <SceneTintToggle />}
          {isScene && memberScene && (
            <SceneLikeButton key={memberScene.lookId} scene={memberScene} />
          )}
          {isScene && <LightingToggle />}
          {isScene && scene.state === 'ready' && (
            <GraphWallpaperToggle lookId={scene.lookId} />
          )}
        </div>
      </div>
    </section>
  );
};

export default VisDeck;
