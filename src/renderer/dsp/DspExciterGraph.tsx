/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { PointerEvent as ReactPointerEvent, useEffect, useRef } from 'react';
import {
  EXCITER_BAND_LIMITS,
  EXCITER_MIN_OCTAVES,
  EXCITER_OCTAVE_SPAN,
  IExciterBandSettings,
  IExciterSettings,
  constrainExciterBandPosition,
  exciterBandEdgesForIndex,
  organicBandEdges,
} from '../../common/dsp/chain';
import { useTranslation } from '../utils/I18nContext';
import {
  readDspAnalyser,
  readDspExciterBands,
  readDspExciterOrganic,
  readDspSampleRate,
} from './store';

/**
 * Where each band works and what it is doing, over the spectrum it is doing it
 * to.
 *
 * The same picture the EQ page draws, answering this page's question instead.
 * Bars alone said how hard each band was working and never said WHERE — and
 * "where" is most of what a multiband stage is about, because every centre and
 * range is movable and a narrow band can otherwise look like a switched-off
 * band.
 *
 * Deliberately NOT the EQ's graph with different data in it. An equaliser
 * draws a transfer curve, because a filter has one and it is the whole truth
 * about the filter. This stage has no transfer curve: what it does depends on
 * the level going in, the harmonics coming out are at frequencies the input
 * does not occupy. So it draws REGIONS with live fills — an honest picture of
 * a stage whose behaviour is not a line.
 */

const MIN_HZ = 20;
const MAX_HZ = 20_000;

const PAD_L = 8;
const PAD_R = 8;
const PAD_T = 16;
const PAD_B = 18;

/** The spectrum's range, matching the EQ page so the two read alike. */
const SPECTRUM_FLOOR_DB = -96;
const SPECTRUM_TOP_DB = 0;

const GRID_HZ: [number, string][] = [
  [50, '50'],
  [200, '200'],
  [1_000, '1k'],
  [5_000, '5k'],
  [15_000, '15k'],
];

/** Fills ease towards their reading: quick to arrive, slow to leave. */
const RISE = 0.3;
const FALL = 0.1;

/** The band colours, low to high, and the organic stage's own. */
const BAND_INK = ['84, 200, 255', '64, 214, 200', '150, 226, 128'];
const ORGANIC_INK = '255, 176, 89';

/** Forgiving enough to grab a one-pixel edge without hiding the region body. */
const EDGE_HIT_PX = 7;
const EDGE_HANDLE_HEIGHT = 28;

type TGraphPart = 'move' | 'low' | 'high';

interface IGraphHit {
  bandIndex: number;
  part: TGraphPart;
  distance: number;
  span: number;
}

interface IGraphDrag {
  bandIndex: number;
  part: TGraphPart;
  pointerStartHz: number;
  original: IExciterBandSettings;
  lowHz: number;
  highHz: number;
  changed: boolean;
}

const clamp = (value: number, minimum: number, maximum: number): number =>
  Math.max(minimum, Math.min(maximum, value));

const frequencyToX = (hz: number, width: number): number => {
  const plotW = Math.max(1, width - PAD_L - PAD_R);
  return (
    PAD_L +
    (Math.log10(clamp(hz, MIN_HZ, MAX_HZ) / MIN_HZ) /
      Math.log10(MAX_HZ / MIN_HZ)) *
      plotW
  );
};

const xToFrequency = (x: number, width: number): number => {
  const plotW = Math.max(1, width - PAD_L - PAD_R);
  const position = clamp((x - PAD_L) / plotW, 0, 1);
  return MIN_HZ * (MAX_HZ / MIN_HZ) ** position;
};

const bandFromEdges = (
  bandIndex: number,
  band: IExciterBandSettings,
  lowHz: number,
  highHz: number,
): IExciterBandSettings => {
  const position = constrainExciterBandPosition(
    bandIndex,
    Math.sqrt(lowHz * highHz),
    (Math.log2(highHz / lowHz) - EXCITER_MIN_OCTAVES) / EXCITER_OCTAVE_SPAN,
  );
  return { ...band, ...position };
};

interface IDspExciterGraphProps {
  settings: IExciterSettings;
  onChange: (next: IExciterSettings) => void;
  onCommit: () => void;
}

const DspExciterGraph = ({
  settings,
  onChange,
  onCommit,
}: IDspExciterGraphProps) => {
  const { t } = useTranslation();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const binsRef = useRef<Float32Array>(new Float32Array(0));
  /** Eased amounts: three bands then the organic stage. */
  const drawn = useRef([0, 0, 0, 0]);
  const settingsRef = useRef(settings);
  settingsRef.current = settings;
  const selectedBandRef = useRef<number | undefined>(undefined);
  const hoverRef = useRef<IGraphHit | undefined>(undefined);
  const dragRef = useRef<IGraphDrag | undefined>(undefined);

  const hitAt = (
    x: number,
    y: number,
    width: number,
    height: number,
  ): IGraphHit | undefined => {
    const { current } = settingsRef;
    if (!current.enabled || y < PAD_T || y > height - PAD_B) {
      return undefined;
    }

    const hits: IGraphHit[] = [];
    current.bands.forEach((band, bandIndex) => {
      if (!band.enabled) {
        return;
      }
      const { lowHz, highHz } = exciterBandEdgesForIndex(
        bandIndex,
        band.freqHz,
        band.range,
      );
      const lowX = frequencyToX(lowHz, width);
      const highX = frequencyToX(highHz, width);
      const span = Math.max(1, highX - lowX);
      const lowDistance = Math.abs(x - lowX);
      const highDistance = Math.abs(x - highX);
      if (lowDistance <= EDGE_HIT_PX) {
        hits.push({
          bandIndex,
          part: 'low',
          distance: lowDistance,
          span,
        });
      }
      if (highDistance <= EDGE_HIT_PX) {
        hits.push({
          bandIndex,
          part: 'high',
          distance: highDistance,
          span,
        });
      }
    });

    if (hits.length > 0) {
      hits.sort((first, second) => {
        if (first.distance !== second.distance) {
          return first.distance - second.distance;
        }
        const firstSelected = first.bandIndex === selectedBandRef.current;
        const secondSelected = second.bandIndex === selectedBandRef.current;
        if (firstSelected !== secondSelected) {
          return firstSelected ? -1 : 1;
        }
        return first.span - second.span;
      });
      return hits[0];
    }

    current.bands.forEach((band, bandIndex) => {
      if (!band.enabled) {
        return;
      }
      const { lowHz, highHz } = exciterBandEdgesForIndex(
        bandIndex,
        band.freqHz,
        band.range,
      );
      const lowX = frequencyToX(lowHz, width);
      const highX = frequencyToX(highHz, width);
      if (x >= lowX && x <= highX) {
        hits.push({
          bandIndex,
          part: 'move',
          distance: Math.abs(x - (lowX + highX) * 0.5),
          span: Math.max(1, highX - lowX),
        });
      }
    });
    hits.sort((first, second) => {
      // The narrower region is the intentional target when bands overlap; the
      // wider one remains reachable at any part not covered by it.
      return first.span - second.span || first.distance - second.distance;
    });
    return hits[0];
  };

  const cursorFor = (hit: IGraphHit | undefined): string => {
    if (!hit) {
      return 'default';
    }
    return hit.part === 'move' ? 'grab' : 'ew-resize';
  };

  const pointerPosition = (
    event: ReactPointerEvent<HTMLCanvasElement>,
  ): { x: number; y: number } => {
    const bounds = event.currentTarget.getBoundingClientRect();
    return {
      x: event.clientX - bounds.left,
      y: event.clientY - bounds.top,
    };
  };

  const handlePointerDown = (
    event: ReactPointerEvent<HTMLCanvasElement>,
  ): void => {
    const canvas = event.currentTarget;
    const { x, y } = pointerPosition(event);
    const hit = hitAt(x, y, canvas.clientWidth, canvas.clientHeight);
    hoverRef.current = hit;
    selectedBandRef.current = hit?.bandIndex;
    if (!hit) {
      canvas.style.cursor = 'default';
      return;
    }

    const band = settingsRef.current.bands[hit.bandIndex];
    if (!band) {
      return;
    }
    const { lowHz, highHz } = exciterBandEdgesForIndex(
      hit.bandIndex,
      band.freqHz,
      band.range,
    );
    dragRef.current = {
      bandIndex: hit.bandIndex,
      part: hit.part,
      pointerStartHz: xToFrequency(x, canvas.clientWidth),
      original: { ...band },
      lowHz,
      highHz,
      changed: false,
    };
    canvas.setPointerCapture(event.pointerId);
    canvas.style.cursor = hit.part === 'move' ? 'grabbing' : 'ew-resize';
    event.preventDefault();
  };

  const handlePointerMove = (
    event: ReactPointerEvent<HTMLCanvasElement>,
  ): void => {
    const canvas = event.currentTarget;
    const { x, y } = pointerPosition(event);
    const drag = dragRef.current;
    if (!drag) {
      const hit = hitAt(x, y, canvas.clientWidth, canvas.clientHeight);
      hoverRef.current = hit;
      canvas.style.cursor = cursorFor(hit);
      return;
    }

    const pointerHz = xToFrequency(x, canvas.clientWidth);
    let nextBand = drag.original;
    const limits = EXCITER_BAND_LIMITS[drag.bandIndex];
    if (drag.part === 'move') {
      const proposed = drag.original.freqHz * (pointerHz / drag.pointerStartHz);
      nextBand = {
        ...drag.original,
        ...constrainExciterBandPosition(
          drag.bandIndex,
          proposed,
          drag.original.range,
        ),
      };
    } else if (drag.part === 'low') {
      const minimum = Math.max(
        limits.minHz,
        drag.highHz / 2 ** (EXCITER_MIN_OCTAVES + EXCITER_OCTAVE_SPAN),
      );
      const maximum = drag.highHz / 2 ** EXCITER_MIN_OCTAVES;
      nextBand = bandFromEdges(
        drag.bandIndex,
        drag.original,
        clamp(pointerHz, minimum, maximum),
        drag.highHz,
      );
    } else {
      const minimum = drag.lowHz * 2 ** EXCITER_MIN_OCTAVES;
      const maximum = Math.min(
        limits.maxHz,
        drag.lowHz * 2 ** (EXCITER_MIN_OCTAVES + EXCITER_OCTAVE_SPAN),
      );
      nextBand = bandFromEdges(
        drag.bandIndex,
        drag.original,
        drag.lowHz,
        clamp(pointerHz, minimum, maximum),
      );
    }

    if (
      nextBand.freqHz === drag.original.freqHz &&
      nextBand.range === drag.original.range
    ) {
      return;
    }
    drag.changed = true;
    const { current } = settingsRef;
    onChange({
      ...current,
      presetId: '',
      bands: current.bands.map((band, index) =>
        index === drag.bandIndex ? nextBand : band,
      ),
    });
    event.preventDefault();
  };

  const finishDrag = (): void => {
    const drag = dragRef.current;
    dragRef.current = undefined;
    if (drag?.changed) {
      onCommit();
    }
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    const context = canvas?.getContext('2d');
    if (!canvas || !context) {
      return undefined;
    }
    let frame = 0;

    const paint = () => {
      const width = canvas.clientWidth;
      const height = canvas.clientHeight;
      if (width === 0 || height === 0) {
        frame = requestAnimationFrame(paint);
        return;
      }
      const ratio = window.devicePixelRatio || 1;
      const backingW = Math.round(width * ratio);
      const backingH = Math.round(height * ratio);
      // Only when it changed: assigning width clears the canvas, so doing it
      // every frame is a free repaint of everything drawn below.
      if (canvas.width !== backingW || canvas.height !== backingH) {
        canvas.width = backingW;
        canvas.height = backingH;
      }
      context.setTransform(ratio, 0, 0, ratio, 0, 0);
      context.clearRect(0, 0, width, height);

      const plotW = Math.max(1, width - PAD_L - PAD_R);
      const plotH = Math.max(1, height - PAD_T - PAD_B);
      const floorY = PAD_T + plotH;
      const toX = (hz: number) =>
        PAD_L +
        (Math.log10(Math.max(MIN_HZ, hz) / MIN_HZ) /
          Math.log10(MAX_HZ / MIN_HZ)) *
          plotW;

      const { current } = settingsRef;

      /* ---------------------------------------------------- the spectrum */
      const live = readDspAnalyser('exciter');
      if (live) {
        if (binsRef.current.length !== live.frequencyBinCount) {
          binsRef.current = new Float32Array(live.frequencyBinCount);
        }
        const bins = binsRef.current;
        live.getFloatFrequencyData(bins);
        const nyquist = readDspSampleRate() / 2;

        context.beginPath();
        context.moveTo(PAD_L, floorY);
        for (let x = 0; x <= plotW; x += 1) {
          const hz = MIN_HZ * (MAX_HZ / MIN_HZ) ** (x / plotW);
          const bin = Math.min(
            bins.length - 1,
            Math.max(0, Math.round((hz / nyquist) * bins.length)),
          );
          const peak = Number.isFinite(bins[bin])
            ? bins[bin]
            : SPECTRUM_FLOOR_DB;
          const level =
            (Math.max(SPECTRUM_FLOOR_DB, peak) - SPECTRUM_FLOOR_DB) /
            (SPECTRUM_TOP_DB - SPECTRUM_FLOOR_DB);
          context.lineTo(PAD_L + x, floorY - level * plotH);
        }
        context.lineTo(PAD_L + plotW, floorY);
        context.closePath();
        context.fillStyle = 'rgba(255, 255, 255, 0.07)';
        context.fill();
      }

      /* ------------------------------------------------------ the bands */
      const activity = readDspExciterBands();
      const organicRaw = readDspExciterOrganic();
      const organicNow = current.organic.enabled
        ? Math.max(0, Math.min(1, organicRaw))
        : 0;
      const targets = [
        activity[0] ?? 0,
        activity[1] ?? 0,
        activity[2] ?? 0,
        organicNow,
      ];
      targets.forEach((target, index) => {
        const now = drawn.current[index];
        drawn.current[index] =
          now + (target - now) * (target > now ? RISE : FALL);
      });

      /**
       * Each band's own span, which may overlap its neighbours'.
       *
       * Drawn as three independent regions rather than as slices of one axis,
       * because that is what they now are. Where two overlap their fills add
       * up, so the overlap is visible as a brighter stripe — which is exactly
       * what is happening to the audio there: that octave gets both bands'
       * harmonics.
       */
      current.bands.forEach((band, index) => {
        const { lowHz, highHz } = exciterBandEdgesForIndex(
          index,
          band.freqHz,
          band.range,
        );
        const x0 = toX(lowHz);
        const x1 = toX(highHz);
        const ink = BAND_INK[index];
        const isOn = current.enabled && band.enabled;

        // The region, always drawn. A band that is switched off still has a
        // span, and seeing that span is how its edges get aimed.
        context.fillStyle = `rgba(${ink}, ${isOn ? 0.07 : 0.025})`;
        context.fillRect(x0, PAD_T, Math.max(1, x1 - x0), plotH);

        // What it is contributing, as a fill rising from the floor. This is
        // the smoothed return reported by the audio thread rather than the raw
        // knob position, so switching or bypassing a band is drawn as the same
        // continuous movement the listener hears.
        const amount = Math.min(1, drawn.current[index]);
        if (isOn && amount > 0.002) {
          const filled = plotH * amount;
          const span = Math.max(1, x1 - x0);
          context.fillStyle = `rgba(${ink}, 0.22)`;
          context.fillRect(x0, floorY - filled, span, filled);
          context.fillStyle = `rgba(${ink}, 0.75)`;
          context.fillRect(x0, floorY - filled, span, 1.5);
        }
      });

      /* ------------------------------------------------- the band edges */
      // Each band's own two edges, in its own colour, so an edge belongs to a
      // band by sight. Six lines rather than two, and only the enabled bands'
      // are drawn solidly — with three spans free to overlap, drawing all six
      // at equal weight was a picket fence nobody could read.
      context.lineWidth = 1;
      current.bands.forEach((band, index) => {
        const isOn = current.enabled && band.enabled;
        const { lowHz, highHz } = exciterBandEdgesForIndex(
          index,
          band.freqHz,
          band.range,
        );
        context.setLineDash(isOn ? [] : [2, 3]);
        context.strokeStyle = `rgba(${BAND_INK[index]}, ${isOn ? 0.55 : 0.2})`;
        [lowHz, highHz].forEach((hz) => {
          const x = Math.round(toX(hz)) + 0.5;
          context.beginPath();
          context.moveTo(x, PAD_T);
          context.lineTo(x, floorY);
          context.stroke();
        });
      });
      context.setLineDash([]);

      /* ---------------------------------------------------- the organic */
      if (current.enabled && current.organic.enabled) {
        /**
         * Its span, which widens with Range while remaining band-limited.
         *
         * Drawn from the same two numbers the audio uses rather than from a
         * separate idea of where it works. It never becomes a broadband
         * non-linearity, because multiplying lows, mids and cymbals together
         * is what made Organic sound grainy.
         */
        const { focusHz, range } = current.organic;
        const { lowHz: from, highHz: to } = organicBandEdges(focusHz, range);
        const x0 = toX(from);
        const x1 = toX(to);
        const amount = Math.min(1, drawn.current[3]);
        const band = Math.max(3, plotH * 0.16 * amount);

        const gradient = context.createLinearGradient(x0, 0, x1, 0);
        gradient.addColorStop(0, `rgba(${ORGANIC_INK}, 0)`);
        gradient.addColorStop(
          0.5,
          `rgba(${ORGANIC_INK}, ${0.16 + amount * 0.3})`,
        );
        gradient.addColorStop(1, `rgba(${ORGANIC_INK}, 0)`);
        context.fillStyle = gradient;
        context.fillRect(x0, PAD_T, x1 - x0, band);

        const x = Math.round(toX(focusHz)) + 0.5;
        context.strokeStyle = `rgba(${ORGANIC_INK}, 0.8)`;
        context.beginPath();
        context.moveTo(x, PAD_T);
        context.lineTo(x, PAD_T + band);
        context.stroke();
      }

      /* ---------------------------------------- hovered / selected overlay */
      // Always painted after every region (and Organic), so overlap cannot
      // bury the one under the pointer. Selection remains visible after a
      // click; hover takes precedence so another overlapping band can still be
      // found and brought forward.
      const activeDrag = dragRef.current;
      const activeHit = activeDrag
        ? {
            bandIndex: activeDrag.bandIndex,
            part: activeDrag.part,
          }
        : hoverRef.current;
      const focusedBand = activeHit?.bandIndex ?? selectedBandRef.current;
      if (focusedBand !== undefined) {
        const band = current.bands[focusedBand];
        if (band && current.enabled && band.enabled) {
          const { lowHz, highHz } = exciterBandEdgesForIndex(
            focusedBand,
            band.freqHz,
            band.range,
          );
          const x0 = toX(lowHz);
          const x1 = toX(highHz);
          const ink = BAND_INK[focusedBand];
          context.fillStyle = `rgba(${ink}, 0.12)`;
          context.fillRect(x0, PAD_T, Math.max(1, x1 - x0), plotH);
          context.lineWidth = 2;
          context.strokeStyle = `rgba(${ink}, 0.95)`;
          context.strokeRect(
            Math.round(x0) + 0.5,
            PAD_T + 0.5,
            Math.max(1, Math.round(x1 - x0)),
            Math.max(1, plotH - 1),
          );

          const handleY = PAD_T + (plotH - EDGE_HANDLE_HEIGHT) * 0.5;
          [
            { x: x0, part: 'low' as const },
            { x: x1, part: 'high' as const },
          ].forEach((edge) => {
            const isHot = activeHit?.part === edge.part;
            const handleWidth = isHot ? 6 : 4;
            context.fillStyle = `rgba(${ink}, ${isHot ? 1 : 0.82})`;
            context.fillRect(
              Math.round(edge.x - handleWidth * 0.5),
              handleY,
              handleWidth,
              EDGE_HANDLE_HEIGHT,
            );
          });
        }
      }

      /* ------------------------------------------------------- the axis */
      context.fillStyle = 'rgba(255, 255, 255, 0.34)';
      context.font =
        '9px system-ui, -apple-system, "Segoe UI", Ubuntu, sans-serif';
      context.textAlign = 'center';
      context.textBaseline = 'top';
      GRID_HZ.forEach(([hz, label]) => {
        context.fillText(label, toX(hz), floorY + 4);
      });

      // Enabled bands name their own edges. Only the enabled ones, because
      // six labels across a narrow plot overlap into a smear and the ones that
      // matter are the bands actually doing something.
      context.textBaseline = 'bottom';
      current.bands.forEach((band, index) => {
        if (!current.enabled || !band.enabled) {
          return;
        }
        context.fillStyle = `rgba(${BAND_INK[index]}, 0.85)`;
        const { lowHz, highHz } = exciterBandEdgesForIndex(
          index,
          band.freqHz,
          band.range,
        );
        [lowHz, highHz].forEach((hz) => {
          context.fillText(
            hz >= 1_000
              ? `${(hz / 1_000).toFixed(1)}k`
              : String(Math.round(hz)),
            toX(hz),
            PAD_T - 2,
          );
        });
      });

      frame = requestAnimationFrame(paint);
    };

    frame = requestAnimationFrame(paint);
    return () => cancelAnimationFrame(frame);
  }, []);

  return (
    <div className="dsp-exciter-display">
      <canvas
        ref={canvasRef}
        className="dsp-exciter-canvas"
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={(event) => {
          finishDrag();
          const { x, y } = pointerPosition(event);
          const hit = hitAt(
            x,
            y,
            event.currentTarget.clientWidth,
            event.currentTarget.clientHeight,
          );
          hoverRef.current = hit;
          event.currentTarget.style.cursor = cursorFor(hit);
        }}
        onPointerCancel={(event) => {
          finishDrag();
          hoverRef.current = undefined;
          event.currentTarget.style.cursor = 'default';
        }}
        onLostPointerCapture={() => finishDrag()}
        onPointerLeave={(event) => {
          if (!dragRef.current) {
            hoverRef.current = undefined;
            event.currentTarget.style.cursor = 'default';
          }
        }}
        // Everything here is a continuously moving restatement of settings the
        // dials below already announce. Naming it would put four numbers that
        // change sixty times a second into the accessibility tree.
        aria-hidden="true"
      />
      <ul className="dsp-exciter-legend">
        <li>{t('dsp.exciter.band.low')}</li>
        <li>{t('dsp.exciter.band.mid')}</li>
        <li>{t('dsp.exciter.band.high')}</li>
        <li>{t('dsp.exciter.organic')}</li>
      </ul>
    </div>
  );
};

export default DspExciterGraph;
