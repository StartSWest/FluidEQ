/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
} from 'react';
import type { TranslationKey } from 'common/i18n';
import { NO_GAIN_FILTER_TYPES } from 'common/constants';
import { SONG_EQ_MIN_LISTENED_MS } from 'common/songEqRecorder';
import ActiveLayerChips from '../components/ActiveLayerChips';
import useActiveLayers from '../components/useActiveLayers';
import { LAYER_SWATCH } from '../styles/color';
import { useSongEqRecording, useSongEqSaveOn } from '../audio/songEqSession';
import { formatDuration } from '../library/player/NowPlayingBar';
import useIsAutoEqRunning from '../utils/autoEqRunning';
import { useFluidEqContext } from '../utils/FluidEqContext';
import ScenePreview from '../plus/ScenePreview';
import {
  frequencyScale,
  gainScale,
  graphFrequencyRange,
} from '../graph/ChartController';
import LiveTraceCanvas from '../graph/LiveTraceCanvas';
import liveTraceCurves from '../graph/liveTraceCurves';
import {
  useGraphLook,
  useWatchedGraphWave,
  useWaveOrientation,
} from '../utils/graphStyle';
import { useCurrentEngine } from '../utils/audioEngineContext';
import { liveEnginePreamp } from '../utils/enginePreamp';
import { useTranslation } from '../utils/I18nContext';
import { useShownSceneSky } from '../utils/sceneTintStore';
import { useSmartEqRun } from '../utils/smartEqRun';
import { sortHelper } from '../utils/utils';
import AnchoredMenu from '../widgets/AnchoredMenu';
import paintEqCurves from './eqCurvePaint';
import PlayerIcon from './PlayerIcon';
import useMenuDismiss from './useMenuDismiss';
import { useIsPlayerVisOpen, useIsVisInsideCurve } from './playerLayout';
import useGraphScenePack from './useGraphScenePack';
import usePlayerCurves from './usePlayerCurves';

/** The screen draws twelve decibels either way, as a graphic EQ's does. */
const RANGE_DB = 12;

/** A fader being held, for the screen's corner. */
export interface IBandFocus {
  label: string;
  gain: number;
}

/**
 * The equalizer's screen: what is applied besides the bands along the top,
 * the curve of what is heard across the middle with the bands' own dashed
 * under it, and what Smart EQ is doing along the bottom.
 *
 * The top line is the EQ page's "Also applied", as indicators: lit is on,
 * dim is off, and a press switches that layer without removing it — the
 * same switch its chip is, from the same hook. The words open the chips
 * themselves, with their strengths and their remove buttons.
 */
const EqScreen = ({ focus }: { focus: IBandFocus | undefined }) => {
  const { t } = useTranslation();
  const { filters, isAutoPreAmpOn, isEnabled } = useFluidEqContext();
  const active = useActiveLayers();
  // Whether the preamp on screen is the engine's own rather than the stored
  // one — the same question the fader under this screen asks (`MiniBands`).
  const isAutomaticPreAmp = useCurrentEngine() === 'fluid' && isAutoPreAmpOn;
  const curves = usePlayerCurves(isAutomaticPreAmp);
  // Whether the visualizer is drawn here rather than in a deck of its own.
  const isVisHere = useIsVisInsideCurve();
  // The visualizer's switch. With it off there is no visualizer to name, and
  // the strip below the screen goes with it (Ivan, 2026-09-22).
  const isVisOn = useIsPlayerVisOpen();
  const scene = useGraphScenePack();
  /** A Plus visualizer playing behind this screen, over its whole glass. */
  const hasSceneBehind = isVisHere && scene.state === 'ready';
  // The free look's drawing, for whenever the chosen look is not a scene —
  // the same trace the visualizer deck falls back to, from the same settings.
  const look = useGraphLook();
  const orientation = useWaveOrientation();
  // Full screen's, exactly as the visualizer deck beside it: this window is a
  // picture to watch, not one of the graph's three view modes.
  const { height: waveHeight, position: wavePosition } = useWatchedGraphWave();
  const [sceneBox, setSceneBox] = useState({ width: 0, height: 0 });
  /** Exactly as the visualizer deck draws it: the graph's own settings. */
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
  const traceX = useMemo(
    () => frequencyScale(sceneBox.width, 0, 0, graphFrequencyRange(true)),
    [sceneBox.width],
  );
  const traceY = useMemo(
    () => gainScale(sceneBox.height, 0, 0),
    [sceneBox.height],
  );
  // The visualizer's colour as the window is wearing it — what the curve's
  // own tint resolves from.
  const sky = useShownSceneSky();
  const { status, listeningFor } = useSmartEqRun();
  const isMeasuring = useIsAutoEqRunning();
  const isSaveOn = useSongEqSaveOn();
  const recording = useSongEqRecording();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const holder = useRef<HTMLSpanElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const plotRef = useRef<HTMLDivElement>(null);
  const closeMenu = useCallback(() => setIsMenuOpen(false), []);
  useMenuDismiss(isMenuOpen, holder, closeMenu);

  const bands = useMemo(
    () =>
      Object.values(filters)
        .sort(sortHelper)
        .filter((band) => !NO_GAIN_FILTER_TYPES.includes(band.type)),
    [filters],
  );

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (canvas) {
      paintEqCurves(canvas, {
        curves,
        bands,
        // Read here rather than held in state: under Auto normalize the engine
        // ramps this at display rate, and taken as state every step of a ramp
        // would re-render the deck (`enginePreamp.ts`).
        offsetDb: isAutomaticPreAmp ? liveEnginePreamp.read() : 0,
        isEnabled,
        rangeDb: RANGE_DB,
        // The grid goes with a Plus visualizer: lines ruled across a
        // photograph are furniture (Ivan, 2026-09-22).
        hasGrid: !hasSceneBehind,
        lineWidth: 2,
        pointRadius: 2.2,
      });
    }
  }, [bands, curves, hasSceneBehind, isAutomaticPreAmp, isEnabled]);

  useEffect(() => {
    draw();
  }, [draw]);

  // The curve is painted in the window's colour, and that colour arrives as a
  // FADE — with a scene's own colour measured a moment after it is picked. A
  // single repaint when the look changes therefore draws a colour still on
  // its way, which is why the curve used to catch up seconds later or not at
  // all (Ivan, 2026-09-22). Repainted each frame until a frame changes
  // nothing, and not one frame more.
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) {
      return undefined;
    }
    let frame = 0;
    let previous = '';
    const settle = () => {
      const tint = getComputedStyle(canvas)
        .getPropertyValue('--player-curve-tint')
        .trim();
      draw();
      if (tint !== previous) {
        previous = tint;
        frame = requestAnimationFrame(settle);
      }
    };
    frame = requestAnimationFrame(settle);
    return () => cancelAnimationFrame(frame);
  }, [draw, sky]);

  // The heard curve follows the preamp fader beside it, whichever preamp that
  // is. Under Auto normalize on the FluidEQ Engine the fader stands at the
  // engine's own figure while the curve was still drawn from the stored one,
  // so pulling the level down moved the fader and left the curve where it was
  // (Ivan, 2026-09-22). Redrawn on the store's own signal, which only speaks
  // when the figure has actually moved — never on a clock.
  useEffect(
    () => (isAutomaticPreAmp ? liveEnginePreamp.subscribe(draw) : undefined),
    [draw, isAutomaticPreAmp],
  );
  // The latest painter, for the observer below, which must not be torn down
  // and set up again every time the painter's identity changes: re-observing
  // fires the callback afresh, and the callback used to clear the canvas.
  const drawRef = useRef(draw);
  drawRef.current = draw;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || typeof ResizeObserver === 'undefined') {
      return undefined;
    }
    const observer = new ResizeObserver(([entry]) => {
      const ratio = window.devicePixelRatio || 1;
      const width = Math.max(1, Math.round(entry.contentRect.width * ratio));
      const height = Math.max(1, Math.round(entry.contentRect.height * ratio));
      // ONLY WHEN THE SIZE HAS ACTUALLY CHANGED. Assigning to `canvas.width`
      // wipes the bitmap whether or not the number is different, so every
      // re-measure of the deck blanked the curve and painted it again —
      // which is the flicker on the way between Bands and Tone, where the
      // faces are different heights and the screen is measured several times
      // as the window settles (Ivan, 2026-09-22).
      if (canvas.width !== width || canvas.height !== height) {
        canvas.width = width;
        canvas.height = height;
        drawRef.current();
      }
    });
    observer.observe(canvas);
    return () => observer.disconnect();
  }, []);

  // The picture's box, in CSS pixels: the live trace is handed a size and
  // sizes its own bitmap from it, the way the visualizer deck does.
  useEffect(() => {
    const plot = plotRef.current;
    if (!plot || !isVisHere || typeof ResizeObserver === 'undefined') {
      return undefined;
    }
    const observer = new ResizeObserver(([entry]) => {
      const width = Math.round(entry.contentRect.width);
      const height = Math.round(entry.contentRect.height);
      setSceneBox((previous) =>
        previous.width === width && previous.height === height
          ? previous
          : { width, height },
      );
    });
    observer.observe(plot);
    return () => observer.disconnect();
  }, [isVisHere]);

  const smartLine = status || (isMeasuring ? listeningFor : '');
  /**
   * What the corner is saying, and therefore what the line beside it names.
   *
   * With no fader held and no song being measured, the corner carries the
   * visualizer's name — so the left of the strip becomes its label, the way
   * every other pair of name and value in this app is laid out (Ivan,
   * 2026-09-22). A Plus visualizer says so, in the Plus badge's own colours.
   */
  const isLookNamed =
    isVisOn &&
    !focus &&
    !(isMeasuring && isSaveOn && recording.title !== undefined);
  const isPlusLook = scene.state === 'ready';
  let corner = '';
  if (focus) {
    corner = `${focus.label} ${focus.gain > 0 ? '+' : ''}${focus.gain.toFixed(1)} ${t('player.unit.db')}`;
  } else if (isMeasuring && isSaveOn && recording.title !== undefined) {
    corner = recording.willSave
      ? t('player.eq.songSaves')
      : t('songEq.listening', {
          remaining: formatDuration(
            Math.max(0, SONG_EQ_MIN_LISTENED_MS - recording.listenedMs),
          ),
        });
  } else {
    // NOTHING ELSE TO SAY HERE, so it says what is playing over the screen:
    // the visualizer's own name — the scene's title, or the name of the free
    // look the graph is set to. The corner is otherwise empty whenever no
    // fader is held and Smart EQ is not measuring, which is most of the time,
    // and an empty line under a picture nobody has been told the name of is a
    // line doing nothing.
    const lookName = isPlusLook
      ? scene.label
      : t(`graph.styleName.${look.style}` as TranslationKey);
    corner = isLookNamed ? lookName : '';
  }

  return (
    <div className={`player-eq-screen${isEnabled ? '' : ' is-off'}`}>
      {/* A PLUS VISUALIZER TAKES THE WHOLE GLASS, the two lines of text
          included — it is a picture somebody chose to watch, not a second
          reading of the same sound (Ivan, 2026-09-22). A free look's drawing
          stays inside the plot, beside the grid it is read against. */}
      {isVisHere && isPlusLook && (
        <div
          className="player-eq-screen__scene player-eq-screen__scene--full"
          aria-hidden="true"
        >
          <ScenePreview
            identity={scene.identity}
            madeBy={scene.madeBy}
            pack={scene.pack}
            label={scene.label}
            tuning={scene.tuning}
            // Nothing to report from here: the graph is where a scene that
            // cannot be run says so, and the free look it falls back to is
            // what this draws in the meantime.
            onTrouble={() => undefined}
          />
        </div>
      )}
      <div className="player-eq-screen__applied">
        <span className="player-eq-screen__menu" ref={holder}>
          <button
            type="button"
            className="player-eq-screen__open"
            aria-haspopup="dialog"
            aria-expanded={isMenuOpen}
            title={t('eq.layers.aria')}
            onClick={() => setIsMenuOpen((open) => !open)}
          >
            {t('eq.layers')}
            <PlayerIcon
              name="caret"
              className="player-icon player-icon--caret"
            />
          </button>
          <AnchoredMenu
            anchor={holder.current}
            isOpen={isMenuOpen}
            align="left"
            role="dialog"
            className="active-layers__menu player-layers-menu"
            ariaLabel={t('eq.layers.aria')}
          >
            {active.layers.length > 0 ? (
              <ActiveLayerChips active={active} />
            ) : (
              <p className="player-layers-menu__empty">
                {t('player.eq.nothingApplied')}
              </p>
            )}
          </AnchoredMenu>
        </span>
        <span className="player-eq-screen__tags">
          {active.layers.map((layer) => {
            const isOff =
              (layer.feature !== undefined &&
                active.isBypassed(layer.feature)) ||
              layer.isInactive === true;
            return (
              <button
                key={layer.key}
                type="button"
                className={`player-tag${isOff ? '' : ' is-lit'}`}
                // Each layer's lamp in the colour its curve is drawn in, the
                // one the EQ page's own chips wear.
                style={
                  {
                    '--player-tag-lamp': LAYER_SWATCH[layer.key],
                  } as CSSProperties
                }
                aria-pressed={!isOff}
                disabled={layer.feature === undefined || !isEnabled}
                title={
                  isOff
                    ? t('eq.layers.enable', { layer: layer.label })
                    : t('eq.layers.disable', { layer: layer.label })
                }
                onClick={() => active.toggle(layer)}
              >
                {layer.label}
              </button>
            );
          })}
        </span>
      </div>
      <div className="player-eq-screen__plot" ref={plotRef}>
        {/* THE VISUALIZER, WHEN THE PLAYER IS ONE COLUMN. Stacked, the
            visualizer has no deck of its own — the player is tall enough
            without a third block — so it plays here, behind the curve, on the
            one surface in a narrow player with room for a picture. Widened to
            two columns it goes back to being its own deck and this is empty
            glass again (`useIsVisInsideCurve`). Switched off, the screen is
            what it always was.

            Whatever the graph is set to, the way the deck draws it: a Plus
            visualizer through its own runner, anything else through the
            graph's live trace (Ivan, 2026-09-22). Only ever one of them
            running, because only one of the two places is ever drawing. */}
        {isVisHere && scene.state !== 'ready' && sceneBox.width > 0 && (
          <div className="player-eq-screen__scene" aria-hidden="true">
            <LiveTraceCanvas
              curves={traceCurves}
              xScale={traceX}
              yScale={traceY}
              width={sceneBox.width}
              height={sceneBox.height}
              offsetLeft={0}
              offsetTop={0}
              isForeground
            />
          </div>
        )}
        <canvas
          ref={canvasRef}
          className="player-eq-screen__curve"
          aria-label={t('player.eq.curve')}
        />
      </div>
      {/* ALWAYS HERE, even with nothing to say (Ivan, 2026-09-22). Its
          height is the screen's last row whether or not a word is in it:
          taken away when it falls silent, the curve above would grow by its
          height and shrink again the moment a fader was touched, and the
          drawing somebody is reading would jump under their hand. Empty is
          how it hides. */}
      <div className="player-eq-screen__status">
        <span className="player-eq-screen__smart" role="status">
          {smartLine ||
            (isLookNamed && (
              <>
                {t('sidebar.visualizer')}
                {isPlusLook && (
                  <b className="player-eq-screen__plus">
                    {t('graph.scene.badge')}
                  </b>
                )}
              </>
            ))}
        </span>
        <span className="player-eq-screen__corner">{corner}</span>
      </div>
    </div>
  );
};

export default EqScreen;
