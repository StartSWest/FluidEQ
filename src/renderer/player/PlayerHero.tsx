/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { MouseEvent } from 'react';
import { isMemberLookId } from 'common/memberScenes';
import { useLastShown } from '../audio/lastShown';
import { useLiveAudioCapture } from '../audio/LiveAudioContext';
import GraphWallpaperToggle from '../graph/GraphWallpaperToggle';
import LightingToggle from '../graph/LightingToggle';
import LiveTraceCanvas from '../graph/LiveTraceCanvas';
import { liveLevelScaleFor } from '../graph/graphPaper';
import SceneLikeButton from '../graph/SceneLikeButton';
import LibraryCoverArt from '../library/LibraryCoverArt';
import {
  useGraphAutoCycle,
  useGraphAutoCycleSeconds,
  useHoldGraphAutoCycle,
} from '../utils/graphAutoCycle';
import {
  toggleGraphGrid,
  useGraphGridHidden,
  useGraphLook,
  useSelectedLookId,
} from '../utils/graphStyle';
import { useTranslation } from '../utils/I18nContext';
import { reportError } from '../utils/logger';
import { useUsableMemberScenes } from '../utils/memberScenes';
import Marquee from './Marquee';
import PlayerIcon from './PlayerIcon';
import PlayerPaper from './PlayerPaper';
import PlayerReadouts from './PlayerReadouts';
import PlayerSource from './PlayerSource';
import type { TPlayerPage } from './PlayerMarkMenu';
import { playerPaperFor } from './paperRules';
import { useLibraryDeck } from './libraryDeck';
import { usePlayerVisFull } from './playerLayout';
import usePlayerTrace from './playerTrace';
import { usePlaylistDeck } from './playlistDeck';
import type { IGraphScenePack } from './useGraphScenePack';
import usePlayerSource from './usePlayerSource';
import switchVisFullScreen from './visFullScreen';

interface IPlayerHeroProps {
  /** The Plus visualizer drawn behind the panel, when there is one. */
  scene: IGraphScenePack | undefined;
  /** One is on its way: nothing is drawn here in the meantime. */
  isLoading: boolean;
  onOpenPage: (page: TPlayerPage) => void;
}

/**
 * THE TOP PANEL (Ivan, 2026-10-25: "lets put the viz there on the hero ...
 * whether is standard viz or plus viz"): the visualizer, with the song over
 * it and the picture's own keys in its corner.
 *
 * A standard look is drawn here, in the panel. A Plus visualizer is drawn
 * by the layer behind the panel and the transport (`PlayerStage`), so it
 * runs on behind the keys under it; the panel only lays the song over it.
 * Either way a double-press on the picture takes the screen, and a second
 * one, or Escape, gives it back.
 */
const PlayerHero = ({ scene, isLoading, onOpenPage }: IPlayerHeroProps) => {
  const { t } = useTranslation();
  const heroRef = useRef<HTMLElement>(null);
  const viewRef = useRef<HTMLDivElement>(null);
  const isFull = usePlayerVisFull();
  const look = useGraphLook();
  const selectedLookId = useSelectedLookId();
  const isGridHidden = useGraphGridHidden();
  const memberScenes = useUsableMemberScenes();
  const memberScene = isMemberLookId(selectedLookId)
    ? memberScenes.find((candidate) => candidate.lookId === selectedLookId)
    : undefined;
  const [box, setBox] = useState({ width: 0, height: 0 });
  // Auto changes the look here too. The graph's toolbar runs the cycle in the
  // full app, and the whole app sleeps behind the player (`App.tsx`'s
  // Activity), effects and their frame loops with it, so with only the
  // graph's the look never moved while the window was the player (Ivan,
  // 2026-10-29: "I toggle auto in the app and in the amp ui is not cycling
  // the viz"). The same interval and holds: the picker open or a scene still
  // loading keep the look where it is.
  useGraphAutoCycle(useGraphAutoCycleSeconds(), false, selectedLookId);
  // A Plus look still on its way has not started its time on screen; once it
  // arrives, the stage holds until its first frame (`PlayerStage`).
  useHoldGraphAutoCycle(isLoading);

  // The song playing, or the last one shown while nothing plays.
  const source = usePlayerSource();
  const remembered = useLastShown();
  const shown = source ?? remembered;
  const library = useLibraryDeck();
  const playlists = usePlaylistDeck();
  useLiveAudioCapture(true);
  const isLibrary = source?.owner === 'library' && library !== undefined;
  const trackId = isLibrary ? library.track?.id : undefined;
  const isFavorite =
    trackId !== undefined && playlists?.isFavorite(trackId) === true;
  const title = shown?.title ?? t('library.nothingPlaying');

  const toggleFull = useCallback((next: boolean) => {
    switchVisFullScreen(next, heroRef.current).catch((error: unknown) =>
      reportError('Player full screen switch failed', error),
    );
  }, []);

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

  // Ctrl+G turns the grid under a measuring view on and off, as on the graph.
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

  const isTrace = scene === undefined && !isLoading;
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
  }, [isTrace]);

  // The look drawn as the folded line draws it too (`usePlayerTrace`). The
  // keys at the right stand over the drawing, as they always did over the
  // LED walls.
  const {
    curves: traceCurves,
    xScale,
    yScale,
  } = usePlayerTrace(box.width, box.height);
  const paper = playerPaperFor(look.style, { isTrace, isGridHidden });
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

  // The picture is what takes the screen, never a control laid over it.
  const onDoubleClick = (event: MouseEvent<HTMLElement>) => {
    if (
      event.target instanceof Element &&
      event.target.closest('button, a, input, [role="menu"], .player-hero__now')
    ) {
      return;
    }
    toggleFull(!isFull);
  };

  return (
    <section
      ref={heroRef}
      className={`player-hero${scene ? ' has-scene' : ''}`}
      aria-label={t('player.deck.aria')}
      onDoubleClick={onDoubleClick}
    >
      {isTrace && (
        <div className="player-hero__view" ref={viewRef} aria-hidden="true">
          {/* Each look as the full app's graph draws it, on its rules. */}
          {hasBox && (paper.frequency || paper.level) && (
            <PlayerPaper
              width={box.width}
              height={box.height}
              paper={paper}
              frequency={xScale}
              level={levelScale}
            />
          )}
          {hasBox && (
            <div className="player-hero__trace">
              <LiveTraceCanvas
                curves={traceCurves}
                xScale={xScale}
                yScale={yScale}
                width={box.width}
                height={box.height}
                offsetLeft={0}
                offsetTop={0}
                isForeground
                // The song stands where a key would: the picture names
                // nothing over it.
                hasKey={false}
              />
            </div>
          )}
        </div>
      )}
      <div className="player-hero__shade" aria-hidden="true" />
      {/* No name over the picture, here or on the whole screen (Ivan,
          2026-10-25: "remove the indicator so the viz is fully visible",
          "also in fullscreen"): it lay over a scene's own score and title,
          and the look's name is the picker's under the transport. */}
      <div className="player-hero__top">
        {/* The approved amp's keys (Ivan, 2026-10-25): the desk lights and
            the desktop, which each follow a Plus scene and so stand only
            beside one, and the full screen. A member's scene carries its
            heart first. No window-colour modes: the amp is the Backdrop
            whenever a Plus scene is on ("let's remove colour modes, always
            backdrop only on the amp"). */}
        <span className="player-hero__keys">
          {scene && memberScene && (
            <SceneLikeButton key={memberScene.lookId} scene={memberScene} />
          )}
          {scene && <LightingToggle />}
          {scene && <GraphWallpaperToggle lookId={selectedLookId} />}
          <button
            type="button"
            className="player-hero__key"
            aria-pressed={isFull}
            aria-label={t('graph.view.fullscreen')}
            title={t('graph.view.fullscreen')}
            onClick={() => toggleFull(!isFull)}
          >
            <PlayerIcon name="expand" />
          </button>
        </span>
      </div>
      <div className="player-hero__now">
        <span className="player-hero__art">
          <LibraryCoverArt
            src={isLibrary ? undefined : shown?.artworkUrl}
            artId={isLibrary ? library.track?.artId : undefined}
            label={title}
            size="tile"
          />
        </span>
        <span className="player-hero__words">
          {shown && <PlayerSource source={shown} onOpenPage={onOpenPage} />}
          <Marquee text={title} className="player-hero__title" />
          {shown?.subtitle && (
            <span className="player-hero__artist">{shown.subtitle}</span>
          )}
          <PlayerReadouts />
        </span>
        {trackId !== undefined && playlists && (
          <button
            type="button"
            className={`player-hero__heart${isFavorite ? ' is-on' : ''}`}
            aria-pressed={isFavorite}
            aria-label={t(
              isFavorite
                ? 'library.playlist.removeFromFavorites'
                : 'library.playlist.addToFavorites',
            )}
            title={t(
              isFavorite
                ? 'library.playlist.removeFromFavorites'
                : 'library.playlist.addToFavorites',
            )}
            onClick={() => playlists.toggleFavorite(trackId)}
          >
            <PlayerIcon name="heart" />
          </button>
        )}
      </div>
    </section>
  );
};

export default PlayerHero;
