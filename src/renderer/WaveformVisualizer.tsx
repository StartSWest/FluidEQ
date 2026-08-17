/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU General Public License as published by
the Free Software Foundation, either version 3 of the License, or
(at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
GNU General Public License for more details.

You should have received a copy of the GNU General Public License
along with this program.  If not, see <https://www.gnu.org/licenses/>.
*/

/**
 * The titlebar's live output meter, drawn on a canvas rather than as SVG paths.
 *
 * WHY THIS IS NOT A PATH ANY MORE. Three `d` attributes were rewritten on every
 * drawn frame, and a `d` is not a cheap assignment: it invalidates style,
 * re-parses the whole string, re-lays-out the figure and re-rasterises the
 * region, and all four stages run again on the next frame. The meter draws at
 * thirty ordinarily and — this is the part that matters — at the display's full
 * rate for as long as euphoria is on, which is the mode somebody deliberately
 * leaves running. A canvas draw is a resource update instead: the pixels are
 * replaced and nothing else in the document has an opinion about it.
 *
 * WHAT DID NOT CHANGE. `createWaveformShape` still returns SVG path data for
 * all ten styles, because `new Path2D(d)` takes exactly that string. The shapes,
 * the easing and the normalising are untouched — this is a renderer swap, not a
 * redesign, and the geometry was never the problem.
 *
 * WHAT STAYS IN THE DOM. The pane, the labels, the held peak, the euphoria
 * pill. Those are text and controls; they change when the audio changes *state*
 * rather than when it moves, and they have to be hit-tested and read aloud.
 *
 * WHERE THE STYLESHEET WENT. A canvas has no cascade to appeal to, so every
 * rule that used to paint a path — the ramps, the per-style fills, the paused
 * and clipping treatments, the euphoria halo — is resolved in the frame loop
 * below and the stylesheet keeps only what is still a box.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { getStreakJoy } from 'common/rhythmGame';
import { easeTowards, getEaseFactor } from 'common/smoothing';
import {
  WaveformStyle,
  createWaveformShape,
  nextWaveformStyle,
} from 'common/waveformStyles';
import {
  BASELINE_DASH,
  BASELINE_STROKE,
  BODY_STOPS,
  CLIP_LAYERS,
  EUPHORIA_GLOW_ALPHA,
  EUPHORIA_GLOW_WIDTH,
  GRID_DIVISIONS,
  GRID_INSET,
  GRID_STROKE,
  NEON_LAYERS,
  NO_DASH,
  NO_LAYERS,
  PAUSED_STROKE,
  PEAK_RELEASE_DB,
  SILENCE_DB,
  WAVEFORM_AMPLITUDE,
  WAVEFORM_AMPLITUDE_MAX,
  WAVEFORM_BLEED,
  WAVEFORM_HALF_LIFE_MS,
  WAVEFORM_HEIGHT,
  WAVEFORM_STYLE_KEY,
  WAVEFORM_WIDTH,
  normalise,
  peakDbOf,
  resolveStylePaint,
  setAlpha,
} from './waveformPaint';
import {
  useLiveAudioControl,
  useLiveAudioFrame,
} from './audio/LiveAudioContext';
import { useRhythmRun } from './utils/rhythmRun';
import { useSmoothFrames } from './utils/useSmoothFrames';
import { BAND_SPECTRUM_STOPS } from './utils/bandColors';
import {
  toggleEuphoriaEnabled,
  useIsEuphoriaAchieved,
  useIsEuphoric,
} from './utils/euphoriaMode';
import { useTitlebarWaveHidden } from './utils/graphStyle';
import { useTranslation } from './utils/I18nContext';
import './styles/WaveformVisualizer.scss';

const WaveformVisualizer = () => {
  const isTitlebarWaveHidden = useTitlebarWaveHidden();
  const { t } = useTranslation();
  // Subscribed rather than read from the DOM class the shell sets, so this
  // re-renders when the run changes instead of being told by a stylesheet.
  // Both halves of the mode: earned right now, or switched on by someone who
  // earned it before. The look is the same either way.
  const hasReached = useIsEuphoriaAchieved();
  const isEuphoric = useIsEuphoric(getStreakJoy(useRhythmRun().streak) >= 1);
  const { isClipping, waveform } = useLiveAudioFrame();
  // `togglePaused` is deliberately not taken. Clicking cycles the meter style
  // now, so pausing has no trigger here — the analyser is still pausable
  // through the control context, it simply is not this button any more, and
  // the support panel it used to open in euphoria is still one click away on
  // the creature beside it.
  const { isActive, isPaused } = useLiveAudioControl();

  // Every sample eased toward the new frame instead of jumping to it.
  //
  // The analyser publishes about twenty-two times a second, which is fast
  // enough to be live and slow enough that each frame lands as a visible
  // snap — the trace flickers rather than flows. One multiply-add per sample
  // fixes it, which is nothing next to the drawing that follows.
  //
  // Euphoria eases harder. The meter is a meter first, so at rest it stays
  // responsive enough to read; at the ceiling nobody is reading it, they are
  // watching it, and glide is the whole point.
  //
  // Smoothed HERE rather than in the analyser, because the game's beat
  // detection runs off the same frames and needs the transients left sharp —
  // smoothing at the source would round off the very edges it looks for.
  // The newest measurement, and the shape currently drawn chasing it.
  const targetRef = useRef<number[]>([]);
  // Remembered across launches: which one somebody likes is a preference, and
  // being handed back a different meter every morning is not charming.
  const [style, setStyle] = useState<WaveformStyle>(() => {
    try {
      return (window.localStorage.getItem(WAVEFORM_STYLE_KEY) ||
        'line') as WaveformStyle;
    } catch {
      return 'line';
    }
  });
  const styleRef = useRef(style);
  styleRef.current = style;

  const cycleStyle = useCallback(() => {
    setStyle((current) => {
      const next = nextWaveformStyle(current);
      try {
        window.localStorage.setItem(WAVEFORM_STYLE_KEY, next);
      } catch {
        // Not worth failing a click over.
      }
      return next;
    });
  }, []);

  const smoothedRef = useRef<number[]>([]);
  // Where the normalised copy is built, reused between frames. See `normalise`.
  const normalisedRef = useRef<number[]>([]);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  // Held rather than fetched per frame: a context is bound to the element it
  // came from, so the two are taken together and go stale together.
  const contextRef = useRef<CanvasRenderingContext2D | null>(null);
  // The element's own box in CSS pixels, kept by the observer below rather than
  // measured in the frame, so drawing never asks layout a question.
  const sizeRef = useRef({ width: 0, height: 0 });
  // Read inside the animation frame rather than closed over, so changing mode
  // does not have to rebuild the callback and restart the loop.
  const amplitudeRef = useRef(WAVEFORM_AMPLITUDE);
  amplitudeRef.current = isEuphoric
    ? WAVEFORM_AMPLITUDE_MAX
    : WAVEFORM_AMPLITUDE;
  const normaliseRef = useRef(false);
  normaliseRef.current = isEuphoric;
  // The three states that used to reach the trace as a class on an ancestor.
  const isEuphoricRef = useRef(isEuphoric);
  isEuphoricRef.current = isEuphoric;
  const isPausedRef = useRef(isPaused);
  isPausedRef.current = isPaused;
  const isClippingRef = useRef(isClipping);
  isClippingRef.current = isClipping;
  // Resolved on the render that changes the style rather than on every frame,
  // so the loop allocates nothing it does not hand to the rasteriser.
  const paint = useMemo(() => resolveStylePaint(style), [style]);
  const paintRef = useRef(paint);
  paintRef.current = paint;

  // One drawn frame, painted straight onto the canvas.
  //
  // Not through React, deliberately. Setting state at display rate would
  // re-render this component sixty times a second to move a line, and the
  // whole reason the shape is eased at all is that redrawing is the expensive
  // part.
  const drawFrame = useCallback((deltaMs: number) => {
    const canvas = canvasRef.current;
    const context = contextRef.current;
    if (!canvas || !context) {
      return false;
    }
    // The pane's own box, which is the element's less the bleed at each edge.
    const boxWidth = sizeRef.current.width - WAVEFORM_BLEED * 2;
    const boxHeight = sizeRef.current.height - WAVEFORM_BLEED * 2;
    if (boxWidth <= 0 || boxHeight <= 0) {
      return false;
    }

    // The backing store, in device pixels.
    //
    // Sized here rather than in an effect because the ratio is not only a
    // property of the element: dragging the window onto a display with a
    // different scale changes it with nothing to observe. Assigning either
    // dimension clears the canvas and resets the context, which is why every
    // piece of context state below is set on every frame rather than once.
    const ratio = window.devicePixelRatio || 1;
    const backingWidth = Math.max(1, Math.round(sizeRef.current.width * ratio));
    const backingHeight = Math.max(
      1,
      Math.round(sizeRef.current.height * ratio),
    );
    if (canvas.width !== backingWidth || canvas.height !== backingHeight) {
      canvas.width = backingWidth;
      canvas.height = backingHeight;
    }
    // Cleared in device pixels, so the rounding above cannot leave a seam of
    // last frame's drawing along an edge.
    context.setTransform(1, 0, 0, 1, 0, 0);
    context.clearRect(0, 0, canvas.width, canvas.height);
    context.setTransform(ratio, 0, 0, ratio, 0, 0);

    const smoothed = smoothedRef.current;
    const moving = easeTowards(
      smoothed,
      targetRef.current,
      getEaseFactor(deltaMs, WAVEFORM_HALF_LIFE_MS),
    );
    // Normalising is the euphoria behaviour — the trace fills the pane
    // regardless of the volume knob — and is applied here so every style gets
    // it rather than each reimplementing it.
    const scaled = normaliseRef.current
      ? normalise(smoothed, normalisedRef.current)
      : smoothed;
    const shape = createWaveformShape(
      scaled,
      styleRef.current,
      WAVEFORM_WIDTH,
      WAVEFORM_HEIGHT,
      amplitudeRef.current,
    );

    const scaleX = boxWidth / WAVEFORM_WIDTH;
    const scaleY = boxHeight / WAVEFORM_HEIGHT;
    /**
     * The canonical box carried onto the pane — baked into the geometry rather
     * than left on the context.
     *
     * The SVG stretched unevenly (`preserveAspectRatio="none"`) and then kept
     * every stroke out of that stretch (`vector-effect="non-scaling-stroke"`),
     * which is the only reason a 1.8px line over a box four times wider than it
     * is tall does not smear into a smudge. A context scaled the same way would
     * smear it, because a canvas stroke is transformed with the path. Moving
     * the points and leaving the pen alone is how that survives the port.
     */
    const project = {
      a: scaleX,
      b: 0,
      c: 0,
      d: scaleY,
      e: WAVEFORM_BLEED,
      f: WAVEFORM_BLEED,
    };
    const bake = (data: string) => {
      const path = new Path2D();
      path.addPath(new Path2D(data), project);
      return path;
    };

    // Faint rules and a dashed centre, so the pane reads as an instrument
    // rather than a stray line on a dark rectangle. Redrawn with everything
    // else rather than kept on a second static canvas underneath: twelve
    // straight lines cost far less than another layer to composite.
    context.lineJoin = 'round';
    context.lineCap = 'butt';
    context.lineWidth = 1;
    setAlpha(context, 1);
    context.strokeStyle = GRID_STROKE;
    context.setLineDash(NO_DASH);
    context.beginPath();
    for (let division = 1; division < GRID_DIVISIONS; division += 1) {
      const x = WAVEFORM_BLEED + (division * boxWidth) / GRID_DIVISIONS;
      context.moveTo(x, WAVEFORM_BLEED + GRID_INSET * scaleY);
      context.lineTo(
        x,
        WAVEFORM_BLEED + (WAVEFORM_HEIGHT - GRID_INSET) * scaleY,
      );
    }
    context.stroke();

    const centre = WAVEFORM_BLEED + boxHeight / 2;
    context.strokeStyle = BASELINE_STROKE;
    context.setLineDash(BASELINE_DASH);
    context.beginPath();
    context.moveTo(WAVEFORM_BLEED, centre);
    context.lineTo(WAVEFORM_BLEED + boxWidth, centre);
    context.stroke();
    context.setLineDash(NO_DASH);

    // The spectrum, left to right, pinned to the pane rather than to the
    // figure — which is what an `objectBoundingBox` gradient across a
    // full-width path amounted to, and what keeps a given frequency the same
    // colour whether the frame is loud or quiet.
    const traceRamp = context.createLinearGradient(
      WAVEFORM_BLEED,
      0,
      WAVEFORM_BLEED + boxWidth,
      0,
    );
    BAND_SPECTRUM_STOPS.forEach((stop) => {
      traceRamp.addColorStop(stop.offset, stop.color);
    });

    const chosen = paintRef.current;
    const linePath = shape.line ? bake(shape.line) : undefined;
    const mirrorPath = shape.mirror ? bake(shape.mirror) : undefined;
    const figurePath = shape.fill ? bake(shape.fill) : undefined;

    // The halo, and only in euphoria. The line where there is one, the filled
    // body where there is not, so every style is lit rather than only the
    // stroked ones.
    //
    // UNDER the figure rather than over it, which is the whole of this
    // paragraph. A canvas stroke straddles its path, so three and a half of
    // these seven pixels were landing inside the shape — and on the styles
    // built from separate pieces there is not that much shape to land in. A bar
    // is `step * 0.6` wide, which at the analyser's resolution is under three
    // pixels, so the halo covered the piece entirely and the spectrum fill
    // underneath stopped being visible at all. Drawn first, the fill paints back
    // over the inner half and only the outer half is left showing, which is what
    // a glow round a shape is supposed to look like.
    //
    // It stays a plain centred stroke rather than the masked double-weight one
    // the graph's border uses: this is light coming off the figure and not a
    // border, so having it read faintly through a translucent fill is right
    // where a border showing through would not be.
    const glowPath = linePath ?? figurePath;
    if (isEuphoricRef.current && glowPath) {
      setAlpha(context, EUPHORIA_GLOW_ALPHA);
      context.strokeStyle = traceRamp;
      context.lineWidth = EUPHORIA_GLOW_WIDTH;
      context.lineCap = 'round';
      context.stroke(glowPath);
    }

    if (figurePath) {
      let ramp: CanvasGradient = traceRamp;
      if (chosen.fill === 'body') {
        // Built only for the styles that ask for it, since most do not.
        const bodyRamp = context.createLinearGradient(
          WAVEFORM_BLEED,
          0,
          WAVEFORM_BLEED + boxWidth,
          0,
        );
        BODY_STOPS.forEach((stop) => {
          bodyRamp.addColorStop(stop.offset, stop.colour);
        });
        ramp = bodyRamp;
      }
      setAlpha(context, chosen.fillAlpha);
      context.fillStyle = ramp;
      context.fill(figurePath);
    }

    // Which light the trace is under. Clipping outranks paused, exactly as the
    // later stylesheet rule outranked the earlier one: a paused analyser that
    // was clipping when it stopped keeps the warning.
    let haloLayers = NEON_LAYERS;
    if (isClippingRef.current) {
      haloLayers = CLIP_LAYERS;
    } else if (isPausedRef.current) {
      haloLayers = NO_LAYERS;
    }
    const strokeColour = isPausedRef.current ? PAUSED_STROKE : traceRamp;

    context.lineCap = chosen.lineCap;
    const strokeFigure = (path: Path2D) => {
      haloLayers.forEach((layer) => {
        setAlpha(context, chosen.strokeAlpha * layer.alpha);
        context.strokeStyle = layer.colour;
        context.lineWidth = chosen.strokeWidth + layer.widen;
        context.stroke(path);
      });
      setAlpha(context, chosen.strokeAlpha);
      context.strokeStyle = strokeColour;
      context.lineWidth = chosen.strokeWidth;
      context.stroke(path);
    };
    if (linePath) {
      strokeFigure(linePath);
    }
    // The mirrored edge, stroked the same way, so the shape is outlined rather
    // than being a lit top over a bare bottom.
    if (mirrorPath) {
      strokeFigure(mirrorPath);
    }

    return moving;
  }, []);

  // The celebration gets the display's full rate and everything else is
  // capped at thirty; the hook reads which from the shell, so this does not
  // have to re-render for the rate to change.
  //
  // Always enabled, where the SVG version switched the loop off with the
  // analyser. A stopped path keeps its `d` and can still be recoloured by a
  // class; a stopped canvas keeps whatever pixels it last drew and nothing can
  // reach them, so pausing has to be *drawn* rather than declared. The loop
  // still costs nothing when there is nothing to do — it reports back that the
  // shape has arrived and is not queued again until something kicks it.
  const kickFrames = useSmoothFrames(drawFrame, { isEnabled: true });

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) {
      return;
    }
    contextRef.current = canvas.getContext('2d');
  }, []);

  /**
   * Watch the box, because everything about this drawing is measured from it.
   *
   * The SVG scaled itself: one `viewBox` and the browser did the rest, through
   * a window resize, a narrower titlebar and the seven hundred milliseconds the
   * pane spends growing into euphoria. A canvas is a bitmap and knows none of
   * that, so the observer is what replaces it — it fires on every step of that
   * transition and each one asks for a frame.
   *
   * Kicking rather than re-rendering: the size lands in a ref the loop already
   * reads, so a resize costs a draw and not a React pass.
   */
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || typeof ResizeObserver === 'undefined') {
      return undefined;
    }
    const observer = new ResizeObserver((entries) => {
      const box = entries[entries.length - 1]?.contentRect;
      if (!box) {
        return;
      }
      sizeRef.current.width = box.width;
      sizeRef.current.height = box.height;
      kickFrames();
    });
    observer.observe(canvas);
    return () => observer.disconnect();
  }, [kickFrames]);

  // A new measurement is a new target, and a reason to start moving again.
  useEffect(() => {
    targetRef.current = waveform;
    if (smoothedRef.current.length !== waveform.length) {
      // First frame, or the analyser changed size. Nothing to ease from, so
      // the shape arrives whole rather than growing out of zero.
      smoothedRef.current = waveform.slice();
    }
    kickFrames();
  }, [kickFrames, waveform]);

  // Anything that changes how the meter looks is also a reason to draw.
  //
  // The loop stops once the shape has arrived, so through a quiet passage
  // nothing is running — and a canvas holds its last frame. Without this the
  // pane would grow into euphoria around a wave still drawn at the old
  // amplitude, a click would cycle to a style that did not appear until the
  // music moved, and pausing would leave the trace lit. Under SVG the cascade
  // covered three of those for free; here every one of them is a frame.
  useEffect(() => {
    kickFrames();
  }, [isClipping, isEuphoric, isPaused, kickFrames, style]);

  // Held peak, so the number is readable instead of a blur of digits.
  const [heldPeak, setHeldPeak] = useState<number | undefined>(undefined);
  const heldPeakRef = useRef<number | undefined>(undefined);

  useEffect(() => {
    const framePeak = peakDbOf(waveform);
    const previous = heldPeakRef.current;
    let next: number | undefined;

    if (
      framePeak !== undefined &&
      (previous === undefined || framePeak > previous)
    ) {
      next = framePeak;
    } else if (previous !== undefined) {
      const released = previous - PEAK_RELEASE_DB;
      next = released > SILENCE_DB ? released : undefined;
    }

    if (next !== heldPeakRef.current) {
      heldPeakRef.current = next;
      setHeldPeak(next);
    }
  }, [waveform]);

  return (
    // A wrapper, so the pill can be a real button.
    //
    // The meter itself is a button — it cycles the meter style — and a button
    // inside a button is invalid markup that browsers resolve by silently
    // unnesting, which loses the inner click. The pill therefore sits beside
    // the meter and is positioned over it.
    <div
      /*
       * Hidden by class, never unmounted.
       *
       * The same rule the full-screen path follows and for the same reason:
       * tearing this down takes its analyser hook with it and builds a new one
       * on the way back, for a component nobody can see. The bar stops being
       * drawn; the capture behind it carries on untouched.
       */
      className={`waveform-visualizer-shell${
        isTitlebarWaveHidden ? ' is-hidden' : ''
      }`}
    >
      <button
        type="button"
        // The style modifier no longer paints anything — the frame loop does —
        // but it stays, because it is the only place the current style is
        // legible to anything outside this component now that the drawing is a
        // bitmap.
        className={`waveform-visualizer waveform-visualizer--${style}${isActive ? ' is-active' : ''}${
          isPaused ? ' is-paused' : ''
        }${isClipping ? ' is-clipping' : ''}`}
        // Says what pressing it does. It used to pause the analyser and, in
        // euphoria, open the support panel; clicking now walks the meter
        // through its styles, and a control whose accessible name describes
        // something it no longer does is worse than one with no name at all.
        aria-label={t('waveform.style')}
        title={t('waveform.style')}
        onClick={cycleStyle}
      >
        <div className="waveform-visualizer__meta">
          <span className="waveform-visualizer__signal">
            <span className="waveform-visualizer__signal-dot" />
            {t(isActive ? 'waveform.live' : 'waveform.signal')}
          </span>
          <span className="waveform-visualizer__readout">
            {/* Clipping outranks the number: once it is lit, the number is the
              least interesting thing on the pane. */}
            {isClipping && (
              <span className="waveform-visualizer__clip">
                {t('waveform.clip')}
              </span>
            )}
            <span className="waveform-visualizer__peak">
              {heldPeak === undefined ? '—' : `${heldPeak.toFixed(1)} dB`}
            </span>
          </span>
        </div>
        <canvas
          ref={canvasRef}
          className="waveform-visualizer__canvas"
          // Grown past its cell on every side, and inline rather than in the
          // stylesheet because the frame loop insets the drawing by exactly the
          // same number. Two copies of it in two languages is two copies that
          // will disagree the first time one is adjusted, and the symptom would
          // be a trace quietly off centre.
          //
          // The backing store is sized in the loop; these are CSS pixels and
          // only say where the drawing sits.
          style={{
            margin: -WAVEFORM_BLEED,
            width: `calc(100% + ${WAVEFORM_BLEED * 2}px)`,
            height: `calc(100% + ${WAVEFORM_BLEED * 2}px)`,
          }}
          // A drawing of the sound, inside a button that already says what it
          // is and what pressing it does. The SVG carried `role="img"` and a
          // label of its own, which the button's `aria-label` overrode anyway;
          // a canvas cannot carry it at all, since a canvas is interactive
          // content and giving interactive content a non-interactive role is
          // how a control disappears from the accessibility tree.
          aria-hidden
        />
      </button>
      {/* The switch, and only for someone who has already reached the ceiling
        the hard way. Before that it does not exist — the first x10 has to be
        earned, or the surprise the whole thing is built around is a button on
        the titlebar.

        Afterwards it stays put, drained of colour when the mode is off, so it
        reads as a control that is available rather than as something that
        vanished. Cosmetic only: it turns the look on, never the multiplier. */}
      {hasReached && (
        <button
          type="button"
          className={`euphoria-pill waveform-visualizer__euphoria${
            isEuphoric ? '' : ' is-dormant'
          }`}
          aria-pressed={isEuphoric}
          title={t('support.game.euphoriaToggle')}
          onClick={toggleEuphoriaEnabled}
        >
          {t('support.game.euphoria')}
        </button>
      )}
    </div>
  );
};

export default WaveformVisualizer;
