/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { useEffect, useRef } from 'react';
import { useTranslation } from '../utils/I18nContext';
import DspPhaseModes from './DspPhaseModes';
import {
  readDspAnalyser,
  readDspCorrelation,
  readDspScatter,
  setDspPhaseView,
  useDspPhaseView,
} from './store';
import { readSurfaceAlpha } from '../utils/theme';

/** Where the arc is marked, and what to write there. */
const TICKS: [number, string][] = [
  [-1, '-1'],
  [-0.75, ''],
  [-0.5, ''],
  [-0.25, ''],
  [0, '0'],
  [0.25, ''],
  [0.5, ''],
  [0.75, ''],
  [1, '+1'],
];

/** The sweep, in radians: a half circle, needle pivoting at the bottom. */
const START = Math.PI;
const SWEEP = Math.PI;

/** Correlation to the angle its needle points at. */
const angleOf = (value: number) => START + ((value + 1) / 2) * SWEEP;

const FONT = 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif';

interface IBox {
  width: number;
  height: number;
}

/**
 * The needle dial: scale, reading and pointer.
 *
 * Drawn by the live view and by the switched-off one alike — off is this at
 * rest behind a lowered alpha, not a different picture, so switching the block
 * back on does not look like a different instrument arriving.
 */
const drawDial = (
  context: CanvasRenderingContext2D,
  box: IBox,
  value: number,
): void => {
  // As large as the box allows once the tick labels are accounted for, rather
  // than a dial floating inside a margin of it.
  const radius = Math.min(box.width / 2 - 6, box.height - 20);
  const pivotX = box.width / 2;
  const pivotY = (box.height + radius) / 2;
  const warm = value < 0;

  // The arc, in two halves. The left one is what this meter exists to warn
  // about, so it is warm before anything is drawn over it.
  context.lineWidth = 9;
  context.lineCap = 'butt';
  context.beginPath();
  context.arc(pivotX, pivotY, radius, START, START + SWEEP / 2);
  context.strokeStyle = 'rgba(255,100,124,0.42)';
  context.stroke();
  context.beginPath();
  context.arc(pivotX, pivotY, radius, START + SWEEP / 2, START + SWEEP);
  context.strokeStyle = 'rgba(0,229,207,0.4)';
  context.stroke();

  context.font = `10px ${FONT}`;
  context.textAlign = 'center';
  context.textBaseline = 'middle';
  TICKS.forEach(([at, label]) => {
    const angle = angleOf(at);
    const cos = Math.cos(angle);
    const sin = Math.sin(angle);
    const reach = label === '' ? 4 : 7;
    context.beginPath();
    context.moveTo(pivotX + cos * (radius - 6), pivotY + sin * (radius - 6));
    context.lineTo(
      pivotX + cos * (radius + reach),
      pivotY + sin * (radius + reach),
    );
    context.strokeStyle =
      label === '' ? 'rgba(255,255,255,0.26)' : 'rgba(255,255,255,0.5)';
    context.lineWidth = label === '' ? 1 : 1.5;
    context.stroke();
    if (label !== '') {
      context.fillStyle = 'rgba(255,255,255,0.45)';
      context.fillText(
        label,
        pivotX + cos * (radius - 17),
        pivotY + sin * (radius - 17),
      );
    }
  });

  // The reading, inside the arc above the pivot, where a meter's own label has
  // always gone.
  context.font = `600 19px ${FONT}`;
  context.fillStyle = warm ? 'rgba(255,140,158,0.95)' : 'rgba(255,255,255,0.9)';
  context.fillText(value.toFixed(2), pivotX, pivotY - 15);

  // The needle last, over everything, with a hub to sit on.
  const angle = angleOf(Math.max(-1, Math.min(1, value)));
  context.beginPath();
  context.moveTo(pivotX, pivotY);
  context.lineTo(
    pivotX + Math.cos(angle) * (radius - 3),
    pivotY + Math.sin(angle) * (radius - 3),
  );
  context.strokeStyle = warm ? 'rgba(255,140,158,0.95)' : '#ffffff';
  context.lineWidth = 2.5;
  context.lineCap = 'round';
  context.stroke();
  context.beginPath();
  context.arc(pivotX, pivotY, 5, 0, Math.PI * 2);
  context.fillStyle = warm ? 'rgba(255,140,158,0.95)' : '#ffffff';
  context.fill();
};

/**
 * How much of the previous frame survives into this one, as a fade.
 *
 * The pairs arrive twenty-three times a second and the loop paints sixty, so
 * a display cleared every frame showed the same cloud flickering as it was
 * redrawn. Fading instead of clearing gives the trace a tail, which is both
 * calmer to look at and what a real one does — the phosphor is the reason a
 * goniometer draws shapes rather than confetti.
 */
const SCOPE_FADE = 0.16;

/**
 * The goniometer: every recent pair plotted, rotated a quarter turn.
 *
 * Left against right, turned 45 degrees so the axes mean something nameable.
 * Vertical is what both channels share and horizontal is what they differ by,
 * which makes the shape readable rather than decorative: a vertical line is
 * mono, a round cloud is wide, a horizontal smear is the two channels fighting
 * and is the thing that vanishes on a phone.
 *
 * It answers what the needle cannot. Correlation is one number, and a mix
 * leaning hard to one side and a mix that is genuinely narrow can report the
 * same one — here they look nothing alike.
 */
const drawScope = (context: CanvasRenderingContext2D, box: IBox): void => {
  // Painted over rather than cleared, which is where the tail comes from.
  //
  // The plot colour, like every other drawing in the app. It was a near-black
  // violet from before the palette existed, so the one card on this page that
  // shows a scope was a black rectangle dropped into a window that has no
  // black in it.
  context.fillStyle = readSurfaceAlpha(
    '--surface-panel',
    SCOPE_FADE,
    `rgba(26, 58, 78, ${SCOPE_FADE})`,
  );
  context.fillRect(0, 0, box.width, box.height);

  const size = Math.min(box.width, box.height) - 6;
  const midX = box.width / 2;
  const midY = box.height / 2;
  const half = size / 2;

  context.strokeStyle = 'rgba(255,255,255,0.12)';
  context.lineWidth = 1;
  context.beginPath();
  context.moveTo(midX, midY - half);
  context.lineTo(midX, midY + half);
  context.moveTo(midX - half, midY);
  context.lineTo(midX + half, midY);
  context.stroke();

  // The single-channel diagonals, faint: a trace lying along one of them is a
  // signal in one channel only, worth recognising instantly.
  context.strokeStyle = 'rgba(255,255,255,0.06)';
  context.beginPath();
  context.moveTo(midX - half, midY - half);
  context.lineTo(midX + half, midY + half);
  context.moveTo(midX - half, midY + half);
  context.lineTo(midX + half, midY - half);
  context.stroke();

  const pairs = readDspScatter();
  if (pairs.length < 2) {
    return;
  }
  // 0.707 keeps a full-scale mono signal inside the box: the rotation adds the
  // two channels, and without it a legal signal would draw outside its display.
  const scale = half * 0.707;
  context.fillStyle = 'rgba(0,229,207,0.55)';
  for (let i = 0; i + 1 < pairs.length; i += 2) {
    const left = pairs[i];
    const right = pairs[i + 1];
    // Up is what they share, across is what they differ by.
    const x = midX + (left - right) * scale;
    const y = midY - (left + right) * scale;
    context.fillRect(x - 0.75, y - 0.75, 1.5, 1.5);
  }
};

/**
 * Phase, in whichever of its three views is chosen.
 *
 * Not a prediction from the settings — the worklet measures the samples after
 * every filter has run and reports them back, so this shows the result of the
 * curve, the engine, the mid/side mode and the fuzz together rather than what
 * any one of them was asked for.
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
  const view = useDspPhaseView();
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const context = canvas?.getContext('2d');
    if (!canvas || !context) {
      return undefined;
    }

    /**
     * Sized from the element, which is the only place the box is decided.
     *
     * `keep` leaves the previous frame in place for the scope to fade over.
     * A resize still clears: the canvas is reallocated at the new size and
     * whatever was in it is gone anyway.
     */
    const measure = (keep = false): IBox | undefined => {
      const box = canvas.getBoundingClientRect();
      if (box.width < 1) {
        return undefined;
      }
      const ratio = window.devicePixelRatio || 1;
      const width = Math.max(1, Math.round(box.width * ratio));
      const height = Math.max(1, Math.round(box.height * ratio));
      if (canvas.width !== width || canvas.height !== height) {
        canvas.width = width;
        canvas.height = height;
      }
      context.setTransform(ratio, 0, 0, ratio, 0, 0);
      if (!keep) {
        context.clearRect(0, 0, box.width, box.height);
      }
      return { width: box.width, height: box.height };
    };

    /**
     * Off paints the dial once, at rest and dimmed, and asks for no more frames.
     *
     * The whole point of switching it off is that it stops moving in the corner
     * of the eye. A loop still turning behind a greyed picture would be the cost
     * without the benefit.
     */
    if (view === 'off') {
      const box = measure();
      if (box) {
        context.globalAlpha = 0.28;
        drawDial(context, box, 0);
        context.globalAlpha = 1;
      }
      return undefined;
    }

    let frame = 0;
    /** Eased toward the reading, so the needle swings rather than jumping. */
    let shown = 1;

    const paint = () => {
      frame = 0;
      const box = measure(view === 'scope');
      // Nothing to report on, or nowhere to draw it. Either way the loop keeps
      // turning so the meter starts by itself once the engine does.
      if (!box || !readDspAnalyser('eq')) {
        schedule();
        return;
      }
      if (view === 'scope') {
        drawScope(context, box);
      } else {
        // Slow enough to be read at a glance. The figure it is drawing moves
        // twenty-three times a second and a needle that followed it exactly
        // would be a blur — an analogue meter has mass for the same reason.
        shown += (readDspCorrelation() - shown) * 0.09;
        drawDial(context, box, shown);
      }
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
       * The paint above returns immediately when there is no engine, so an idle
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
  }, [view]);

  return (
    <div className="dsp-eq-phase">
      <div className="dsp-eq-phase-head">
        <span className="dsp-eq-preset-label">{t('dsp.eq.phase')}</span>
        <DspPhaseModes view={view} onChange={setDspPhaseView} />
      </div>
      <canvas ref={canvasRef} className="dsp-eq-phase-canvas" />
    </div>
  );
};

export default DspPhaseMeter;
