/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { useEffect, useRef } from 'react';
import { useTranslation } from '../utils/I18nContext';
import { readTextInk } from '../utils/theme';
import { appliedInk } from './dspInks';
import createDynamicsSpectrum from './dynamicsSpectrum';
import { startGraphLoop } from './graphLoop';
import { readDspAnalyser, readDspSampleRate } from './store';
import useCanvasSize from './useCanvasSize';

/** Actual heard music, split by colour at the stage's 150 Hz and 4 kHz corners. */
export default function DspDynamicsSpectrum() {
  const { t } = useTranslation();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const redraw = useRef<(() => void) | undefined>(undefined);
  const size = useCanvasSize(canvasRef, () => redraw.current?.());

  useEffect(() => {
    const spectrum = createDynamicsSpectrum();
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
      context.clearRect(0, 0, width, height);
      const left = 36;
      const top = 26;
      const bottom = height - 22;
      const right = width - 12;
      const highHz = Math.min(20_000, readDspSampleRate() / 2);
      const x = (hz: number) =>
        left + (Math.log(hz / 20) / Math.log(highHz / 20)) * (right - left);
      const y = (db: number) =>
        bottom - Math.min(1, Math.max(0, (db + 72) / 72)) * (bottom - top);
      // The curve, band panels and legend use these same low/high theme tokens.
      const colors = ['122, 149, 255', appliedInk(), '255, 230, 109'];
      const edges = [20, 150, 4_000, highHz];
      const analyser = readDspAnalyser('master');
      const reading = analyser
        ? spectrum.read(analyser, readDspSampleRate(), performance.now())
        : undefined;
      colors.forEach((ink, band) => {
        const bandLeft = x(Math.min(highHz, edges[band]));
        const bandRight = x(Math.min(highHz, edges[band + 1]));
        context.fillStyle = `rgba(${ink},0.035)`;
        context.fillRect(bandLeft, top, bandRight - bandLeft, bottom - top);
        if (!reading) {
          return;
        }
        context.save();
        context.beginPath();
        context.rect(bandLeft, top, bandRight - bandLeft, bottom - top);
        context.clip();
        context.beginPath();
        context.moveTo(left, bottom);
        reading.axis.forEach((hz, index) => {
          context.lineTo(x(hz), y(reading.levels[index]));
        });
        context.lineTo(right, bottom);
        context.closePath();
        const fill = context.createLinearGradient(0, top, 0, bottom);
        fill.addColorStop(0, `rgba(${ink},0.55)`);
        fill.addColorStop(1, `rgba(${ink},0.04)`);
        context.fillStyle = fill;
        context.fill();
        context.strokeStyle = `rgba(${ink},0.95)`;
        context.lineWidth = 1.5;
        context.stroke();
        context.restore();
      });
      context.font =
        '10px -apple-system, "Segoe UI", Ubuntu, Cantarell, "Noto Sans", "DejaVu Sans", sans-serif';
      context.fillStyle = readTextInk();
      context.textAlign = 'right';
      [-60, -48, -36, -24, -12, 0].forEach((db) => {
        context.fillText(`${db}`, left - 6, y(db) + 3);
        context.strokeStyle = 'rgba(255,255,255,0.06)';
        context.beginPath();
        context.moveTo(left, y(db));
        context.lineTo(right, y(db));
        context.stroke();
      });
      [20, 150, 1_000, 4_000, 20_000]
        .filter((hz) => hz <= highHz)
        .forEach((hz, index, ticks) => {
          context.textAlign = 'center';
          if (index === 0) {
            context.textAlign = 'left';
          } else if (index === ticks.length - 1) {
            context.textAlign = 'right';
          }
          context.fillText(
            hz >= 1000 ? `${hz / 1000}k` : `${hz}`,
            x(hz),
            height - 6,
          );
        });
    };
    const loop = startGraphLoop(paint, {
      onEngineGone: () => spectrum.reset(),
    });
    redraw.current = loop.schedule;
    return () => {
      redraw.current = undefined;
      loop.stop();
    };
  }, [size]);

  return (
    <div className="dsp-dynamics-spectrum">
      <span>{t('dsp.eq.legend.spectrum')} · dBFS / Hz</span>
      <canvas ref={canvasRef} aria-hidden="true" />
    </div>
  );
}
