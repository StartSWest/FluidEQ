/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { useEffect, useRef } from 'react';
import { useTranslation } from '../utils/I18nContext';
import { readDspAnalyser, readDspCorrelation } from './store';

const HEIGHT = 34;

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

      const W = box.width;
      const H = box.height;
      const mid = W / 2;
      const track = H - 16;

      // The negative half, marked before anything is drawn over it: it is the
      // region the meter exists to warn about.
      context.fillStyle = 'rgba(255,100,124,0.10)';
      context.fillRect(0, 0, mid, track);

      context.fillStyle = 'rgba(255,255,255,0.06)';
      context.fillRect(mid, 0, mid, track);

      // Centre line at zero, where summing starts losing the difference.
      context.fillStyle = 'rgba(255,255,255,0.22)';
      context.fillRect(Math.round(mid), 0, 1, track);

      const x = mid + (shown * W) / 2;
      const bar = Math.min(mid, Math.abs(x - mid));
      context.fillStyle =
        shown < 0 ? 'rgba(255,100,124,0.85)' : 'rgba(0,229,207,0.85)';
      context.fillRect(shown < 0 ? mid - bar : mid, 0, bar, track);

      context.fillStyle = '#ffffff';
      context.fillRect(Math.round(x) - 1, 0, 2, track);

      context.font =
        '10px system-ui, -apple-system, "Segoe UI", Roboto, sans-serif';
      context.textBaseline = 'alphabetic';
      context.fillStyle = 'rgba(255,255,255,0.45)';
      context.fillText('-1', 1, H - 3);
      context.fillStyle = 'rgba(255,255,255,0.62)';
      context.fillText(shown.toFixed(2), mid - 11, H - 3);
      context.fillStyle = 'rgba(255,255,255,0.45)';
      context.fillText('+1', W - 15, H - 3);

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
      <span className="dsp-eq-field-label">{t('dsp.eq.phase')}</span>
      <canvas
        ref={canvasRef}
        className="dsp-eq-phase-canvas"
        style={{ height: HEIGHT }}
      />
    </div>
  );
};

export default DspPhaseMeter;
