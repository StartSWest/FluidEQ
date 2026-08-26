/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { useEffect, useRef, useState } from 'react';
import { IMasterSettings } from '../../common/dsp/chain';
import { useTranslation } from '../utils/I18nContext';
import {
  IDspOutputSafetyMeter,
  readDspAnalyser,
  readDspPeak,
  readDspSampleRate,
} from './store';

const MIN_HZ = 20;
const MAX_HZ = 20_000;
const PAD_L = 46;
const PAD_R = 42;
const PAD_T = 34;
const PAD_B = 26;
const GAIN_RANGE_DB = 18;
const SPECTRUM_FLOOR_DB = -96;
const SPECTRUM_TOP_DB = 0;
/** Below this, the slow DC estimate is beneath a useful reporting floor. */
const DC_REPORT_THRESHOLD_DB = -60;
const GRID_DB = [-12, -6, 0, 6, 12];
const GRID_DBFS = [-96, -72, -48, -24, 0];
const GRID_HZ: [number, string][] = [
  [30, '30'],
  [100, '100'],
  [300, '300'],
  [1_000, '1k'],
  [3_000, '3k'],
  [10_000, '10k'],
];
const PEAK_EVENT_HOLD_MS = 900;
const APPLIED_LINE_SMOOTHING_MS = 160;

interface IPeakEvent {
  kind: 'fixed' | 'warning';
  amount: number;
}

const amplitudeDb = (value: number): number =>
  value > 1e-6 ? 20 * Math.log10(value) : -120;

const displayDbfs = (value: number): string =>
  value <= -119.5 ? '≤−120 dBFS' : `${value.toFixed(1)} dBFS`;

interface IDspMasterGraphProps {
  master: IMasterSettings;
  meter: IDspOutputSafetyMeter;
  safetyEnabled: boolean;
  loudnessGainDb: number;
}

/** The EQ-style frequency view of Master’s flat gain and live safeguards. */
const DspMasterGraph = ({
  master,
  meter,
  safetyEnabled,
  loudnessGainDb,
}: IDspMasterGraphProps) => {
  const { t } = useTranslation();
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const binsRef = useRef(new Float32Array(0));
  const peakEventTimerRef = useRef<number | undefined>(undefined);
  const appliedGainTargetRef = useRef(0);
  const appliedGainDisplayRef = useRef(0);
  const appliedGainPaintAtRef = useRef(0);
  const [heldPeakEvent, setHeldPeakEvent] = useState<IPeakEvent | undefined>();
  const autoHeadroomActive =
    master.enabled && (master.autoHeadroom || master.loudnessMaximize);
  const effectiveCeiling = autoHeadroomActive ? master.ceilingDb : 0;
  const trimDb = master.enabled ? master.outputTrimDb + loudnessGainDb : 0;
  const autoGainReductionDb = meter.postFilterNormalizer.gainReductionDb;
  const safetyGainReductionDb = safetyEnabled ? meter.gainReductionDb : 0;
  const protectedReductionDb = autoGainReductionDb + safetyGainReductionDb;
  const appliedGainDb = trimDb + protectedReductionDb;
  const outputPeakDb = amplitudeDb(readDspPeak());
  const projectedHeadroomInputDb =
    meter.postFilterNormalizer.inputTruePeakDb <= -119.5
      ? -120
      : meter.postFilterNormalizer.inputTruePeakDb + trimDb;
  const observedPeakDb = Math.max(
    outputPeakDb,
    autoHeadroomActive ? projectedHeadroomInputDb : -120,
    safetyEnabled ? meter.inputTruePeakDb : -120,
  );
  const overCeiling = observedPeakDb > effectiveCeiling + 0.05;
  const autoReducing = autoGainReductionDb < -0.05;
  const safetyReducing = safetyGainReductionDb < -0.05;
  const reducing = autoReducing || safetyReducing;
  const dcFixed = meter.dcCorrectionDb > DC_REPORT_THRESHOLD_DB;
  const faults = meter.repairedSamples;
  let currentPeakEvent: IPeakEvent | undefined;
  if (autoReducing) {
    currentPeakEvent = {
      kind: 'fixed',
      amount: Math.abs(autoGainReductionDb),
    };
  } else if (overCeiling && !safetyReducing) {
    currentPeakEvent = { kind: 'warning', amount: observedPeakDb };
  }

  useEffect(() => {
    appliedGainTargetRef.current = appliedGainDb;
  }, [appliedGainDb]);

  useEffect(() => {
    if (!autoReducing && (!overCeiling || safetyReducing)) {
      return;
    }
    const nextPeakEvent: IPeakEvent = autoReducing
      ? { kind: 'fixed', amount: Math.abs(autoGainReductionDb) }
      : { kind: 'warning', amount: observedPeakDb };
    setHeldPeakEvent((previous) => {
      if (!previous || previous.kind !== nextPeakEvent.kind) {
        return nextPeakEvent;
      }
      if (nextPeakEvent.kind === 'warning') {
        return nextPeakEvent.amount > previous.amount
          ? nextPeakEvent
          : previous;
      }
      // Reduction may move in both directions, but half-decibel UI steps keep
      // the chip calm while the line shows the exact continuous movement.
      return Math.abs(nextPeakEvent.amount - previous.amount) >= 0.5
        ? nextPeakEvent
        : previous;
    });
    if (peakEventTimerRef.current !== undefined) {
      window.clearTimeout(peakEventTimerRef.current);
    }
    peakEventTimerRef.current = window.setTimeout(() => {
      setHeldPeakEvent(undefined);
      peakEventTimerRef.current = undefined;
    }, PEAK_EVENT_HOLD_MS);
  }, [
    autoGainReductionDb,
    autoReducing,
    observedPeakDb,
    overCeiling,
    safetyReducing,
  ]);

  useEffect(
    () => () => {
      if (peakEventTimerRef.current !== undefined) {
        window.clearTimeout(peakEventTimerRef.current);
      }
    },
    [],
  );

  const displayedPeakEvent = heldPeakEvent ?? currentPeakEvent;
  let peakStatusClass = 'is-safe';
  let peakStatus = t('dsp.master.graph.peakSafe');
  if (displayedPeakEvent?.kind === 'warning') {
    peakStatusClass = 'is-warning';
    peakStatus = t('dsp.master.graph.peakWarning', {
      peak: displayedPeakEvent.amount.toFixed(1),
    });
  } else if (displayedPeakEvent?.kind === 'fixed') {
    peakStatusClass = 'is-fixed';
    peakStatus = t('dsp.master.graph.peakFixed', {
      gain: displayedPeakEvent.amount.toFixed(1),
    });
  }
  let safetyStatusClass = safetyEnabled ? 'is-safe' : 'is-warning';
  let safetyStatus = safetyEnabled
    ? t('dsp.master.graph.safetyActive')
    : t('dsp.master.graph.safetyBypassed');
  if (safetyReducing) {
    safetyStatusClass = 'is-fixed';
    safetyStatus = `${t('dsp.master.graph.safetyActive')} · ${safetyGainReductionDb.toFixed(1)} dB`;
  }

  useEffect(() => {
    let frame = 0;
    const paint = () => {
      const canvas = canvasRef.current;
      const context = canvas?.getContext('2d');
      if (!canvas || !context) {
        frame = requestAnimationFrame(paint);
        return;
      }
      const width = Math.max(1, canvas.clientWidth);
      const height = Math.max(1, canvas.clientHeight);
      const ratio = Math.max(1, window.devicePixelRatio || 1);
      const pixelWidth = Math.round(width * ratio);
      const pixelHeight = Math.round(height * ratio);
      if (canvas.width !== pixelWidth || canvas.height !== pixelHeight) {
        canvas.width = pixelWidth;
        canvas.height = pixelHeight;
      }
      context.setTransform(ratio, 0, 0, ratio, 0, 0);
      context.clearRect(0, 0, width, height);

      const now = performance.now();
      const elapsed =
        appliedGainPaintAtRef.current > 0
          ? Math.min(100, now - appliedGainPaintAtRef.current)
          : 16.67;
      appliedGainPaintAtRef.current = now;
      const lineSmooth = 1 - Math.exp(-elapsed / APPLIED_LINE_SMOOTHING_MS);
      const appliedTarget = appliedGainTargetRef.current;
      appliedGainDisplayRef.current +=
        (appliedTarget - appliedGainDisplayRef.current) * lineSmooth;
      if (Math.abs(appliedTarget - appliedGainDisplayRef.current) < 0.005) {
        appliedGainDisplayRef.current = appliedTarget;
      }
      const displayedAppliedGainDb = appliedGainDisplayRef.current;

      const plotWidth = Math.max(1, width - PAD_L - PAD_R);
      const plotHeight = Math.max(1, height - PAD_T - PAD_B);
      const frequencyX = (hz: number): number =>
        PAD_L +
        (Math.log10(Math.max(MIN_HZ, Math.min(MAX_HZ, hz)) / MIN_HZ) /
          Math.log10(MAX_HZ / MIN_HZ)) *
          plotWidth;
      const xFrequency = (x: number): number =>
        MIN_HZ * (MAX_HZ / MIN_HZ) ** ((x - PAD_L) / plotWidth);
      const gainY = (db: number): number =>
        PAD_T +
        ((GAIN_RANGE_DB -
          Math.max(-GAIN_RANGE_DB, Math.min(GAIN_RANGE_DB, db))) /
          (GAIN_RANGE_DB * 2)) *
          plotHeight;
      const levelY = (db: number): number =>
        PAD_T +
        plotHeight -
        ((Math.max(SPECTRUM_FLOOR_DB, Math.min(SPECTRUM_TOP_DB, db)) -
          SPECTRUM_FLOOR_DB) /
          (SPECTRUM_TOP_DB - SPECTRUM_FLOOR_DB)) *
          plotHeight;

      context.font =
        '11px -apple-system, BlinkMacSystemFont, "Segoe UI", Ubuntu, Cantarell, "Noto Sans", "DejaVu Sans", sans-serif';
      context.textBaseline = 'middle';
      GRID_DB.forEach((db) => {
        const y = Math.round(gainY(db)) + 0.5;
        context.strokeStyle =
          db === 0 ? 'rgba(255,255,255,0.2)' : 'rgba(255,255,255,0.07)';
        context.beginPath();
        context.moveTo(PAD_L, y);
        context.lineTo(width - PAD_R, y);
        context.stroke();
        context.fillStyle = 'rgba(255,255,255,0.38)';
        context.textAlign = 'right';
        context.fillText(db > 0 ? `+${db}` : `${db}`, PAD_L - 7, y);
      });
      context.fillStyle = 'rgba(255,255,255,0.25)';
      context.textAlign = 'left';
      GRID_DBFS.forEach((db) => {
        context.fillText(`${db}`, width - PAD_R + 7, levelY(db));
      });
      context.textAlign = 'center';
      GRID_HZ.forEach(([hz, label]) => {
        const x = Math.round(frequencyX(hz)) + 0.5;
        context.strokeStyle = 'rgba(255,255,255,0.07)';
        context.beginPath();
        context.moveTo(x, PAD_T);
        context.lineTo(x, height - PAD_B);
        context.stroke();
        context.fillStyle = 'rgba(255,255,255,0.38)';
        context.fillText(label, x, height - PAD_B / 2);
      });

      const analyser = readDspAnalyser('master');
      if (analyser) {
        if (binsRef.current.length !== analyser.frequencyBinCount) {
          binsRef.current = new Float32Array(analyser.frequencyBinCount);
        }
        const bins = binsRef.current;
        analyser.getFloatFrequencyData(bins);
        const nyquist = readDspSampleRate() / 2;
        const floorY = height - PAD_B;
        context.beginPath();
        context.moveTo(PAD_L, floorY);
        for (let x = 0; x <= plotWidth; x += 1) {
          const hzFrom = xFrequency(PAD_L + x);
          const hzTo = xFrequency(PAD_L + x + 1);
          const first = Math.floor((hzFrom / nyquist) * bins.length);
          const last = Math.max(
            first,
            Math.min(
              bins.length - 1,
              Math.ceil((hzTo / nyquist) * bins.length),
            ),
          );
          let peak = SPECTRUM_FLOOR_DB;
          for (let bin = first; bin <= last; bin += 1) {
            peak = Math.max(peak, bins[bin] ?? SPECTRUM_FLOOR_DB);
          }
          context.lineTo(PAD_L + x, levelY(peak));
        }
        context.lineTo(width - PAD_R, floorY);
        context.closePath();
        context.fillStyle = 'rgba(0,229,207,0.1)';
        context.fill();
        context.strokeStyle = 'rgba(0,229,207,0.24)';
        context.lineWidth = 1;
        context.stroke();
      }

      // The guard lives at 3 Hz, outside the EQ-compatible 20 Hz plot. A cold
      // edge marker makes that always-on safeguard visible without extending
      // the musical frequency axis or pretending it changes audible bands.
      // Painted after the spectrum so the live fill cannot cover its meaning.
      const dcGlow = context.createLinearGradient(PAD_L, 0, PAD_L + 18, 0);
      if (safetyEnabled) {
        dcGlow.addColorStop(0, 'rgba(120,170,255,0.24)');
        dcGlow.addColorStop(1, 'rgba(120,170,255,0)');
        context.strokeStyle = 'rgba(120,170,255,0.78)';
      } else {
        dcGlow.addColorStop(0, 'rgba(255,88,112,0.18)');
        dcGlow.addColorStop(1, 'rgba(255,88,112,0)');
        context.strokeStyle = 'rgba(255,88,112,0.68)';
      }
      context.fillStyle = dcGlow;
      context.fillRect(PAD_L, PAD_T, 18, plotHeight);
      context.save();
      context.setLineDash([3, 3]);
      context.beginPath();
      context.moveTo(PAD_L + 0.5, PAD_T);
      context.lineTo(PAD_L + 0.5, height - PAD_B);
      context.stroke();
      context.restore();

      const trimY = gainY(trimDb);
      context.save();
      context.setLineDash([4, 5]);
      context.strokeStyle = 'rgba(255,176,89,0.82)';
      context.lineWidth = 1.4;
      context.beginPath();
      context.moveTo(PAD_L, trimY);
      context.lineTo(width - PAD_R, trimY);
      context.stroke();
      context.restore();

      const appliedY = gainY(displayedAppliedGainDb);
      if (Math.abs(displayedAppliedGainDb - trimDb) >= 0.05) {
        context.fillStyle = 'rgba(64,214,200,0.12)';
        context.fillRect(
          PAD_L,
          Math.min(trimY, appliedY),
          plotWidth,
          Math.abs(appliedY - trimY),
        );
      }
      context.strokeStyle =
        overCeiling && !reducing
          ? 'rgba(255,88,112,0.92)'
          : 'rgba(64,214,200,0.96)';
      context.lineWidth = 2;
      context.beginPath();
      context.moveTo(PAD_L, appliedY);
      context.lineTo(width - PAD_R, appliedY);
      context.stroke();

      context.textAlign = 'left';
      context.textBaseline = 'bottom';
      context.fillStyle = 'rgba(255,196,126,0.9)';
      context.fillText(
        t('dsp.master.graph.trimLine', { gain: trimDb.toFixed(1) }),
        PAD_L + 8,
        trimY - 4,
      );
      context.fillStyle =
        overCeiling && !reducing
          ? 'rgba(255,100,124,0.94)'
          : 'rgba(112,235,220,0.94)';
      context.fillText(
        t('dsp.master.graph.appliedLine', {
          gain: displayedAppliedGainDb.toFixed(1),
        }),
        PAD_L + plotWidth * 0.55,
        appliedY - 4,
      );

      if ((overCeiling && !reducing) || faults > 0) {
        const glow = context.createLinearGradient(0, PAD_T, 0, PAD_T + 26);
        glow.addColorStop(0, 'rgba(255,88,112,0.64)');
        glow.addColorStop(1, 'rgba(255,88,112,0)');
        context.fillStyle = glow;
        context.fillRect(PAD_L, PAD_T, plotWidth, 26);
      }

      frame = requestAnimationFrame(paint);
    };

    frame = requestAnimationFrame(paint);
    return () => cancelAnimationFrame(frame);
  }, [faults, overCeiling, reducing, safetyEnabled, t, trimDb]);

  return (
    <div className="dsp-eq-plot dsp-master-display">
      <canvas
        ref={canvasRef}
        className="dsp-eq-graph dsp-master-canvas"
        aria-hidden="true"
      />
      <div className="dsp-master-status" aria-live="polite">
        <span className={peakStatusClass}>{peakStatus}</span>
        <span className={dcFixed ? 'is-fixed' : 'is-safe'}>
          {dcFixed
            ? t('dsp.master.graph.dcFixed', {
                amount: displayDbfs(meter.dcCorrectionDb),
              })
            : t('dsp.master.graph.dcClean')}
        </span>
        <span className={faults > 0 ? 'is-fixed' : 'is-safe'}>
          {faults > 0
            ? t('dsp.master.graph.faultFixed', { count: faults })
            : t('dsp.master.graph.faultClean')}
        </span>
        <span className={safetyStatusClass}>{safetyStatus}</span>
        {master.enabled && master.loudnessMaximize ? (
          <span className="is-safe">
            {t('dsp.master.graph.loudnessActive', {
              gain: loudnessGainDb.toFixed(1),
              target: master.loudnessTargetLufs.toFixed(1),
            })}
          </span>
        ) : undefined}
      </div>
      <ul className="dsp-eq-legend dsp-master-legend">
        <li className="dsp-eq-legend-item">
          <span
            className="dsp-eq-legend-mark is-filled"
            style={{ color: 'rgba(0,229,207,0.5)' }}
          />
          {t('dsp.master.graph.spectrum')}
          <span className="dsp-eq-legend-scale">
            {t('dsp.eq.legend.level')}
          </span>
        </li>
        <li className="dsp-eq-legend-item">
          <span
            className="dsp-eq-legend-mark is-dashed"
            style={{ color: 'rgb(255,176,89)' }}
          />
          {t('dsp.master.graph.trim')}
          <span className="dsp-eq-legend-scale">{t('dsp.eq.legend.gain')}</span>
        </li>
        <li className="dsp-eq-legend-item">
          <span className="dsp-eq-legend-mark" style={{ color: '#40d6c8' }} />
          {t('dsp.master.graph.applied')}
          <span className="dsp-eq-legend-scale">{t('dsp.eq.legend.gain')}</span>
        </li>
        <li className="dsp-eq-legend-item">
          <span
            className="dsp-eq-legend-mark is-dashed"
            style={{ color: 'rgba(120,170,255,0.85)' }}
          />
          {t('dsp.master.graph.dcGuard')}
          <span className="dsp-eq-legend-scale">3 Hz</span>
        </li>
      </ul>
    </div>
  );
};

export default DspMasterGraph;
