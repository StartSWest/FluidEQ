/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { useEffect, useRef } from 'react';
import { IExciterSettings } from '../../common/dsp/chain';
import { useTranslation } from '../utils/I18nContext';
import { readDspExciterBands, readDspExciterOrganic } from './store';

/**
 * What the exciter is doing, drawn rather than described.
 *
 * A harmonic generator is the hardest stage in a rack to believe in. An
 * equaliser draws a curve and you can see the cut; a compressor moves a gain
 * reduction meter. This adds content that was not there, at frequencies the
 * spectrum already occupies, and the honest description of a good setting is
 * "slightly bigger" — which is indistinguishable from expectation. So the
 * three bands and the organic stage each get a bar showing what they ACTUALLY
 * contributed on the last block, reported by the worklet.
 *
 * The numbers are read from the audio thread rather than from the settings,
 * and that is the point rather than a detail. A dynamic band's amount depends
 * on how loud its own passband is this instant, and the organic stage's drive
 * wanders continuously by design. Drawn from the settings these bars would sit
 * perfectly still, and the one claim this stage makes — that it moves with the
 * music — would be the one thing invisible.
 */

/** Bar heights ease towards the reading rather than jumping to it. */
const RISE = 0.28;
const FALL = 0.12;

const PAD = 10;
const LABEL_ROW = 16;

interface IDspExciterDisplayProps {
  settings: IExciterSettings;
}

const DspExciterDisplay = ({ settings }: IDspExciterDisplayProps) => {
  const { t } = useTranslation();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  /** Eased values, kept across frames so the bars glide. */
  const drawn = useRef([0, 0, 0, 0]);
  /** Read in the frame loop without making it a dependency of the effect. */
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
      // Sized in real pixels so a bar's edge is a straight line rather than a
      // two-pixel smear, and only when it has actually changed — assigning
      // width clears the canvas, so doing it every frame is a free repaint.
      const ratio = window.devicePixelRatio || 1;
      const backingW = Math.round(width * ratio);
      const backingH = Math.round(height * ratio);
      if (canvas.width !== backingW || canvas.height !== backingH) {
        canvas.width = backingW;
        canvas.height = backingH;
      }
      context.setTransform(ratio, 0, 0, ratio, 0, 0);
      context.clearRect(0, 0, width, height);

      const live = readDspExciterBands();
      const organic = readDspExciterOrganic();
      const { current } = settingsRef;
      // The organic reading is an asymmetry, roughly 0.2 to 0.65, which means
      // nothing to anyone. Normalised to its own range so the bar reads as
      // "how much of what it can do", the same question the other three answer.
      const organicNormalised = current.organic.enabled
        ? Math.max(0, Math.min(1, (organic - 0.2) / 0.45))
        : 0;
      const targets = [
        live[0] ?? 0,
        live[1] ?? 0,
        live[2] ?? 0,
        organicNormalised,
      ];

      const barTop = PAD;
      const barBottom = height - PAD - LABEL_ROW;
      const barHeight = Math.max(1, barBottom - barTop);
      const slot = (width - PAD * 2) / 4;

      targets.forEach((target, index) => {
        const now = drawn.current[index];
        // Asymmetric easing: quick to show a band arriving, slow to let it go.
        // Symmetric easing made the dynamic bands flicker on every transient,
        // which reads as a fault in the meter rather than as a fast band.
        drawn.current[index] =
          now + (target - now) * (target > now ? RISE : FALL);
        const value = drawn.current[index];

        const x = PAD + slot * index + slot * 0.18;
        const barWidth = slot * 0.64;
        const filled = barHeight * Math.min(1, value);

        context.fillStyle = 'rgba(255, 255, 255, 0.05)';
        context.fillRect(x, barTop, barWidth, barHeight);

        if (filled > 0.5) {
          // The organic stage gets its own colour because it is not a fourth
          // band: it is a different effect that happens to live on this page.
          const gradient = context.createLinearGradient(
            0,
            barBottom,
            0,
            barBottom - filled,
          );
          if (index === 3) {
            gradient.addColorStop(0, 'rgba(255, 176, 89, 0.85)');
            gradient.addColorStop(1, 'rgba(255, 214, 140, 0.95)');
          } else {
            gradient.addColorStop(0, 'rgba(64, 214, 200, 0.8)');
            gradient.addColorStop(1, 'rgba(126, 240, 226, 0.95)');
          }
          context.fillStyle = gradient;
          context.fillRect(x, barBottom - filled, barWidth, filled);
        }
      });

      frame = requestAnimationFrame(paint);
    };

    frame = requestAnimationFrame(paint);
    return () => cancelAnimationFrame(frame);
  }, []);

  const labels = [
    t('dsp.exciter.band.low'),
    t('dsp.exciter.band.mid'),
    t('dsp.exciter.band.high'),
    t('dsp.exciter.organic'),
  ];

  return (
    <div className="dsp-exciter-display">
      <canvas
        ref={canvasRef}
        className="dsp-exciter-canvas"
        // The bars carry no information a screen reader can use — they are a
        // continuously moving restatement of settings that are themselves
        // announced by the dials below. Naming it would add four numbers that
        // change twenty times a second to the accessibility tree.
        aria-hidden="true"
      />
      <ul className="dsp-exciter-legend">
        {labels.map((label) => (
          <li key={label}>{label}</li>
        ))}
      </ul>
    </div>
  );
};

export default DspExciterDisplay;
