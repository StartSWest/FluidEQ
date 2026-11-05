/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { readTextInk } from '../utils/theme';
import { appliedInk } from './dspInks';
import { dynamicsResponseDb } from './dynamicsResponse';

interface ISpectrum {
  axis: readonly number[];
  levels: Float64Array;
}

/** One shared frequency plot: measured input/output plus actual applied gain. */
export default function paintDynamicsGraph(
  context: CanvasRenderingContext2D,
  width: number,
  height: number,
  sampleRate: number,
  input: ISpectrum | undefined,
  output: ISpectrum | undefined,
  gains: readonly number[] | undefined,
) {
  const left = 38;
  const right = width - 38;
  const top = 23;
  const bottom = height - 25;
  const highHz = Math.min(20_000, sampleRate / 2);
  const x = (hz: number) =>
    left + (Math.log(hz / 20) / Math.log(highHz / 20)) * (right - left);
  const y = (db: number) =>
    bottom - Math.max(0, Math.min(1, (db + 90) / 90)) * (bottom - top);
  const gainY = (db: number) =>
    top + ((24 - Math.max(-24, Math.min(24, db))) / 48) * (bottom - top);
  const colors = ['122, 149, 255', appliedInk(), '255, 230, 109'];
  const edges = [20, 150, 4_000, highHz].map((hz) => Math.min(highHz, hz));
  const ink = readTextInk();
  context.clearRect(0, 0, width, height);
  colors.forEach((color, band) => {
    context.fillStyle = `rgba(${color},0.035)`;
    context.fillRect(
      x(edges[band]),
      top,
      x(edges[band + 1]) - x(edges[band]),
      bottom - top,
    );
  });
  context.font =
    '10px -apple-system, "Segoe UI", Ubuntu, Cantarell, "Noto Sans", "DejaVu Sans", sans-serif';
  context.fillStyle = ink;
  context.textAlign = 'right';
  [-90, -72, -54, -36, -18, 0].forEach((db) => {
    context.fillText(`${db}`, left - 7, y(db) + 3);
    context.beginPath();
    context.moveTo(left, y(db));
    context.lineTo(right, y(db));
    context.strokeStyle = 'rgba(255,255,255,0.065)';
    context.lineWidth = 1;
    context.stroke();
  });
  [20, 150, 1_000, 4_000, 20_000]
    .filter((hz) => hz <= highHz)
    .forEach((hz, index, ticks) => {
      context.beginPath();
      context.moveTo(x(hz), top);
      context.lineTo(x(hz), bottom);
      context.strokeStyle =
        hz === 150 || hz === 4_000
          ? 'rgba(255,255,255,0.16)'
          : 'rgba(255,255,255,0.06)';
      context.stroke();
      context.textAlign = index === 0 ? 'left' : 'center';
      if (index === ticks.length - 1) {
        context.textAlign = 'right';
      }
      context.fillText(
        hz >= 1000 ? `${hz / 1000}k` : `${hz}`,
        x(hz),
        height - 7,
      );
    });
  context.textAlign = 'left';
  context.fillText('dBFS', left, 12);
  context.textAlign = 'right';
  context.fillText('Δ dB', right, 12);
  context.textAlign = 'left';
  [24, 12, 0, -12, -24].forEach((db) => {
    context.fillText(db > 0 ? `+${db}` : `${db}`, right + 7, gainY(db) + 3);
  });
  context.save();
  context.beginPath();
  context.rect(left, top, right - left, bottom - top);
  context.clip();
  const spectrumPath = (reading: ISpectrum) => {
    context.beginPath();
    reading.axis.forEach((hz, index) => {
      if (index === 0) {
        context.moveTo(x(hz), y(reading.levels[index]));
      } else {
        context.lineTo(x(hz), y(reading.levels[index]));
      }
    });
  };
  // This gap is measured before Maximizer or Master can obscure Dynamics.
  if (output) {
    colors.forEach((color, band) => {
      context.save();
      context.beginPath();
      context.rect(
        x(edges[band]),
        top,
        x(edges[band + 1]) - x(edges[band]),
        bottom - top,
      );
      context.clip();
      spectrumPath(output);
      context.lineTo(right, bottom);
      context.lineTo(left, bottom);
      context.closePath();
      const fill = context.createLinearGradient(0, top, 0, bottom);
      fill.addColorStop(0, `rgba(${color},0.42)`);
      fill.addColorStop(1, `rgba(${color},0.025)`);
      context.fillStyle = fill;
      context.fill();
      spectrumPath(output);
      context.strokeStyle = `rgba(${color},0.7)`;
      context.lineWidth = 1.3;
      context.stroke();
      context.restore();
    });
  }
  if (input) {
    spectrumPath(input);
    context.setLineDash([3, 3]);
    context.strokeStyle = 'rgba(220,233,245,0.55)';
    context.lineWidth = 1;
    context.stroke();
    context.setLineDash([]);
  }
  context.beginPath();
  context.moveTo(left, gainY(0));
  context.lineTo(right, gainY(0));
  context.setLineDash([5, 5]);
  context.strokeStyle = 'rgba(220,233,245,0.28)';
  context.lineWidth = 1;
  context.stroke();
  context.setLineDash([]);
  if (gains) {
    const points = Array.from({ length: 256 }, (_, index) => {
      const hz = 20 * (highHz / 20) ** (index / 255);
      return [x(hz), gainY(dynamicsResponseDb(hz, sampleRate, gains))];
    });
    colors.forEach((color, band) => {
      context.save();
      context.beginPath();
      context.rect(
        x(edges[band]),
        top,
        x(edges[band + 1]) - x(edges[band]),
        bottom - top,
      );
      context.clip();
      context.beginPath();
      context.moveTo(left, gainY(0));
      points.forEach(([px, py]) => context.lineTo(px, py));
      context.lineTo(right, gainY(0));
      context.closePath();
      context.fillStyle = `rgba(${color},0.12)`;
      context.fill();
      context.beginPath();
      points.forEach(([px, py], index) => {
        if (index === 0) {
          context.moveTo(px, py);
        } else {
          context.lineTo(px, py);
        }
      });
      context.shadowColor = `rgba(${color},0.5)`;
      context.shadowBlur = 7;
      context.strokeStyle = `rgb(${color})`;
      context.lineWidth = 2.5;
      context.stroke();
      context.restore();
    });
    [60, 800, Math.min(8_000, highHz)].forEach((hz, band) => {
      const py = gainY(dynamicsResponseDb(hz, sampleRate, gains));
      context.beginPath();
      context.arc(x(hz), py, 3.5, 0, Math.PI * 2);
      context.fillStyle = `rgb(${colors[band]})`;
      context.fill();
    });
  }
  context.restore();
}
