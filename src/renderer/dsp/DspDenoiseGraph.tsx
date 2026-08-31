/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { useEffect, useRef } from 'react';
import {
  INoiseProfile,
  noiseProfileLevelAt,
} from '../../common/dsp/noiseProfile';
import { useTranslation } from '../utils/I18nContext';
import {
  readDspAnalyser,
  readDspDenoiseMeter,
  readDspSampleRate,
} from './store';

/**
 * The spectrum leaving the stage, with the floor it is working against on top.
 *
 * The one picture this stage cannot be judged without. Every dial here is a
 * decision about what counts as noise, and a number in decibels does not say
 * whether that decision is being made in the right PLACE — a floor sitting up
 * among the music and a floor sitting under it produce the same "Reducing"
 * reading and completely different sound.
 *
 * So the measured floor is drawn against the live spectrum, in the same units
 * and on the same axes. A floor line that hugs the bottom is a stage removing
 * hiss; a floor line that rides up into the programme is a stage removing the
 * programme, and that is visible here in a second and audible only as
 * something being wrong.
 *
 * The hum partials get their own marks, because a comb of notches is placed by
 * frequency and the whole question about it is whether those frequencies are
 * where the buzz actually is.
 */

const MIN_HZ = 20;
const MAX_HZ = 20_000;

const PAD_L = 8;
const PAD_R = 8;
const PAD_T = 14;
const PAD_B = 18;

/** The same range the EQ and Exciter pages use, so all three read alike. */
const SPECTRUM_FLOOR_DB = -96;
const SPECTRUM_TOP_DB = 0;

const GRID_HZ: [number, string][] = [
  [50, '50'],
  [200, '200'],
  [1_000, '1k'],
  [5_000, '5k'],
  [15_000, '15k'],
];

const SPECTRUM_INK = '255, 255, 255';
/** Warm, matching the amber this app already uses for "pay attention". */
const FLOOR_INK = '255, 176, 89';
const HUM_INK = '84, 200, 255';

interface IDspDenoiseGraphProps {
  profile: INoiseProfile | undefined;
  isEnabled: boolean;
}

const DspDenoiseGraph = ({ profile, isEnabled }: IDspDenoiseGraphProps) => {
  const { t } = useTranslation();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const binsRef = useRef<Float32Array>(new Float32Array(0));
  const stateRef = useRef({ profile, isEnabled });
  stateRef.current = { profile, isEnabled };

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
      // every frame repaints everything below for nothing.
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
      const toY = (db: number) =>
        floorY -
        ((Math.max(SPECTRUM_FLOOR_DB, Math.min(SPECTRUM_TOP_DB, db)) -
          SPECTRUM_FLOOR_DB) /
          (SPECTRUM_TOP_DB - SPECTRUM_FLOOR_DB)) *
          plotH;

      /* ------------------------------------------------------------ grid */
      context.strokeStyle = 'rgba(255, 255, 255, 0.06)';
      context.lineWidth = 1;
      context.font = '9px system-ui, sans-serif';
      context.fillStyle = 'rgba(255, 255, 255, 0.28)';
      context.textAlign = 'center';
      GRID_HZ.forEach(([hz, label]) => {
        const x = Math.round(toX(hz)) + 0.5;
        context.beginPath();
        context.moveTo(x, PAD_T);
        context.lineTo(x, floorY);
        context.stroke();
        context.fillText(label, x, height - 5);
      });

      const { profile: measured, isEnabled: live } = stateRef.current;
      const nyquist = readDspSampleRate() / 2;

      /* -------------------------------------------------- the spectrum */
      const analyser = readDspAnalyser('denoise');
      if (analyser && live) {
        if (binsRef.current.length !== analyser.frequencyBinCount) {
          binsRef.current = new Float32Array(analyser.frequencyBinCount);
        }
        const bins = binsRef.current;
        analyser.getFloatFrequencyData(bins);

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
          context.lineTo(PAD_L + x, toY(peak));
        }
        context.lineTo(PAD_L + plotW, floorY);
        context.closePath();
        context.fillStyle = `rgba(${SPECTRUM_INK}, 0.08)`;
        context.fill();
        context.strokeStyle = `rgba(${SPECTRUM_INK}, 0.22)`;
        context.stroke();
      }

      /* ------------------------------------------------- the noise floor */
      const meter = readDspDenoiseMeter();
      /*
       * The floor the engine is subtracting RIGHT NOW, not the one it was
       * handed. They are the same in Scanned and completely different in
       * Adaptive, where the tracker moves every frame — and a mode whose only
       * evidence is whether the sound got better is a mode nobody can tune.
       * Falls back to the stored profile when the engine is not running, so
       * the card still shows what a scan found.
       */
      const bands =
        live && meter.floorBandsDb.length > 0
          ? meter.floorBandsDb
          : measured?.bandsDb;
      if (bands && bands.length > 0) {
        /*
         * The profile is a power DENSITY and the spectrum above is a per-bin
         * level, so the density is multiplied by the analyser's own bin width
         * before it is drawn. Without that the two lines are in different
         * units and the picture invites exactly the wrong conclusion, which is
         * worse than drawing nothing.
         */
        const binWidth = nyquist / Math.max(1, binsRef.current.length || 1024);
        const widthDb = 10 * Math.log10(binWidth);

        context.beginPath();
        for (let x = 0; x <= plotW; x += 1) {
          const hz = MIN_HZ * (MAX_HZ / MIN_HZ) ** (x / plotW);
          const db = noiseProfileLevelAt(bands, hz) + widthDb;
          const y = toY(db);
          if (x === 0) {
            context.moveTo(PAD_L, y);
          } else {
            context.lineTo(PAD_L + x, y);
          }
        }
        context.strokeStyle = `rgba(${FLOOR_INK}, 0.85)`;
        context.lineWidth = 1.5;
        context.stroke();

        // Filled beneath, because what is under the line is what the stage
        // considers removable and that region is the whole claim.
        context.lineTo(PAD_L + plotW, floorY);
        context.lineTo(PAD_L, floorY);
        context.closePath();
        context.fillStyle = `rgba(${FLOOR_INK}, 0.08)`;
        context.fill();
        context.lineWidth = 1;

        /* ----------------------------------------------- hum partials */
        measured?.humPartials.forEach((partial) => {
          if (partial.hz < MIN_HZ || partial.hz > MAX_HZ) {
            return;
          }
          const x = Math.round(toX(partial.hz)) + 0.5;
          context.beginPath();
          context.moveTo(x, PAD_T);
          context.lineTo(x, floorY);
          // Faint unless the partial really stands above the floor: a mark at
          // a harmonic with no buzz in it is a notch that will not be placed,
          // and drawing it at full strength would promise otherwise.
          context.strokeStyle = `rgba(${HUM_INK}, ${
            partial.excessDb >= 6 ? 0.5 : 0.14
          })`;
          context.stroke();
        });
      }

      /* ------------------------------------------------ what it is doing */
      context.textAlign = 'left';
      context.font = '10px system-ui, sans-serif';
      context.fillStyle = `rgba(${SPECTRUM_INK}, 0.45)`;
      context.fillText(
        live
          ? `${meter.reductionDb.toFixed(1)} dB`
          : t('dsp.denoise.graphIdle'),
        PAD_L + 2,
        PAD_T - 3,
      );

      frame = requestAnimationFrame(paint);
    };

    frame = requestAnimationFrame(paint);
    return () => cancelAnimationFrame(frame);
  }, [t]);

  return (
    <div className="dsp-denoise-graph">
      {/* Hidden from assistive technology, as the other graphs are: everything
          it draws is also on the card as text, and a canvas has nothing a
          screen reader can do with it. */}
      <canvas ref={canvasRef} aria-hidden="true" />
      <div className="dsp-denoise-legend">
        <span className="dsp-denoise-legend-key is-spectrum">
          {t('dsp.denoise.graphOutput')}
        </span>
        <span className="dsp-denoise-legend-key is-floor">
          {t('dsp.denoise.graphFloor')}
        </span>
        <span className="dsp-denoise-legend-key is-hum">
          {t('dsp.denoise.graphHum')}
        </span>
      </div>
    </div>
  );
};

export default DspDenoiseGraph;
