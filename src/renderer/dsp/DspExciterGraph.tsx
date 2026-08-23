/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { useEffect, useRef } from 'react';
import { IExciterSettings } from '../../common/dsp/chain';
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
 * "where" is most of what a multiband stage is about, because the crossovers
 * are dials and a band that is set to cover nothing looks identical to a band
 * that is switched off.
 *
 * Deliberately NOT the EQ's graph with different data in it. An equaliser
 * draws a transfer curve, because a filter has one and it is the whole truth
 * about the filter. This stage has no transfer curve: what it does depends on
 * the level going in, the harmonics coming out are at frequencies the input
 * does not occupy, and two of its four amounts move on their own. So it draws
 * REGIONS with live fills — an honest picture of a stage whose behaviour is
 * not a line.
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

interface IDspExciterGraphProps {
  settings: IExciterSettings;
}

const DspExciterGraph = ({ settings }: IDspExciterGraphProps) => {
  const { t } = useTranslation();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const binsRef = useRef<Float32Array>(new Float32Array(0));
  /** Eased amounts: three bands then the organic stage. */
  const drawn = useRef([0, 0, 0, 0]);
  const settingsRef = useRef(settings);
  settingsRef.current = settings;

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
      const [lowHz, highHz] = current.crossoverHz;

      /* ---------------------------------------------------- the spectrum */
      const live = readDspAnalyser();
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
      // The organic reading is an asymmetry, 0.2 to 0.65, which means nothing
      // to anybody. Normalised to its own range so it answers the same
      // question as the other three: how much of what it can do.
      const organicNow = current.organic.enabled
        ? Math.max(0, Math.min(1, (organicRaw - 0.2) / 0.45))
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

      const edges: [number, number][] = [
        [MIN_HZ, lowHz],
        [lowHz, highHz],
        [highHz, MAX_HZ],
      ];
      edges.forEach(([from, to], index) => {
        const x0 = toX(from);
        const x1 = toX(to);
        const band = current.bands[index];
        const ink = BAND_INK[index];
        const isOn = current.enabled && band?.enabled;

        // The region, always drawn. A band that is switched off still has a
        // span, and seeing that span is how the crossover dials are aimed.
        context.fillStyle = `rgba(${ink}, ${isOn ? 0.07 : 0.025})`;
        context.fillRect(x0, PAD_T, x1 - x0, plotH);

        // What it is contributing, as a fill rising from the floor. This is
        // the number reported by the audio thread, not the mix setting: a
        // dynamic band's amount depends on how loud its own passband is right
        // now, and drawing the setting would hold still and say nothing.
        const amount = Math.min(1, drawn.current[index]);
        if (isOn && amount > 0.002) {
          const filled = plotH * amount;
          context.fillStyle = `rgba(${ink}, 0.22)`;
          context.fillRect(x0, floorY - filled, x1 - x0, filled);
          context.fillStyle = `rgba(${ink}, 0.75)`;
          context.fillRect(x0, floorY - filled, x1 - x0, 1.5);
        }
      });

      /* -------------------------------------------- the crossover lines */
      context.setLineDash([3, 3]);
      context.strokeStyle = 'rgba(255, 255, 255, 0.3)';
      context.lineWidth = 1;
      [lowHz, highHz].forEach((hz) => {
        const x = Math.round(toX(hz)) + 0.5;
        context.beginPath();
        context.moveTo(x, PAD_T);
        context.lineTo(x, floorY);
        context.stroke();
      });
      context.setLineDash([]);

      /* ---------------------------------------------------- the organic */
      if (current.enabled && current.organic.enabled) {
        /**
         * Its span, which widens with Range until it is everything.
         *
         * Drawn from the same two numbers the audio uses rather than from a
         * separate idea of where it works: at range 1 the stage genuinely
         * sees the whole signal, so the marker genuinely spans the whole plot
         * and the focus marker disappears because there is no longer a band
         * to centre.
         */
        const { focusHz, range } = current.organic;
        const octaves = 1.2 + range * 9;
        const from = Math.max(MIN_HZ, focusHz / 2 ** (octaves / 2));
        const to = Math.min(MAX_HZ, focusHz * 2 ** (octaves / 2));
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

        if (range < 1) {
          const x = Math.round(toX(focusHz)) + 0.5;
          context.strokeStyle = `rgba(${ORGANIC_INK}, 0.8)`;
          context.beginPath();
          context.moveTo(x, PAD_T);
          context.lineTo(x, PAD_T + band);
          context.stroke();
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

      // The crossovers name themselves, because they are the two dials this
      // picture exists to help aim.
      context.fillStyle = 'rgba(255, 255, 255, 0.55)';
      context.textBaseline = 'bottom';
      [lowHz, highHz].forEach((hz) => {
        context.fillText(
          hz >= 1_000 ? `${(hz / 1_000).toFixed(1)}k` : String(Math.round(hz)),
          toX(hz),
          PAD_T - 2,
        );
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
