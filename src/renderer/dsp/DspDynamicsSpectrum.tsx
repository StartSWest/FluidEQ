/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { useEffect, useRef } from 'react';
import { readDspDynamicsReport } from './dynamicsTelemetry';
import { createDynamicsMotion } from './dynamicsResponse';
import createDynamicsSpectrum from './dynamicsSpectrum';
import { startGraphLoop } from './graphLoop';
import paintDynamicsGraph from './paintDynamicsGraph';
import {
  readDspAnalyser,
  readDspAnalysisLive,
  readDspSampleRate,
} from './store';
import useCanvasSize from './useCanvasSize';

interface IProps {
  enabled: boolean;
  onReading: (gains: readonly number[] | undefined) => void;
}

export default function DspDynamicsSpectrum({ enabled, onReading }: IProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const redraw = useRef<(() => void) | undefined>(undefined);
  const options = useRef({ enabled, onReading });
  options.current = { enabled, onReading };
  const size = useCanvasSize(canvasRef, () => redraw.current?.());

  useEffect(() => {
    const input = createDynamicsSpectrum();
    const output = createDynamicsSpectrum();
    const motion = createDynamicsMotion();
    let labelledAt = Number.NEGATIVE_INFINITY;
    let wasMeasured = false;
    const paint = () => {
      const canvas = canvasRef.current;
      const context = canvas?.getContext('2d');
      const { width, height } = size.current;
      if (!canvas || !context || width < 1 || height < 1) {
        return;
      }
      const ratio = Math.max(1, window.devicePixelRatio || 1);
      if (
        canvas.width !== Math.round(width * ratio) ||
        canvas.height !== Math.round(height * ratio)
      ) {
        canvas.width = Math.round(width * ratio);
        canvas.height = Math.round(height * ratio);
      }
      context.setTransform(ratio, 0, 0, ratio, 0, 0);
      const now = performance.now();
      const rate = readDspSampleRate();
      const live = readDspAnalysisLive();
      const report = live ? readDspDynamicsReport() : undefined;
      const before = live ? readDspAnalyser('dynamicsIn') : undefined;
      const after = live ? readDspAnalyser('dynamicsOut') : undefined;
      const active = options.current.enabled && report?.active;
      let gains: readonly number[] | undefined;
      if (report) {
        gains = active ? motion.read(report.gainDb, now) : [0, 0, 0];
      }
      if (!active) {
        motion.reset();
      }
      if (!!report !== wasMeasured || !active || now - labelledAt >= 250) {
        options.current.onReading(gains);
        labelledAt = now;
        wasMeasured = !!report;
      }
      // Older engines still show their real output; never invent band motion.
      const fallback = !report && live ? readDspAnalyser('master') : undefined;
      const audibleAfter = after ?? fallback;
      paintDynamicsGraph(
        context,
        width,
        height,
        rate,
        before ? input.read(before, rate, now) : undefined,
        audibleAfter ? output.read(audibleAfter, rate, now) : undefined,
        gains,
      );
    };
    const reset = () => {
      input.reset();
      output.reset();
      motion.reset();
      options.current.onReading(undefined);
      labelledAt = Number.NEGATIVE_INFINITY;
    };
    const loop = startGraphLoop(paint, { onEngineGone: reset });
    redraw.current = loop.schedule;
    return () => {
      redraw.current = undefined;
      loop.stop();
    };
  }, [size]);
  useEffect(() => {
    redraw.current?.();
  }, [enabled]);
  return <canvas ref={canvasRef} aria-hidden="true" />;
}
