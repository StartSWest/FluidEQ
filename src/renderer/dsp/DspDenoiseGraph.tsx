/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { useEffect, useRef } from 'react';
import { readTextInk } from '../utils/theme';
import {
  IDenoiseClickSettings,
  IDenoiseHissSettings,
  IDenoiseHumSettings,
  TDenoiseProfileSource,
} from '../../common/dsp/chain';
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
import { IGraphLoopFrame, startGraphLoop } from './graphLoop';

/**
 * The spectrum leaving the stage, with everything acting on it drawn on top.
 *
 * The one picture this stage cannot be judged without. Every dial here is a
 * decision about what counts as noise, and a number in decibels does not say
 * whether that decision is being made in the right PLACE — a floor sitting up
 * among the music and a floor sitting under it produce the same "Reducing"
 * reading and completely different sound.
 *
 * Three modules act and each needs a different kind of picture:
 *
 *  - HISS is a level against frequency, so it is two curves on the same axes
 *    as the spectrum: the measured floor and the residual floor after the
 *    real gain the processor applied. Moving a control moves the second line,
 *    while the first remains the measurement it was made against.
 *  - HUM is a comb at known frequencies, so it is drawn as the comb: one mark
 *    per partial that will actually be notched, at the depth it will actually
 *    be cut. The whole question about a notch is whether it sits where the
 *    buzz is, and that is a question about frequency.
 *  - CLICKS are events in TIME, and a spectrum cannot show an event at all.
 *    They get their own lane along the top: the repair rate over the last few
 *    seconds. That lane is the only way to see the failure this module is
 *    prone to — steady activity through a passage means it is repairing the
 *    music, occasional ticks mean it is repairing damage.
 */

const MIN_HZ = 20;
const MAX_HZ = 20_000;

const PAD_L = 8;
const PAD_R = 8;
const PAD_B = 18;

/**
 * The click lane's height, and the spectrum's top padding below it.
 *
 * Eighteen pixels so a bar has a readable height rather than merely being
 * present or absent. The graph itself grew to make room instead of taking it
 * out of the spectrum: a floor and a programme curve that cannot be told apart
 * is the one thing this picture exists to prevent.
 */
const LANE_H = 18;
const LANE_GAP = 6;
const PAD_T = LANE_H + LANE_GAP + 8;

/**
 * Deeper than the EQ and Exciter pages, and it has to be.
 *
 * Those stop at -96 because they are drawn to show programme. This one is
 * drawn to show a NOISE FLOOR, and a floor worth removing lives below where
 * they stop: hiss at -60 dBFS broadband lands near -97 per bin once the
 * transform has spread it, so at -96 the line sat one decibel outside the plot
 * and was clipped flat to the bottom edge — reported, correctly, as the yellow
 * line not being there at all.
 */
const SPECTRUM_FLOOR_DB = -132;
const SPECTRUM_TOP_DB = 0;

/**
 * Hann's mean w², which the meter's normalisation carries into every bin.
 *
 * `feq_meters_read_spectrum` publishes 20·log10(|X[k]| / N) over a Hann
 * window, so turning the profile's density into that same number needs the
 * window's energy as well as the transform size. Guessing the bin width
 * instead — the obvious move, and the one this had — is 7.3 dB out at 48 kHz.
 */
const HANN_MEAN_SQUARE = 0.375;

/**
 * The click lane's span and resolution.
 *
 * Eight seconds is long enough to tell a burst from a pattern and short enough
 * that what is on screen is what is happening now. Sixty-six milliseconds a
 * bucket puts individual ticks in separate bars at any rate a listener would
 * call occasional.
 */
const CLICK_SECONDS = 8;
const CLICK_BUCKETS = 120;
const CLICK_BUCKET_MS = (CLICK_SECONDS * 1000) / CLICK_BUCKETS;

/**
 * How many repairs in one bucket count as a full-height bar, at minimum.
 *
 * The lane scales up beyond this so a heavy burst stays on screen, but never
 * DOWN: a lane renormalised to its own maximum would draw one lonely repair
 * exactly as tall as a hundred of them, and the difference between those two
 * is the entire diagnosis.
 */
const CLICK_FULL_SCALE = 8;

/** Hum partials below this excess are not notched. See `denoise_hum.cpp`. */
const HUM_PARTIAL_MIN_DB = 6;

/** Nothing above this is mains hum. Also from `denoise_hum.cpp`. */
const HUM_HIGHEST_PARTIAL_HZ = 2000;

const GRID_HZ: [number, string][] = [
  [50, '50'],
  [200, '200'],
  [1_000, '1k'],
  [5_000, '5k'],
  [15_000, '15k'],
];

const GRID_DB = [-30, -60, -90, -120];

const SPECTRUM_INK = '255, 255, 255';
/** Warm, matching the amber this app already uses for "pay attention". */
const FLOOR_INK = '255, 176, 89';
/** Violet is reserved here for the floor after the actual hiss gain. */
const HISS_ACTION_INK = '197, 138, 249';
const HUM_INK = '84, 200, 255';
/** Green, because this lane reports activity rather than a level. */
const CLICK_INK = '150, 222, 143';

interface IDspDenoiseGraphProps {
  profile: INoiseProfile | undefined;
  profileSource: TDenoiseProfileSource;
  hiss: IDenoiseHissSettings;
  hum: IDenoiseHumSettings;
  click: IDenoiseClickSettings;
  isEnabled: boolean;
}

const DspDenoiseGraph = ({
  profile,
  profileSource,
  hiss,
  hum,
  click,
  isEnabled,
}: IDspDenoiseGraphProps) => {
  const { t } = useTranslation();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const binsRef = useRef<Float32Array>(new Float32Array(0));
  /** The running loop's way in, for a render that has to reach the canvas. */
  const redraw = useRef<(() => void) | undefined>(undefined);
  const stateRef = useRef({
    profile,
    profileSource,
    hiss,
    hum,
    click,
    isEnabled,
  });
  stateRef.current = {
    profile,
    profileSource,
    hiss,
    hum,
    click,
    isEnabled,
  };

  /**
   * The click lane's history, kept out of React entirely.
   *
   * It advances on wall-clock time rather than per painted frame, so a
   * throttled or stalled animation callback leaves a real gap in the lane
   * instead of compressing eight seconds of history into whatever painted.
   */
  const clicksRef = useRef({
    buckets: new Float32Array(CLICK_BUCKETS),
    at: 0,
    bucketStart: 0,
    lastCount: 0,
  });

  useEffect(() => {
    const canvas = canvasRef.current;
    const context = canvas?.getContext('2d');
    if (!canvas || !context) {
      return undefined;
    }
    const paint = ({ schedule }: IGraphLoopFrame) => {
      const textInk = readTextInk();
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

      const {
        profile: measured,
        profileSource: floorSource,
        hiss: hissSettings,
        hum: humSettings,
        click: clickSettings,
        isEnabled: live,
      } = stateRef.current;
      const meter = readDspDenoiseMeter();
      const nyquist = readDspSampleRate() / 2;

      /* -------------------------------------------------- the click lane */
      const clicks = clicksRef.current;
      const now = performance.now();
      if (clicks.bucketStart === 0) {
        clicks.bucketStart = now;
      }
      // Advanced by elapsed time, and capped so a window that was hidden for a
      // minute clears the lane instead of spinning through thousands of steps.
      let advanced = 0;
      while (now - clicks.bucketStart >= CLICK_BUCKET_MS) {
        clicks.at = (clicks.at + 1) % CLICK_BUCKETS;
        clicks.buckets[clicks.at] = 0;
        clicks.bucketStart += CLICK_BUCKET_MS;
        advanced += 1;
        if (advanced >= CLICK_BUCKETS) {
          clicks.bucketStart = now;
          break;
        }
      }
      // The engine's counter only rises; a fall means a new stream, and the
      // difference across that is not a number of repairs.
      const repaired = Math.max(0, meter.clicksRepaired - clicks.lastCount);
      clicks.lastCount = meter.clicksRepaired;
      const laneLive = live && clickSettings.enabled;
      if (laneLive) {
        clicks.buckets[clicks.at] += repaired;
      }

      let laneScale = CLICK_FULL_SCALE;
      let laneTotal = 0;
      for (let i = 0; i < CLICK_BUCKETS; i += 1) {
        laneScale = Math.max(laneScale, clicks.buckets[i]);
        laneTotal += clicks.buckets[i];
      }

      const laneY = 4;
      context.fillStyle = `rgba(${SPECTRUM_INK}, 0.03)`;
      context.fillRect(PAD_L, laneY, plotW, LANE_H);
      if (laneLive) {
        const barW = Math.max(1, plotW / CLICK_BUCKETS - 1);
        context.fillStyle = `rgba(${CLICK_INK}, 0.8)`;
        for (let i = 0; i < CLICK_BUCKETS; i += 1) {
          // Oldest at the left, so the lane reads the way time does.
          const bucket = clicks.buckets[(clicks.at + 1 + i) % CLICK_BUCKETS];
          if (bucket > 0) {
            const barH = Math.max(2, (bucket / laneScale) * LANE_H);
            const x = PAD_L + (i / CLICK_BUCKETS) * plotW;
            context.fillRect(x, laneY + LANE_H - barH, barW, barH);
          }
        }
      }
      context.font = '9px system-ui, sans-serif';
      context.textAlign = 'left';
      context.fillStyle = textInk;
      context.fillText(
        laneLive
          ? t('dsp.denoise.graphClicksIn', {
              count: Math.round(laneTotal),
              seconds: CLICK_SECONDS,
            })
          : t('dsp.denoise.graphClicksOff'),
        PAD_L + 4,
        laneY + LANE_H - 5,
      );

      /* ------------------------------------------------------------ grid */
      context.strokeStyle = 'rgba(255, 255, 255, 0.06)';
      context.lineWidth = 1;
      context.fillStyle = textInk;
      context.textAlign = 'center';
      GRID_HZ.forEach(([hz, label]) => {
        const x = Math.round(toX(hz)) + 0.5;
        context.beginPath();
        context.moveTo(x, PAD_T);
        context.lineTo(x, floorY);
        context.stroke();
        context.fillText(label, x, height - 5);
      });

      // Level lines, which this page needs and the others do not: the range
      // runs to -132 so a noise floor is inside it, and an unlabelled plot
      // that deep gives no sense of whether a floor at the bottom is quiet or
      // merely clipped.
      context.textAlign = 'right';
      GRID_DB.forEach((db) => {
        const y = Math.round(toY(db)) + 0.5;
        context.beginPath();
        context.moveTo(PAD_L, y);
        context.lineTo(PAD_L + plotW, y);
        context.stroke();
        context.fillText(`${db}`, PAD_L + plotW - 2, y - 2);
      });
      context.textAlign = 'center';

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
      /*
       * Scanned is the saved measurement and therefore never moves while the
       * song plays. Only an explicit completed rescan replaces it. Adaptive
       * reads the engine's live floor, because there the moving estimate is
       * the feature and a tracker whose only evidence is whether the sound got
       * better is one nobody can tune. When the engine is idle, the last saved
       * measurement remains visible.
       */
      let bands = measured?.bandsDb;
      if (floorSource === 'adaptive' && live && meter.floorBandsDb.length > 0) {
        bands = meter.floorBandsDb;
      }
      if (bands && bands.length > 0) {
        /*
         * The profile is a power DENSITY; the spectrum above is
         * 20·log10(|X[k]| / N) over a Hann window. Converting between them
         * needs the window's energy and the transform size, not the bin width:
         *
         *   E[|X|²] = density · (fs/2) · meanW² · N
         *   published = 10·log10(E[|X|²] / N²)
         *             = density_dB + 10·log10((fs/2) · meanW² / N)
         *
         * Reaching for the bin width instead is the obvious move and is 7.3 dB
         * out at 48 kHz — enough to put a real floor outside the plot.
         */
        const binCount = Math.max(1, binsRef.current.length || 1024);
        const transform = binCount * 2;
        const widthDb =
          10 * Math.log10((nyquist * HANN_MEAN_SQUARE) / transform);

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

        /*
         * The floor after the REAL per-bin gain that reached the audio.
         *
         * It is tempting to derive this from Amount and Reduction limit, but
         * Sensitivity and Smoothing are decisions against the current signal;
         * their result does not exist in the settings. The native processor
         * publishes that result, and adding its dB gain to the measured floor
         * shows the residual bed leaving the stage. The bass protection taper
         * is visible here too because it is already part of the applied gain.
         */
        const hissReduction = meter.hissReductionBandsDb;
        if (
          live &&
          hissSettings.enabled &&
          hissReduction.length === bands.length
        ) {
          context.beginPath();
          for (let x = 0; x <= plotW; x += 1) {
            const hz = MIN_HZ * (MAX_HZ / MIN_HZ) ** (x / plotW);
            const db =
              noiseProfileLevelAt(bands, hz) +
              widthDb +
              noiseProfileLevelAt(hissReduction, hz);
            const y = toY(db);
            if (x === 0) {
              context.moveTo(PAD_L, y);
            } else {
              context.lineTo(PAD_L + x, y);
            }
          }
          context.strokeStyle = `rgba(${HISS_ACTION_INK}, 0.95)`;
          context.lineWidth = 1.75;
          context.stroke();
        }
        context.lineWidth = 1;
      }

      /* ---------------------------------------------------- the hum comb */
      /*
       * Drawn outside the floor block, because the two are unrelated. These
       * marks used to be nested inside it, so a track with hum and no scanned
       * floor had a comb the picture never showed.
       *
       * Only the partials that will ACTUALLY be notched, at the depth they
       * will actually be cut — the same rules `denoise_hum.cpp` applies, so
       * the picture cannot promise a notch the engine will not place. That
       * matters most for the depth: each notch is bounded by how far its
       * partial stands above the floor, so the marks come out uneven, and
       * their unevenness is the feature rather than a drawing error.
       */
      const partials = measured?.humPartials ?? [];
      if (humSettings.enabled && partials.length > 0) {
        const wanted = Math.round(humSettings.harmonics);
        context.lineWidth = 2;
        context.strokeStyle = `rgba(${HUM_INK}, ${live ? 0.65 : 0.3})`;
        partials.slice(0, wanted).forEach((partial) => {
          if (
            partial.hz < MIN_HZ ||
            partial.hz > Math.min(MAX_HZ, HUM_HIGHEST_PARTIAL_HZ) ||
            partial.excessDb < HUM_PARTIAL_MIN_DB
          ) {
            return;
          }
          // What the engine will cut: never deeper than the partial stands.
          const depthDb = Math.min(humSettings.depthDb, partial.excessDb);
          const x = Math.round(toX(partial.hz)) + 0.5;
          // Scaled against the dial's own range, so an even comb reads as even
          // and a tapering one reads as tapering.
          const barH =
            (depthDb / Math.max(1, humSettings.depthDb)) * plotH * 0.45;
          context.beginPath();
          context.moveTo(x, floorY);
          context.lineTo(x, floorY - barH);
          context.stroke();
          // A cap, so a shallow mark still reads as a mark rather than as
          // noise along the bottom edge.
          context.beginPath();
          context.moveTo(x - 2.5, floorY - barH);
          context.lineTo(x + 2.5, floorY - barH);
          context.stroke();
        });
        context.lineWidth = 1;

        if (measured && measured.humHz > 0) {
          context.textAlign = 'left';
          context.font = '9px system-ui, sans-serif';
          context.fillStyle = `rgb(${HUM_INK})`;
          context.fillText(
            t('dsp.denoise.graphHumAt', { hz: measured.humHz.toFixed(1) }),
            Math.min(toX(measured.humHz) + 5, PAD_L + plotW - 62),
            PAD_T + 10,
          );
        }
      }

      /* ------------------------------------------------ what it is doing */
      context.textAlign = 'left';
      context.font = '10px system-ui, sans-serif';
      context.fillStyle = textInk;
      context.fillText(
        live
          ? `${meter.reductionDb.toFixed(1)} dB`
          : t('dsp.denoise.graphIdle'),
        PAD_L + 2,
        PAD_T - 3,
      );
    };

    const loop = startGraphLoop(paint);
    redraw.current = loop.schedule;
    return () => {
      redraw.current = undefined;
      loop.stop();
    };
  }, [t]);

  // Repaint when anything drawn changes. The loop only turns while the engine
  // is publishing, so a dial moved against a silent chain reaches the canvas
  // through here and nowhere else.
  useEffect(() => {
    redraw.current?.();
  });

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
        <span className="dsp-denoise-legend-key is-hiss-action">
          {t('dsp.denoise.graphHissAction')}
        </span>
        <span className="dsp-denoise-legend-key is-hum">
          {t('dsp.denoise.graphHum')}
        </span>
        <span className="dsp-denoise-legend-key is-clicks">
          {t('dsp.denoise.graphClicks')}
        </span>
      </div>
    </div>
  );
};

export default DspDenoiseGraph;
