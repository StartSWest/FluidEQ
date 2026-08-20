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

import {
  MouseEvent as ReactMouseEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { getStreakJoy } from 'common/rhythmGame';
import { easeTowards, getEaseFactor } from 'common/smoothing';
import {
  WaveformStyle,
  createWaveformShape,
  nextWaveformStyle,
  previousWaveformStyle,
} from 'common/waveformStyles';
import {
  BASELINE_DASH,
  BASELINE_STROKE,
  BODY_STOPS,
  CLIP_LAYERS,
  EUPHORIA_GLOW_ALPHA,
  FFT_WAVEFORM_STYLES,
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
  SPECTRUM_BAR_ATTACK_MS,
  SPECTRUM_BAR_RANGE_DB,
  SPECTRUM_BAR_RELEASE_MS,
  SOFT_GLOW_WAVEFORM_STYLES,
  TRACE_CYAN_STOPS,
  TRACE_RAINBOW_STOPS,
  WAVEFORM_AMPLITUDE_MAX,
  WAVEFORM_BLEED,
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
import { LEVEL_FLOOR_DB } from './graph/outputLevel';
import type { IChartPointData } from './graph/ChartController';
import { useRhythmRun } from './utils/rhythmRun';
import { useSmoothFrames } from './utils/useSmoothFrames';
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
  // `points` is the FFT frequency-domain reading the graph panel draws,
  // read here so the `spectrum` style can build real spectrum bars off it
  // rather than the time-domain envelope every other style uses.
  const { isClipping, points, waveform } = useLiveAudioFrame();
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
  // being handed back a different meter every morning is not charming. The
  // first-run default is `spectrum` — the site's signal-deck look, and the
  // one this pane is designed around; other styles are behind clicks.
  const [style, setStyle] = useState<WaveformStyle>(() => {
    try {
      return (window.localStorage.getItem(WAVEFORM_STYLE_KEY) ||
        'fluid') as WaveformStyle;
    } catch {
      return 'fluid';
    }
  });
  const styleRef = useRef(style);
  styleRef.current = style;

  // A brief announcement of the style the click just landed on. Shown for
  // two seconds in a pill on the pane and then faded out. It lives in DOM
  // rather than on the canvas so it sits outside the clipped stage, on the
  // card itself. The name stays in state through the fade so there is
  // still something to fade away — clearing it when the timer fires would
  // cut the animation at the instant it starts.
  const [announcedStyle, setAnnouncedStyle] = useState<WaveformStyle>(style);
  const [isAnnouncementVisible, setIsAnnouncementVisible] = useState(false);
  const announcementTimerRef = useRef<number | null>(null);

  const cycleStyle = useCallback(
    (event: ReactMouseEvent<HTMLButtonElement>) => {
      // Ctrl (or the platform meta key) walks the cycle backwards, so a
      // click that overshoots does not have to loop through the rest of
      // the styles to come back one step.
      const goingBack = event.ctrlKey || event.metaKey;
      setStyle((current) => {
        const next = goingBack
          ? previousWaveformStyle(current)
          : nextWaveformStyle(current);
        try {
          window.localStorage.setItem(WAVEFORM_STYLE_KEY, next);
        } catch {
          // Not worth failing a click over.
        }
        setAnnouncedStyle(next);
        setIsAnnouncementVisible(true);
        if (announcementTimerRef.current !== null) {
          window.clearTimeout(announcementTimerRef.current);
        }
        announcementTimerRef.current = window.setTimeout(() => {
          setIsAnnouncementVisible(false);
          announcementTimerRef.current = null;
        }, 2000);
        return next;
      });
    },
    [],
  );

  useEffect(
    // The timer is a window handle, not React's; unmount has to clear it
    // or the deferred setState fires against a component that is gone.
    () => () => {
      if (announcementTimerRef.current !== null) {
        window.clearTimeout(announcementTimerRef.current);
      }
    },
    [],
  );

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
  //
  // Every style now takes the max-amplitude, normalised look regardless of
  // mode — the pane's own drawing does not shrink with the volume knob.
  // The distinction between the two is carried by the colours below (cyan
  // tones at rest, rainbow in euphoria), not by the geometry.
  const amplitudeRef = useRef(WAVEFORM_AMPLITUDE_MAX);
  amplitudeRef.current = WAVEFORM_AMPLITUDE_MAX;
  const normaliseRef = useRef(true);
  normaliseRef.current = true;
  // The three states that used to reach the trace as a class on an ancestor.
  const isEuphoricRef = useRef(isEuphoric);
  isEuphoricRef.current = isEuphoric;
  const isPausedRef = useRef(isPaused);
  isPausedRef.current = isPaused;
  // Resolved on the render that changes the style rather than on every frame,
  // so the loop allocates nothing it does not hand to the rasteriser.
  const paint = useMemo(() => resolveStylePaint(style), [style]);
  const paintRef = useRef(paint);
  paintRef.current = paint;
  // The freq-domain points, kept in a ref so the frame loop reads whatever
  // the analyser last published without waking up on each new frame — the
  // loop is already scheduled by the wave-samples effect.
  const pointsRef = useRef<IChartPointData[]>(points);
  pointsRef.current = points;
  // The spectrum bars buffer, reused across frames. Sized to a compact ~48
  // bars regardless of how many FFT points arrive, which is what the
  // titlebar's short width can legibly hold.
  const spectrumMagnitudesRef = useRef<number[]>([]);

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
    // The same in both modes. Rainbow's "smoother" look is bought with
    // FRAME RATE, not with easing: `useSmoothFrames` caps the loop at
    // thirty frames a second at rest and lets it run at the display's own
    // rate in euphoria. Lengthening the half-life for the mode instead
    // made the trace lag the music, which is the opposite of smooth — it
    // is the same picture arriving late.
    //
    // Every style runs the spectrum bars' own ballistics: snap up on the
    // frame a hit lands, ease back over a tenth of a second. That pair is
    // the one arrangement in this pane that reads right, and the styles
    // left on the trace's flat eighteen-millisecond half-life all read as
    // frantic beside them — a symmetric rate that quick tracks the
    // waveform's own oscillation rather than the shape of the sound, so
    // the drawing shivers instead of moving.
    const moving = easeTowards(
      smoothed,
      targetRef.current,
      getEaseFactor(deltaMs, SPECTRUM_BAR_ATTACK_MS),
      getEaseFactor(deltaMs, SPECTRUM_BAR_RELEASE_MS),
    );
    // Normalising is the euphoria behaviour — the trace fills the pane
    // regardless of the volume knob — and is applied here so every style gets
    // it rather than each reimplementing it.
    const scaled = normaliseRef.current
      ? normalise(smoothed, normalisedRef.current)
      : smoothed;
    // The FFT magnitudes are computed for every style that draws bars off
    // the spectrum — `bars`, `mirror-bars`, and the wave-plus-bars
    // `spectrum`. The renderer's imperative bar drawing below runs its
    // own downsample against the same points; this one is for the shared
    // shape function so those three styles read real frequency bands.
    let spectrumMagnitudes: number[] | undefined;
    const stylesUsingFftBars = FFT_WAVEFORM_STYLES.has(styleRef.current);
    if (stylesUsingFftBars && pointsRef.current.length > 0) {
      const source = pointsRef.current;
      const bandCount = 48;
      const bufferForShape = spectrumMagnitudesRef.current;
      if (bufferForShape.length !== bandCount) {
        bufferForShape.length = bandCount;
        bufferForShape.fill(0);
      }
      const stride = source.length / bandCount;
      const dbRange = SPECTRUM_BAR_RANGE_DB;
      for (let bar = 0; bar < bandCount; bar += 1) {
        const start = Math.floor(bar * stride);
        const end = Math.min(source.length, Math.floor((bar + 1) * stride));
        let peakDb = LEVEL_FLOOR_DB;
        for (let index = start; index < end; index += 1) {
          const value = source[index].y;
          if (value > peakDb) {
            peakDb = value;
          }
        }
        bufferForShape[bar] = Math.max(
          0,
          Math.min(1, (peakDb - LEVEL_FLOOR_DB) / dbRange),
        );
      }
      spectrumMagnitudes = bufferForShape;
    }

    const shape = createWaveformShape(
      scaled,
      styleRef.current,
      WAVEFORM_WIDTH,
      WAVEFORM_HEIGHT,
      amplitudeRef.current,
      spectrumMagnitudes,
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

    // Spectrum bars — imperative rather than through the shape, because
    // each bar carries its own hue and its own vertical gradient and a
    // single shared fillStyle on a Path2D can express neither. Ported
    // number-for-number from the FluidEQ site's signal-deck (the panel the
    // "RAINBOW MODE" screenshot Ivan pointed at is showing): a bar every
    // eleven pixels, floor at 82% down the pane, 2px gap, per-bar hue
    // sweep 184°→296°, and a per-bar vertical gradient with the top alpha
    // dimmer in cyan mode (0.24) than in rainbow (0.31). The energy
    // reading is real FFT points from the analyser, downsampled peak-per-
    // bin; a `Math.max(0.12, energy)` floor keeps short stumps showing
    // through silence the way the site's synthetic movement does.
    if (styleRef.current === 'fluid') {
      const source = pointsRef.current;
      const barCount = Math.max(48, Math.floor(boxWidth / 11));
      const buffer = spectrumMagnitudesRef.current;
      if (buffer.length !== barCount) {
        buffer.length = barCount;
        buffer.fill(0);
      }
      // Snap up fast, ease back slowly — classic meter ballistics. Applied
      // per frame so the bars carry motion between FFT publishes: at 60Hz
      // display and 30Hz analyser, every other display frame would sit on
      // the same reading otherwise, and the bars would tick rather than
      // breathe.
      const barRise = getEaseFactor(deltaMs, SPECTRUM_BAR_ATTACK_MS);
      const barFall = getEaseFactor(deltaMs, SPECTRUM_BAR_RELEASE_MS);
      if (source.length > 0) {
        const stride = source.length / barCount;
        for (let bar = 0; bar < barCount; bar += 1) {
          const start = Math.floor(bar * stride);
          const end = Math.min(source.length, Math.floor((bar + 1) * stride));
          let peakDb = LEVEL_FLOOR_DB;
          for (let index = start; index < end; index += 1) {
            const value = source[index].y;
            if (value > peakDb) {
              peakDb = value;
            }
          }
          const target = Math.max(
            0,
            Math.min(1, (peakDb - LEVEL_FLOOR_DB) / SPECTRUM_BAR_RANGE_DB),
          );
          const gap = target - buffer[bar];
          buffer[bar] += gap * (gap > 0 ? barRise : barFall);
        }
      } else {
        // No frames arriving — release toward zero rather than sitting on
        // the last measurement, so the pane settles down when audio stops
        // instead of looking frozen.
        for (let bar = 0; bar < barCount; bar += 1) {
          buffer[bar] += (0 - buffer[bar]) * barFall;
        }
      }

      const rainbowActive = isEuphoricRef.current;
      const barStep = boxWidth / barCount;
      const barWidth = Math.max(1, barStep - 2);
      // The bars stand on the bottom of the stage rather than on 82% of
      // it. The site's own signal-deck leaves that gap because its canvas
      // is much taller than this strip; here it read as the spectrum
      // floating with a band of empty card beneath it.
      const floor = WAVEFORM_BLEED + boxHeight;
      // Bumped a shade brighter than the site's own 0.31/0.24 — Ivan asked
      // for the bars to read a bit stronger, and the pane's dark shell
      // wants a touch more alpha for the same on-screen weight.
      const topAlpha = rainbowActive ? 0.5 : 0.42;
      setAlpha(context, 1);
      for (let index = 0; index < barCount; index += 1) {
        const x = index / Math.max(1, barCount - 1);
        // Flat rather than arched — no `sin(πx)` envelope — so every bar
        // measures the same share of the pane and the drawing reads as a
        // real spectrum rather than as a curved decoration.
        const energy = Math.max(0.12, buffer[index]);
        const barHeight = Math.max(1, energy * boxHeight * 0.82);
        const hue = 184 + x * 112;
        const gradient = context.createLinearGradient(
          0,
          floor - barHeight,
          0,
          floor,
        );
        gradient.addColorStop(0, `hsla(${hue}, 92%, 65%, ${topAlpha})`);
        gradient.addColorStop(1, `hsla(${hue}, 92%, 58%, 0.06)`);
        context.fillStyle = gradient;
        context.fillRect(
          WAVEFORM_BLEED + index * barStep + 1,
          floor - barHeight,
          barWidth,
          barHeight,
        );
      }
    }

    // The spectrum, left to right, pinned to the pane rather than to the
    // figure — which is what an `objectBoundingBox` gradient across a
    // full-width path amounted to, and what keeps a given frequency the same
    // colour whether the frame is loud or quiet.
    //
    // One rule for every style: rainbow when euphoria is on, cyan tones
    // when it is off. No per-style distinction — the whole pane changes
    // together, and the mode carries the difference, not the shape.
    const traceStops = isEuphoricRef.current
      ? TRACE_RAINBOW_STOPS
      : TRACE_CYAN_STOPS;
    const traceRamp = context.createLinearGradient(
      WAVEFORM_BLEED,
      0,
      WAVEFORM_BLEED + boxWidth,
      0,
    );
    traceStops.forEach((stop) => {
      traceRamp.addColorStop(stop.offset, stop.colour);
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

    // How the spectrum family is lit: a soft coloured shadow under the
    // figure rather than the neon halo, in the same two colours the
    // site's signal-deck wave uses. Declared here because both the fill
    // below and the stroke further down install it.
    const isSoftGlow =
      SOFT_GLOW_WAVEFORM_STYLES.has(styleRef.current) && !isPausedRef.current;
    const softGlowColour = isEuphoricRef.current
      ? 'rgba(255, 60, 172, 0.55)'
      : 'rgba(156, 255, 244, 0.66)';

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
      context.save();
      if (isSoftGlow) {
        // Blocks, beads and blades are filled rather than stroked, so
        // without this they would be the only members of the family with
        // no light on them at all — the glow has to go on the fill, not
        // only on the stroke.
        context.shadowColor = softGlowColour;
        context.shadowBlur = isEuphoricRef.current ? 10 : 12;
      }
      setAlpha(context, chosen.fillAlpha);
      context.fillStyle = ramp;
      context.fill(figurePath);
      context.restore();
    }

    // Which light the trace is under. Clipping outranks paused, exactly as the
    // later stylesheet rule outranked the earlier one: a paused analyser that
    // was clipping when it stopped keeps the warning.
    //
    // Spectrum is the exception: it uses the site's `shadowBlur: 8` glow
    // rather than the multi-stroke pink+cyan halo the other styles wear,
    // because that is how the nav-signal wave the port is meant to match
    // is lit. Halo layers are dropped for it below, and the final stroke
    // is drawn inside a save/restore that installs the shadow.
    let haloLayers = NEON_LAYERS;
    if (isOverloadingRef.current) {
      haloLayers = CLIP_LAYERS;
    } else if (isPausedRef.current) {
      haloLayers = NO_LAYERS;
    } else if (SOFT_GLOW_WAVEFORM_STYLES.has(styleRef.current)) {
      // The spectrum family is lit by a soft shadow instead — see the
      // set's own comment for why the neon halo does not suit a figure
      // made of separate pieces.
      haloLayers = NO_LAYERS;
    }
    const rainbowActive = isEuphoricRef.current;
    // The site's signal-deck wave numbers, shared by every stroked member
    // of the spectrum family: a heavy round-capped line over a soft
    // shadow, in the same trace ramp the fill uses so the whole drawing
    // sits in one colour system. Rainbow's blur is the lower of the two —
    // the gradient is already doing the work there, so the halo does not
    // have to.
    const spectrumStrokeWidth = rainbowActive ? 4.2 : 3.2;
    const spectrumShadowBlur = rainbowActive ? 14 : 18;

    const strokeColour = isPausedRef.current ? PAUSED_STROKE : traceRamp;

    context.lineCap = chosen.lineCap;
    const strokeFigure = (path: Path2D) => {
      haloLayers.forEach((layer) => {
        setAlpha(context, chosen.strokeAlpha * layer.alpha);
        context.strokeStyle = layer.colour;
        context.lineWidth = chosen.strokeWidth + layer.widen;
        context.stroke(path);
      });
      if (isSoftGlow) {
        context.save();
        context.shadowColor = softGlowColour;
        context.shadowBlur = spectrumShadowBlur;
        context.lineJoin = 'round';
        context.lineCap = 'round';
        setAlpha(context, chosen.strokeAlpha);
        context.strokeStyle = strokeColour;
        context.lineWidth = spectrumStrokeWidth;
        context.stroke(path);
        context.restore();
        return;
      }
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

    // Nothing else is painted here. The meta row and the style-name pill
    // both live in DOM, outside the stage, so they sit on the pane rather
    // than inside the clipped drawing — see the markup below.
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

  // Held peak, so the number is readable instead of a blur of digits.
  // Back in state because the readout is DOM again: it sits in the meta
  // row above the stage, where it can hug the top of the pane with no
  // padding of its own while only the waveform underneath is inset.
  //
  // THE ONLY THING OUTSIDE THE CANVAS THAT MOVES, and it is quantised so
  // it moves as rarely as it can. The full-precision peak changes on
  // every published frame, and setting state on each one re-rendered this
  // component about thirty times a second to write a string that was
  // usually identical. The displayed figure carries one decimal, so the
  // reading is rounded to one decimal FIRST and state is only touched
  // when that rounded number actually differs — the float underneath can
  // drift as much as it likes for free.
  //
  // Nothing else in the DOM here changes with the audio: the trace, the
  // bars and the glow are all pixels in the canvas, which is a resource
  // update rather than a style invalidation. That is the whole reason
  // this pane is a bitmap.
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

    // Rounded to the decimal the readout shows, so a change the reader
    // could not see never reaches React.
    const shown = next === undefined ? undefined : Math.round(next * 10) / 10;
    if (shown !== heldPeakRef.current) {
      heldPeakRef.current = shown;
      setHeldPeak(shown);
    }
  }, [waveform]);

  // The capture's own verdict, from railed samples — the app's one
  // definition of clipping, and the same one the sidebar meter uses.
  const isOverloading = isClipping;
  const isOverloadingRef = useRef(isOverloading);
  isOverloadingRef.current = isOverloading;

  // Anything that changes how the meter looks is also a reason to draw.
  //
  // The loop stops once the shape has arrived, so through a quiet passage
  // nothing is running — and a canvas holds its last frame. Without this the
  // pane would grow into euphoria around a wave still drawn at the old
  // amplitude, a click would cycle to a style that did not appear until the
  // music moved, and pausing would leave the trace lit. Under SVG the cascade
  // covered three of those for free; here every one of them is a frame.
  //
  // Placed after the peak block rather than beside the other effects
  // because `isOverloading` is derived from the held peak, and an effect
  // cannot depend on a value declared below it.
  useEffect(() => {
    kickFrames();
  }, [isEuphoric, isOverloading, isPaused, kickFrames, style]);

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
        }${isOverloading ? ' is-clipping' : ''}`}
        // Says what pressing it does AND which style is currently drawn — the
        // second half is the only place the choice is legible now that the
        // meter has eleven of them, and hovering is the fastest way to tell
        // one from the next without cycling through the whole set. The style
        // keys ('line', 'spectrum', …) are technical identifiers rather than
        // prose, so they pass through the label as-is rather than each
        // needing an entry in ten locales.
        aria-label={`${t('waveform.style')} — ${style}`}
        title={`${t('waveform.style')} — ${style}`}
        onClick={cycleStyle}
      >
        {/* The meta row, in DOM and outside the stage so it can sit flush
            against the top of the pane. Only the waveform below it is
            inset; these hug the edge. */}
        <span className="waveform-visualizer__meta">
          <span className="waveform-visualizer__signal">
            <span className="waveform-visualizer__signal-dot" />
            {t(isActive ? 'waveform.live' : 'waveform.signal')}
          </span>
          <span className="waveform-visualizer__readout">
            {/* Clipping outranks the number: once it is lit, the number is
                the least interesting thing on the pane. */}
            {isOverloading && (
              <span className="waveform-visualizer__clip">
                {t('waveform.clip')}
              </span>
            )}
            <span className="waveform-visualizer__peak">
              {heldPeak === undefined ? '—' : `${heldPeak.toFixed(1)} dB`}
            </span>
          </span>
        </span>
        {/* The stage: a wrapper whose only job is to clip the canvas to
            the pane's rounded shape. The canvas is deliberately grown
            past the pane on every side so the trace's bloom has somewhere
            to spill, and without something clipping it that overspill
            painted outside the rounded border — squared-off corners with
            wave in them, sitting proud of the card. `overflow: hidden`
            plus an inherited radius is what puts the drawing back inside
            the pane it belongs to. */}
        <span className="waveform-visualizer__stage">
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
        </span>
        {/* The name of the style the click just landed on, outside the
            stage so it sits on the card rather than inside the clipped
            drawing. Always rendered so the fade-out has a name to fade;
            `role="status"` reaches a reader for the same brief window. */}
        <span
          className={`waveform-visualizer__announcement${
            isAnnouncementVisible ? ' is-visible' : ''
          }`}
          role="status"
          aria-hidden={!isAnnouncementVisible}
        >
          {announcedStyle}
        </span>
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
