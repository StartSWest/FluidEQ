/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { PointerEvent, useEffect, useRef } from 'react';
import { FilterTypeEnum } from '../../common/constants';
import { IEqBandSettings, IEqSettings } from '../../common/dsp/chain';
import { biquadCoefficients, biquadMagnitudeDb } from './biquad';
import { readDspAnalyser } from './store';

const MIN_HZ = 20;
const MAX_HZ = 20_000;

/**
 * Vertical half-range.
 *
 * Wider than one band can reach, so a stack that adds up still lands inside
 * the box rather than against its edge — which would read as the EQ refusing
 * to go further.
 */
const RANGE_DB = 18;

const HEIGHT = 300;
/** Insets: room for the dB scale on the left and the frequencies underneath. */
const PAD_L = 46;
const PAD_R = 12;
const PAD_T = 14;
const PAD_B = 26;

const GRID_HZ: [number, string][] = [
  [30, '30'],
  [100, '100'],
  [300, '300'],
  [1_000, '1k'],
  [3_000, '3k'],
  [10_000, '10k'],
];
const GRID_DB = [12, 6, 0, -6, -12];

/** One response point per 2px is smooth without computing what cannot be seen. */
const POINT_STEP_PX = 2;
/** How close a click has to land to grab a handle, in CSS pixels. */
const GRAB_RADIUS = 16;
const HANDLE_R = 8;

/**
 * The spectrum's vertical range, in dBFS.
 *
 * -96 is below anything audible in a 16-bit source and -6 leaves the loudest
 * material short of the ceiling, so a normal track fills most of the box
 * without a mastered one pinning flat against the top.
 */
const SPECTRUM_FLOOR_DB = -96;
const SPECTRUM_TOP_DB = -6;

/**
 * The plot's coordinate maths, at module scope.
 *
 * Outside the component because the paint effect is armed once and must not
 * list them as dependencies: functions recreated per render would tear the
 * ResizeObserver down and rebuild it on every pixel of a drag.
 */
const plotW = (width: number) => Math.max(1, width - PAD_L - PAD_R);
const plotH = (height: number) => Math.max(1, height - PAD_T - PAD_B);

const hzToX = (hz: number, width: number) =>
  PAD_L +
  (Math.log10(hz / MIN_HZ) / Math.log10(MAX_HZ / MIN_HZ)) * plotW(width);

const xToHz = (x: number, width: number) => {
  const across = Math.min(plotW(width), Math.max(0, x - PAD_L));
  return MIN_HZ * (MAX_HZ / MIN_HZ) ** (across / plotW(width));
};

const dbToY = (db: number, height: number) =>
  PAD_T + plotH(height) / 2 - (db / RANGE_DB) * (plotH(height) / 2);

const yToDb = (y: number, height: number) => {
  const span = plotH(height);
  const from = Math.min(PAD_T + span, Math.max(PAD_T, y)) - PAD_T;
  return ((span / 2 - from) / (span / 2)) * RANGE_DB;
};

const toSpec = (band: IEqBandSettings) => ({
  type: band.type as FilterTypeEnum,
  frequency: band.frequency,
  gainDb: band.gainDb,
  quality: band.quality,
});

interface IDspEqGraphProps {
  eq: IEqSettings;
  sampleRate: number;
  selected: number;
  onSelect: (index: number) => void;
  /** Live, while a handle is dragged. */
  onChange: (index: number, next: Partial<IEqBandSettings>) => void;
  /** Once the drag ends. */
  onCommit: () => void;
}

/**
 * The EQ, as the thing you actually work on.
 *
 * Canvas rather than SVG, for two reasons that both bit:
 *
 *  - **One DOM node instead of twenty-odd.** The SVG version rebuilt six band
 *    paths, six handles, eleven grid lines and their labels as elements on
 *    every render — and a render happens on every pixel of a drag. That is a
 *    lot of nodes created and dropped for something the compositor redraws
 *    anyway, and it is exactly the churn the rest of this app already uses
 *    canvas to avoid.
 *  - **Nothing gets stretched.** The SVG stretched a fixed viewBox to the
 *    panel with `preserveAspectRatio="none"`, which scales EVERYTHING: at a
 *    panel around 1800px wide, every circle came out an ellipse and every
 *    label came out horizontally squashed. A canvas is sized in real pixels,
 *    so a circle is a circle.
 *
 * The response is computed from the COEFFICIENTS, so the drift near Nyquist
 * that `dspBiquad.test.ts` measures is on screen rather than hidden behind an
 * idealised shape. A display that draws the request flatters the filter
 * exactly where it is least accurate.
 */
const DspEqGraph = ({
  eq,
  sampleRate,
  selected,
  onSelect,
  onChange,
  onCommit,
}: IDspEqGraphProps) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const dragging = useRef<number | null>(null);
  /**
   * The live props, for the draw loop.
   *
   * The effect that paints must not re-subscribe on every prop change — it
   * would tear down and rebuild the ResizeObserver on every pixel of a drag.
   * It reads through this instead and is armed once.
   */
  const view = useRef<{
    eq: IEqSettings;
    sampleRate: number;
    selected: number;
    redraw?: () => void;
  }>({ eq, sampleRate, selected });
  // Assigned field by field: replacing the object would drop `redraw`, which
  // the paint effect installs once and every later render depends on.
  view.current.eq = eq;
  view.current.sampleRate = sampleRate;
  view.current.selected = selected;

  /** CSS pixels of the drawing area, read from the element each paint. */
  const boxRef = useRef({ width: 0, height: HEIGHT });
  /** Reused across frames: a new array per paint would be 60 a second. */
  const binsRef = useRef(new Float32Array(0));

  const toX = (hz: number) => hzToX(hz, boxRef.current.width);
  const toHz = (x: number) => xToHz(x, boxRef.current.width);
  const toY = (db: number) => dbToY(db, boxRef.current.height);
  const toDb = (y: number) => yToDb(y, boxRef.current.height);

  useEffect(() => {
    const canvas = canvasRef.current;
    const context = canvas?.getContext('2d');
    if (!canvas || !context) {
      return undefined;
    }

    let frame = 0;
    const paint = () => {
      frame = 0;
      const box = canvas.getBoundingClientRect();
      if (box.width < 1) {
        return;
      }
      boxRef.current = { width: box.width, height: box.height };

      // Sized here rather than in an effect: the ratio is not only a property
      // of the element, and dragging the window onto a display with another
      // scale changes it with nothing to observe. Assigning either dimension
      // clears the canvas, so the transform is set every paint.
      const ratio = window.devicePixelRatio || 1;
      const backingW = Math.max(1, Math.round(box.width * ratio));
      const backingH = Math.max(1, Math.round(box.height * ratio));
      if (canvas.width !== backingW || canvas.height !== backingH) {
        canvas.width = backingW;
        canvas.height = backingH;
      }
      context.setTransform(1, 0, 0, 1, 0, 0);
      context.clearRect(0, 0, canvas.width, canvas.height);
      context.setTransform(ratio, 0, 0, ratio, 0, 0);

      const { eq: liveEq, sampleRate: rate, selected: pick } = view.current;
      // Local to the paint, from the box just measured: the module-scope maths
      // takes the size rather than closing over it.
      const W = boxRef.current.width;
      const H = boxRef.current.height;
      const X = (hz: number) => hzToX(hz, W);
      const Y = (db: number) => dbToY(db, H);

      context.font =
        '12px system-ui, -apple-system, "Segoe UI", Roboto, sans-serif';
      context.textBaseline = 'middle';

      GRID_DB.forEach((db) => {
        const y = Math.round(Y(db)) + 0.5;
        context.strokeStyle =
          db === 0 ? 'rgba(255,255,255,0.22)' : 'rgba(255,255,255,0.07)';
        context.lineWidth = 1;
        context.beginPath();
        context.moveTo(PAD_L, y);
        context.lineTo(boxRef.current.width - PAD_R, y);
        context.stroke();
        context.fillStyle = 'rgba(255,255,255,0.38)';
        context.textAlign = 'right';
        context.fillText(db > 0 ? `+${db}` : `${db}`, PAD_L - 8, y);
      });

      context.textAlign = 'center';
      GRID_HZ.forEach(([hz, label]) => {
        const x = Math.round(X(hz)) + 0.5;
        context.strokeStyle = 'rgba(255,255,255,0.07)';
        context.beginPath();
        context.moveTo(x, PAD_T);
        context.lineTo(x, PAD_T + plotH(H));
        context.stroke();
        context.fillStyle = 'rgba(255,255,255,0.38)';
        context.fillText(label, x, boxRef.current.height - PAD_B / 2);
      });

      /**
       * The live spectrum, behind everything else.
       *
       * Tapped after the chain, so what is drawn is what is heard: cut a band
       * and the shape under the curve drops with it. That is the whole reason
       * an EQ shows a spectrum at all — otherwise you are aiming at a guess.
       *
       * Mapped from bin to log-frequency by picking the loudest bin that falls
       * in each pixel column. Averaging would smear the peaks that matter; the
       * bottom octaves have fewer bins than columns and repeat, which is
       * honest — the resolution genuinely is not there.
       */
      const live = readDspAnalyser();
      if (live) {
        if (binsRef.current.length !== live.frequencyBinCount) {
          binsRef.current = new Float32Array(live.frequencyBinCount);
        }
        const bins = binsRef.current;
        live.getFloatFrequencyData(bins);
        const nyquist = rate / 2;
        const floorY = PAD_T + plotH(H);

        context.beginPath();
        context.moveTo(PAD_L, floorY);
        let started = false;
        for (let x = 0; x <= plotW(W); x += 1) {
          const hzFrom = xToHz(PAD_L + x, W);
          const hzTo = xToHz(PAD_L + x + 1, W);
          const first = Math.floor((hzFrom / nyquist) * bins.length);
          const last = Math.max(
            first,
            Math.min(
              bins.length - 1,
              Math.ceil((hzTo / nyquist) * bins.length),
            ),
          );
          let peak = -Infinity;
          for (let bin = first; bin <= last; bin += 1) {
            if (bins[bin] > peak) {
              peak = bins[bin];
            }
          }
          if (!Number.isFinite(peak)) {
            peak = SPECTRUM_FLOOR_DB;
          }
          const level =
            (Math.max(SPECTRUM_FLOOR_DB, peak) - SPECTRUM_FLOOR_DB) /
            (SPECTRUM_TOP_DB - SPECTRUM_FLOOR_DB);
          const y = floorY - level * plotH(H);
          if (started) {
            context.lineTo(PAD_L + x, y);
          } else {
            context.lineTo(PAD_L + x, y);
            started = true;
          }
        }
        context.lineTo(PAD_L + plotW(W), floorY);
        context.closePath();
        context.fillStyle = 'rgba(0,229,207,0.10)';
        context.fill();
        context.strokeStyle = 'rgba(0,229,207,0.22)';
        context.lineWidth = 1;
        context.stroke();
      }

      /**
       * The rate the filters are actually BUILT at, not the session's.
       *
       * With oversampling on, the worklet designs every band for the doubled
       * or quadrupled rate. Drawing them at the session rate showed a curve
       * that was not the one being heard — the difference lives near Nyquist,
       * which is exactly where oversampling is meant to help, so the graph was
       * hiding the very thing the control does.
       */
      const designRate = rate * Math.max(1, liveEq.oversample);

      const active = liveEq.bands.map((one) =>
        one.enabled
          ? biquadCoefficients(
              toSpec(one),
              designRate,
              liveEq.model,
              liveEq.modelAmount,
            )
          : undefined,
      );

      // Audible and, until now, invisible: the subsonic high pass runs ahead of
      // the bands and shaped the sound without appearing on the curve at all.
      const subsonic =
        liveEq.subsonicHz > 0
          ? biquadCoefficients(
              {
                type: FilterTypeEnum.HPQ,
                frequency: liveEq.subsonicHz,
                gainDb: 0,
                quality: 0.707,
              },
              rate,
            )
          : undefined;
      const steps = Math.max(2, Math.round(plotW(W) / POINT_STEP_PX));

      // Each band's own contribution, faint. The sum alone cannot say which
      // band is responsible for a dip.
      active.forEach((coefficients, index) => {
        if (!coefficients) {
          return;
        }
        context.beginPath();
        for (let i = 0; i <= steps; i += 1) {
          const hz = MIN_HZ * (MAX_HZ / MIN_HZ) ** (i / steps);
          const y = Y(biquadMagnitudeDb(coefficients, hz, designRate));
          if (i === 0) {
            context.moveTo(X(hz), y);
          } else {
            context.lineTo(X(hz), y);
          }
        }
        const isPick = index === pick;
        context.strokeStyle = isPick
          ? 'rgba(156,255,244,0.55)'
          : 'rgba(255,255,255,0.15)';
        context.lineWidth = isPick ? 1.5 : 1;
        context.stroke();
      });

      // The cut drawn on its own, in a colder colour than the bands: it is not
      // a band and cannot be selected or dragged, so it should not look like
      // one.
      if (subsonic) {
        context.beginPath();
        for (let i = 0; i <= steps; i += 1) {
          const hz = MIN_HZ * (MAX_HZ / MIN_HZ) ** (i / steps);
          const y = Y(biquadMagnitudeDb(subsonic, hz, rate));
          if (i === 0) {
            context.moveTo(X(hz), y);
          } else {
            context.lineTo(X(hz), y);
          }
        }
        context.strokeStyle = 'rgba(120,170,255,0.45)';
        context.lineWidth = 1.25;
        context.setLineDash([4, 3]);
        context.stroke();
        context.setLineDash([]);
      }

      const totalAt = (hz: number): number => {
        let total = subsonic ? biquadMagnitudeDb(subsonic, hz, rate) : 0;
        active.forEach((coefficients) => {
          if (coefficients) {
            total += biquadMagnitudeDb(coefficients, hz, designRate);
          }
        });
        return total;
      };

      context.beginPath();
      for (let i = 0; i <= steps; i += 1) {
        const hz = MIN_HZ * (MAX_HZ / MIN_HZ) ** (i / steps);
        const y = Y(totalAt(hz));
        if (i === 0) {
          context.moveTo(X(hz), y);
        } else {
          context.lineTo(X(hz), y);
        }
      }
      context.strokeStyle = '#00e5cf';
      context.lineWidth = 2.5;
      context.lineJoin = 'round';
      context.stroke();

      /**
       * The fuzz, as grain along the curve.
       *
       * Harmonic colour has no magnitude response to plot — it adds frequencies
       * rather than shaping the ones present — so the honest picture is a
       * roughening of the line rather than a shape of its own.
       *
       * The offsets come from a fixed function of the position, NOT from
       * `Math.random`: this repaints on every animation frame while audio is
       * playing, and random grain would strobe rather than sit still.
       */
      if (liveEq.fuzzAmount > 0) {
        const grain = liveEq.fuzzAmount * 2.6;
        [0.6, -0.9].forEach((phase, pass) => {
          context.beginPath();
          for (let i = 0; i <= steps; i += 1) {
            const hz = MIN_HZ * (MAX_HZ / MIN_HZ) ** (i / steps);
            const wobble =
              Math.sin(i * 1.9 + phase * 7) * Math.sin(i * 0.47 + phase);
            const y = Y(totalAt(hz)) + wobble * grain;
            if (i === 0) {
              context.moveTo(X(hz), y);
            } else {
              context.lineTo(X(hz), y);
            }
          }
          context.strokeStyle =
            pass === 0 ? 'rgba(0,229,207,0.30)' : 'rgba(255,196,120,0.26)';
          context.lineWidth = 1;
          context.stroke();
        });
      }

      liveEq.bands.forEach((one, index) => {
        const x = X(one.frequency);
        const y = Y(one.gainDb);
        const isPick = index === pick;
        context.globalAlpha = one.enabled ? 1 : 0.32;
        context.beginPath();
        context.arc(x, y, HANDLE_R, 0, Math.PI * 2);
        context.fillStyle = isPick ? '#00e5cf' : 'rgba(7,5,18,0.85)';
        context.fill();
        context.strokeStyle = isPick ? '#ffffff' : 'rgba(0,229,207,0.7)';
        context.lineWidth = 2;
        context.stroke();
        context.globalAlpha = 1;
      });
    };

    /**
     * One frame at a time, and continuously while there is audio to show.
     *
     * Two things drive a repaint and they want different rates. A knob or a
     * drag changes the curve and needs exactly one frame; the spectrum changes
     * on its own and needs every frame. So the loop keeps running while an
     * analyser is published and stops when there is none — a DSP page with
     * nothing playing costs nothing, and one with audio is a normal 60fps
     * canvas rather than sixty React renders a second.
     */
    const schedule = () => {
      if (frame === 0) {
        frame = window.requestAnimationFrame(tick);
      }
    };

    function tick() {
      frame = 0;
      paint();
      if (readDspAnalyser()) {
        schedule();
      }
    }

    view.current.redraw = schedule;
    schedule();

    const observer =
      typeof ResizeObserver === 'function'
        ? new ResizeObserver(schedule)
        : undefined;
    observer?.observe(canvas);

    return () => {
      if (frame !== 0) {
        window.cancelAnimationFrame(frame);
      }
      observer?.disconnect();
    };
  }, []);

  // Repaint when anything drawn changes. The loop itself is armed once above.
  useEffect(() => {
    view.current.redraw?.();
  });

  const localPoint = (event: PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) {
      return undefined;
    }
    const box = canvas.getBoundingClientRect();
    return { x: event.clientX - box.left, y: event.clientY - box.top };
  };

  const onDown = (event: PointerEvent<HTMLCanvasElement>) => {
    const point = localPoint(event);
    if (!point) {
      return;
    }
    // Nearest handle within reach, so a click near two of them takes the one
    // actually aimed at rather than the first in the array.
    let best = -1;
    let bestDistance = GRAB_RADIUS;
    eq.bands.forEach((one, index) => {
      const distance = Math.hypot(
        point.x - toX(one.frequency),
        point.y - toY(one.gainDb),
      );
      if (distance <= bestDistance) {
        best = index;
        bestDistance = distance;
      }
    });
    if (best < 0) {
      return;
    }
    onSelect(best);
    dragging.current = best;
    event.currentTarget.setPointerCapture(event.pointerId);
    event.preventDefault();
  };

  const onMove = (event: PointerEvent<HTMLCanvasElement>) => {
    const index = dragging.current;
    const point = index === null ? undefined : localPoint(event);
    if (index === null || !point) {
      return;
    }
    onChange(index, {
      frequency: Math.round(toHz(point.x)),
      gainDb: Number(toDb(point.y).toFixed(1)),
    });
  };

  const endDrag = () => {
    if (dragging.current === null) {
      return;
    }
    dragging.current = null;
    onCommit();
  };

  return (
    <canvas
      ref={canvasRef}
      className="dsp-eq-graph"
      onPointerDown={onDown}
      onPointerMove={onMove}
      onPointerUp={endDrag}
      onPointerCancel={endDrag}
    />
  );
};

export default DspEqGraph;
