/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { useEffect, useRef } from 'react';
import { useTranslation } from '../utils/I18nContext';
import { readDspAnalyser, readDspCorrelation } from './store';

/**
 * The height the block had before the meter was redrawn, and it keeps it.
 *
 * The panel around this is sized by the preamp's dials, so growing the canvas
 * grew the whole row and pushed everything under it down. A meter earns its
 * space by using what it has.
 */
const HEIGHT = 86;

/** Where the arc is marked, and what to write there. */
const TICKS: [number, string][] = [
  [-1, '-1'],
  [-0.5, ''],
  [0, '0'],
  [0.5, ''],
  [1, '+1'],
];

/** The sweep, in radians: a half circle, needle pivoting at the bottom. */
const START = Math.PI;
const SWEEP = Math.PI;

/** Correlation to the angle its needle points at. */
const angleOf = (value: number) => START + ((value + 1) / 2) * SWEEP;

/**
 * Phase correlation of what actually leaves the chain, on a swinging needle.
 *
 * Not a prediction from the settings — the worklet measures the samples after
 * every filter has run and reports the figure back, so this shows the result of
 * the curve, the engine, the mid/side mode and the fuzz together rather than
 * what any one of them was asked for.
 *
 * A needle rather than a bar, because a correlation meter IS a needle: this is
 * the one reading in the rack that lives on a signed scale with a meaningful
 * centre, and a moving pointer against a fixed arc shows "where between two
 * extremes" in a way a bar growing from the middle never quite does. It is also
 * the shape anybody who has seen a mixing desk already knows how to read.
 *
 * The scale runs -1 to +1 and the interesting half is the left one:
 *
 *  - **+1** the two channels are identical and sum with no loss at all.
 *  - **around +0.5 to +1** normal stereo music.
 *  - **0** the channels are unrelated; summing loses the difference.
 *  - **BELOW 0** content that partly cancels the moment anything sums to mono,
 *    which is a phone speaker, a mono PA and most Bluetooth speakers. This is
 *    the reading that predicts a mix falling apart somewhere the listener is
 *    not, and it is why the negative half of the arc is drawn in warning colour
 *    rather than in the same ink as the rest.
 *
 * Canvas rather than DOM for the same reason as the curve: it updates about
 * twenty-three times a second and a re-render each time would be pointless
 * churn for something that repaints itself.
 */
const DspPhaseMeter = () => {
  const { t } = useTranslation();
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const context = canvas?.getContext('2d');
    if (!canvas || !context) {
      return undefined;
    }
    let frame = 0;
    /** Eased toward the reading, so the needle swings rather than jumping. */
    let shown = 1;

    const paint = () => {
      frame = 0;
      const box = canvas.getBoundingClientRect();
      // Nothing to report on, or nowhere to draw it. Either way the loop keeps
      // turning so the meter starts by itself once the engine does.
      if (box.width < 1 || !readDspAnalyser()) {
        schedule();
        return;
      }
      const ratio = window.devicePixelRatio || 1;
      const width = Math.max(1, Math.round(box.width * ratio));
      const height = Math.max(1, Math.round(box.height * ratio));
      if (canvas.width !== width || canvas.height !== height) {
        canvas.width = width;
        canvas.height = height;
      }
      context.setTransform(ratio, 0, 0, ratio, 0, 0);
      context.clearRect(0, 0, box.width, box.height);

      const target = readDspCorrelation();
      shown += (target - shown) * 0.18;

      // Centred in whatever the box turns out to be, rather than hung from its
      // top: the panel beside it is a row of dials and a meter sitting high in
      // its own block reads as having come loose from the row.
      const radius = Math.min(box.width / 2 - 10, box.height - 30);
      const pivotX = box.width / 2;
      const pivotY = (box.height + radius) / 2 + 4;

      // The arc, in two halves. The left one is what this meter exists to warn
      // about, so it is warm before anything is drawn over it.
      context.lineWidth = 7;
      context.lineCap = 'butt';
      context.beginPath();
      context.arc(pivotX, pivotY, radius, START, START + SWEEP / 2);
      context.strokeStyle = 'rgba(255,100,124,0.3)';
      context.stroke();
      context.beginPath();
      context.arc(pivotX, pivotY, radius, START + SWEEP / 2, START + SWEEP);
      context.strokeStyle = 'rgba(0,229,207,0.28)';
      context.stroke();

      context.font =
        '10px system-ui, -apple-system, "Segoe UI", Roboto, sans-serif';
      context.textAlign = 'center';
      context.textBaseline = 'middle';
      TICKS.forEach(([value, label]) => {
        const angle = angleOf(value);
        const cos = Math.cos(angle);
        const sin = Math.sin(angle);
        context.beginPath();
        context.moveTo(
          pivotX + cos * (radius - 5),
          pivotY + sin * (radius - 5),
        );
        context.lineTo(
          pivotX + cos * (radius + (label === '' ? 3 : 5)),
          pivotY + sin * (radius + (label === '' ? 3 : 5)),
        );
        context.strokeStyle = 'rgba(255,255,255,0.3)';
        context.lineWidth = 1;
        context.stroke();
        if (label !== '') {
          context.fillStyle = 'rgba(255,255,255,0.45)';
          context.fillText(
            label,
            pivotX + cos * (radius - 15),
            pivotY + sin * (radius - 15),
          );
        }
      });

      // The reading, inside the arc above the pivot, where a meter's own label
      // has always gone.
      const warm = shown < 0;
      context.font =
        '600 17px system-ui, -apple-system, "Segoe UI", Roboto, sans-serif';
      context.fillStyle = warm
        ? 'rgba(255,140,158,0.95)'
        : 'rgba(255,255,255,0.9)';
      context.fillText(shown.toFixed(2), pivotX, pivotY - 13);

      // The needle last, over everything, with a hub to sit on.
      const angle = angleOf(Math.max(-1, Math.min(1, shown)));
      context.beginPath();
      context.moveTo(pivotX, pivotY);
      context.lineTo(
        pivotX + Math.cos(angle) * (radius - 3),
        pivotY + Math.sin(angle) * (radius - 3),
      );
      context.strokeStyle = warm ? 'rgba(255,140,158,0.95)' : '#ffffff';
      context.lineWidth = 2;
      context.lineCap = 'round';
      context.stroke();
      context.beginPath();
      context.arc(pivotX, pivotY, 4, 0, Math.PI * 2);
      context.fillStyle = warm ? 'rgba(255,140,158,0.95)' : '#ffffff';
      context.fill();

      schedule();
    };

    function schedule() {
      /**
       * Always, and never conditional on the engine existing.
       *
       * Stopping the loop when there was no analyser meant the meter died
       * permanently if it happened to mount before the engine started — which
       * is the common order, since the DSP page can be opened before anything
       * is played. Nothing re-armed it, so the meter worked or did not
       * depending on which mounted first, and that is exactly how it behaved.
       *
       * The paint below returns immediately when there is no engine, so an idle
       * frame costs a function call rather than a redraw.
       */
      if (frame === 0) {
        frame = window.requestAnimationFrame(paint);
      }
    }

    // Armed once; `schedule` keeps it alive for as long as the engine exists.
    frame = window.requestAnimationFrame(paint);
    return () => {
      if (frame !== 0) {
        window.cancelAnimationFrame(frame);
      }
    };
  }, []);

  return (
    <div className="dsp-eq-phase">
      <span className="dsp-eq-preset-label">{t('dsp.eq.phase')}</span>
      <canvas
        ref={canvasRef}
        className="dsp-eq-phase-canvas"
        style={{ height: HEIGHT }}
      />
    </div>
  );
};

export default DspPhaseMeter;
