/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { useEffect, useRef } from 'react';
import { useTranslation } from '../utils/I18nContext';
import { readDspAnalyser, readDspCorrelation } from './store';

/**
 * Track, then ticks and their labels, then the reading below both.
 *
 * The block it sits in is over a hundred pixels tall because the preamp's dials
 * set that height, so the meter may as well use it — at 64 the canvas left a
 * third of the box empty and the number had to crowd the scale.
 */
const HEIGHT = 86;

/** Where the scale is marked. */
const TICKS: [number, string][] = [
  [-1, '-1'],
  [-0.5, ''],
  [0, '0'],
  [0.5, ''],
  [1, '+1'],
];

/**
 * Phase correlation of what actually leaves the chain.
 *
 * Not a prediction from the settings — the worklet measures the samples after
 * every filter has run and reports the figure back, so this shows the result of
 * the curve, the engine, the mid/side mode and the fuzz together rather than
 * what any one of them was asked for.
 *
 * The scale runs -1 to +1 and the interesting half is the left one:
 *
 *  - **+1** the two channels are identical and sum with no loss at all.
 *  - **around +0.5 to +1** normal stereo music.
 *  - **0** the channels are unrelated; summing loses the difference.
 *  - **BELOW 0** content that partly cancels the moment anything sums to mono,
 *    which is a phone speaker, a mono PA and most Bluetooth speakers. This is
 *    the reading that predicts a mix falling apart somewhere the listener is
 *    not, and it is why the negative half is drawn in warning colour rather
 *    than in the same ink as the rest.
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
    /** Eased toward the reading so the needle does not twitch per report. */
    let shown = 1;

    const paint = () => {
      frame = 0;
      const box = canvas.getBoundingClientRect();
      if (box.width < 1) {
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

      // Stacked, not side by side. The box is narrow, and giving the number its
      // own column left the scale about sixty pixels wide — a meter with no room
      // to travel is not a meter. The number goes under the scale instead, where
      // it can be large and the track can have the whole width.
      const trackW = box.width;
      // Tall enough to be a bar rather than a line: this block sits beside the
      // preamp's dials and a thin strip beside a knob reads as a divider.
      const trackH = 26;
      const mid = trackW / 2;
      const atX = (value: number) => mid + (value * trackW) / 2;

      // The negative half, marked before anything is drawn over it: it is the
      // region the meter exists to warn about.
      context.fillStyle = 'rgba(255,100,124,0.12)';
      context.fillRect(0, 0, mid, trackH);
      context.fillStyle = 'rgba(255,255,255,0.05)';
      context.fillRect(mid, 0, mid, trackH);

      const x = atX(shown);
      const bar = Math.abs(x - mid);
      const warm = shown < 0;
      const fill = context.createLinearGradient(mid, 0, x, 0);
      fill.addColorStop(
        0,
        warm ? 'rgba(255,100,124,0.35)' : 'rgba(0,229,207,0.35)',
      );
      fill.addColorStop(
        1,
        warm ? 'rgba(255,100,124,0.95)' : 'rgba(0,229,207,0.95)',
      );
      context.fillStyle = fill;
      context.fillRect(warm ? mid - bar : mid, 0, bar, trackH);

      // Zero, where summing starts losing the difference between the channels.
      context.fillStyle = 'rgba(255,255,255,0.3)';
      context.fillRect(Math.round(mid), 0, 1, trackH);

      context.fillStyle = '#ffffff';
      context.fillRect(Math.round(x) - 1, -1, 2, trackH + 2);

      context.font =
        '10px system-ui, -apple-system, "Segoe UI", Roboto, sans-serif';
      context.textBaseline = 'top';
      TICKS.forEach(([value, label]) => {
        const tickX = Math.round(atX(value));
        context.fillStyle = 'rgba(255,255,255,0.18)';
        context.fillRect(
          Math.min(trackW - 1, Math.max(0, tickX)),
          trackH + 2,
          1,
          label === '' ? 3 : 5,
        );
        if (label !== '') {
          context.fillStyle = 'rgba(255,255,255,0.42)';
          const { width } = context.measureText(label);
          context.fillText(
            label,
            Math.min(trackW - width, Math.max(0, tickX - width / 2)),
            trackH + 9,
          );
        }
      });

      // Below the tick labels rather than among them: the two collided when the
      // number sat directly under the centre of the track.
      context.textBaseline = 'top';
      context.font =
        '600 18px system-ui, -apple-system, "Segoe UI", Roboto, sans-serif';
      context.fillStyle = warm
        ? 'rgba(255,140,158,0.95)'
        : 'rgba(255,255,255,0.9)';
      const value = shown.toFixed(2);
      context.fillText(
        value,
        mid - context.measureText(value).width / 2,
        trackH + 30,
      );

      schedule();
    };

    function schedule() {
      // Only while something is playing. A meter animating against silence is
      // sixty wake-ups a second to draw the same picture.
      if (frame === 0 && readDspAnalyser()) {
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
