/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { PointerEvent as ReactPointerEvent, useEffect, useRef } from 'react';
import { readTextInk } from '../utils/theme';
import {
  EXCITER_BAND_LIMITS,
  EXCITER_MIN_OCTAVES,
  EXCITER_OCTAVE_SPAN,
  IExciterBandSettings,
  IExciterSettings,
  constrainExciterBandPosition,
  exciterBandEdgesForIndex,
} from '../../common/dsp/chain';
import { useTranslation } from '../utils/I18nContext';
import {
  readDspAnalyser,
  readDspExciterBands,
  readDspExciterOrganic,
  readDspSampleRate,
} from './store';
import { IGraphLoopFrame, startGraphLoop } from './graphLoop';
import {
  EXCITER_LEGEND,
  EXCITER_PLOT_INSET,
  IExciterPlotFrame,
  TExciterBandPart,
  exciterFrequencyToX,
  exciterXToFrequency,
  paintExciterPlot,
} from './exciterPlot';

/**
 * The Exciter's graph as a control: a band is dragged by its span to move it
 * and by an edge to widen or narrow it, against a picture that follows the
 * music. What is drawn, and why it is drawn that way, is `exciterPlot.ts`.
 */

/** Fills ease towards their reading: quick to arrive, slow to leave. */
const RISE = 0.3;
const FALL = 0.1;

/** Forgiving enough to grab a one-pixel edge without hiding the region body. */
const EDGE_HIT_PX = 7;

interface IGraphHit {
  bandIndex: number;
  part: TExciterBandPart;
  distance: number;
  span: number;
}

interface IGraphDrag {
  bandIndex: number;
  part: TExciterBandPart;
  pointerStartHz: number;
  original: IExciterBandSettings;
  lowHz: number;
  highHz: number;
  changed: boolean;
}

const clamp = (value: number, minimum: number, maximum: number): number =>
  Math.max(minimum, Math.min(maximum, value));

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
  /** The running loop's way in, for a render that has to reach the canvas. */
  const redraw = useRef<(() => void) | undefined>(undefined);
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
    if (
      !current.enabled ||
      y < EXCITER_PLOT_INSET.top ||
      y > height - EXCITER_PLOT_INSET.bottom
    ) {
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
      const lowX = exciterFrequencyToX(lowHz, width);
      const highX = exciterFrequencyToX(highHz, width);
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
      const lowX = exciterFrequencyToX(lowHz, width);
      const highX = exciterFrequencyToX(highHz, width);
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
      pointerStartHz: exciterXToFrequency(x, canvas.clientWidth),
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

    const pointerHz = exciterXToFrequency(x, canvas.clientWidth);
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

    /** The live spectrum, into a buffer kept across frames. */
    const readSpectrum = (): IExciterPlotFrame['spectrum'] => {
      const live = readDspAnalyser('exciter');
      if (!live) {
        return undefined;
      }
      if (binsRef.current.length !== live.frequencyBinCount) {
        binsRef.current = new Float32Array(live.frequencyBinCount);
      }
      live.getFloatFrequencyData(binsRef.current);
      return { bins: binsRef.current, nyquist: readDspSampleRate() / 2 };
    };

    const paint = ({ schedule }: IGraphLoopFrame) => {
      const width = canvas.clientWidth;
      const height = canvas.clientHeight;
      if (width === 0 || height === 0) {
        // Not laid out yet. Asked for again unconditionally, because this is
        // waiting on the document rather than on the engine.
        schedule();
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

      const { current } = settingsRef;
      const activity = readDspExciterBands();
      const organicNow = current.organic.enabled
        ? Math.max(0, Math.min(1, readDspExciterOrganic()))
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

      // Selection remains visible after a click; hover takes precedence, so
      // another overlapping band can still be found and brought forward.
      const activeDrag = dragRef.current;
      const activeHit = activeDrag
        ? { bandIndex: activeDrag.bandIndex, part: activeDrag.part }
        : hoverRef.current;
      paintExciterPlot(context, width, height, {
        settings: current,
        amounts: drawn.current,
        spectrum: readSpectrum(),
        focusedBand: activeHit?.bandIndex ?? selectedBandRef.current,
        hotPart: activeHit?.part,
        textInk: readTextInk(),
      });
    };

    const loop = startGraphLoop(paint);
    redraw.current = loop.schedule;
    return () => {
      redraw.current = undefined;
      loop.stop();
    };
  }, []);

  // Repaint when anything drawn changes. The loop itself only turns while the
  // engine is publishing, so a band dragged against a silent chain reaches the
  // canvas through here and nowhere else.
  useEffect(() => {
    redraw.current?.();
  });

  return (
    <div
      className={`dsp-eq-plot dsp-exciter-display${
        settings.enabled ? '' : ' is-off'
      }`}
    >
      <canvas
        ref={canvasRef}
        className="dsp-eq-graph dsp-exciter-canvas"
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
      <ul className="dsp-eq-legend">
        {EXCITER_LEGEND.map(({ key, color }) => (
          <li className="dsp-eq-legend-item" key={key}>
            <span
              className="dsp-eq-legend-mark is-filled"
              style={{ color }}
              aria-hidden="true"
            />
            {t(key)}
          </li>
        ))}
      </ul>
    </div>
  );
};

export default DspExciterGraph;
