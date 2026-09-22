/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { useCallback, useEffect, useRef, useState } from 'react';
import { MAX_GAIN, MIN_GAIN } from 'common/constants';
import { getEaseFactor } from 'common/smoothing';
import { useLiveAudioControl } from '../audio/LiveAudioContext';
import { useIsRootEuphoric } from '../utils/euphoriaMode';
import { getBandColor } from '../utils/bandColors';
import { useShownSceneSky } from '../utils/sceneTintStore';
import { useTranslation } from '../utils/I18nContext';
import useSmoothFrames from '../utils/useSmoothFrames';

type TWellStyle = 'bars' | 'scope';

const STYLE_KEY = 'fluideq.player.well';
/** The span the bars cover, low to high. */
const LOW_HZ = 30;
const HIGH_HZ = 16000;
/** How fast a bar falls back after a hit, and a peak cap after its bar. */
const RELEASE_MS = 110;
const PEAK_FALL_PER_MS = 0.00045;
/** The LED rows, in CSS pixels: a lit block and the dark line under it. */
const ROW_PX = 3;
const ROW_GAP_PX = 1;

const readStyle = (): TWellStyle => {
  try {
    return window.localStorage.getItem(STYLE_KEY) === 'scope'
      ? 'scope'
      : 'bars';
  } catch {
    return 'bars';
  }
};

interface IPaint {
  ghost: string;
  scope: string;
  /** A theme's single colour for the bars, or empty for the band colours. */
  tint: string;
}

/**
 * The player's analyser: the live output as a row of LED columns in the band
 * colours, with a peak cap falling slowly over each — or, after a click, the
 * wave itself as a scope line.
 *
 * It reads the same capture as the titlebar's meter and the graph, frame by
 * frame, never through React: a column per frequency region, the loudest of
 * that region's points, snapping up on a hit and easing back. The columns
 * sit in the colours the band sliders wear, so the one under 1 kHz is the
 * colour of the 1 kHz band.
 *
 * Its colours come from the player's theme (`--player-lcd-ghost`,
 * `--player-scope`, `--player-spectrum-tint`), read when the well is sized.
 */
const SpectrumWell = () => {
  const { t } = useTranslation();
  const { isActive, readFrame } = useLiveAudioControl();
  const isRainbow = useIsRootEuphoric();
  // The visualizer's colour as the window is wearing it, which is what the
  // accent — and so this meter's tint — resolves from.
  const sky = useShownSceneSky();
  const readRef = useRef(readFrame);
  readRef.current = readFrame;
  const activeRef = useRef(isActive);
  activeRef.current = isActive;
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const paintRef = useRef<IPaint>({ ghost: '', scope: '', tint: '' });
  const levelsRef = useRef<number[]>([]);
  const peaksRef = useRef<number[]>([]);
  const [style, setStyle] = useState<TWellStyle>(readStyle);
  const styleRef = useRef(style);
  styleRef.current = style;

  const draw = useCallback((deltaMs: number) => {
    const canvas = canvasRef.current;
    const context = canvas?.getContext('2d');
    if (!canvas || !context) {
      return false;
    }
    const { width, height } = canvas;
    const ratio = window.devicePixelRatio || 1;
    context.clearRect(0, 0, width, height);
    const frame = activeRef.current ? readRef.current() : undefined;
    const paint = paintRef.current;

    if (styleRef.current === 'scope') {
      const wave = frame?.waveform ?? [];
      context.lineWidth = 1.6 * ratio;
      context.strokeStyle = paint.scope;
      context.shadowColor = paint.scope;
      context.shadowBlur = 6 * ratio;
      context.beginPath();
      const count = Math.max(2, wave.length);
      for (let i = 0; i < count; i += 1) {
        const x = (i / (count - 1)) * width;
        const y = height / 2 - (wave[i] ?? 0) * height * 0.45;
        if (i === 0) {
          context.moveTo(x, y);
        } else {
          context.lineTo(x, y);
        }
      }
      context.stroke();
      context.shadowBlur = 0;
      return frame !== undefined;
    }

    const bars = Math.max(12, Math.min(48, Math.round(width / (9 * ratio))));
    const levels = levelsRef.current;
    const peaks = peaksRef.current;
    if (levels.length !== bars) {
      levels.length = bars;
      levels.fill(0);
      peaks.length = bars;
      peaks.fill(0);
    }
    const gap = Math.max(1, Math.round(1.5 * ratio));
    const barWidth = (width - gap * (bars - 1)) / bars;
    const row = Math.max(2, Math.round(ROW_PX * ratio));
    const rowGap = Math.max(1, Math.round(ROW_GAP_PX * ratio));
    const rows = Math.max(1, Math.floor((height + rowGap) / (row + rowGap)));
    const points = frame?.points ?? [];
    const fall = getEaseFactor(deltaMs, RELEASE_MS);
    let isMoving = frame !== undefined;
    let point = 0;
    for (let b = 0; b < bars; b += 1) {
      const low = LOW_HZ * (HIGH_HZ / LOW_HZ) ** (b / bars);
      const high = LOW_HZ * (HIGH_HZ / LOW_HZ) ** ((b + 1) / bars);
      let loudest = MIN_GAIN;
      while (point < points.length && points[point].x < low) {
        point += 1;
      }
      for (let p = point; p < points.length && points[p].x < high; p += 1) {
        loudest = Math.max(loudest, points[p].y);
      }
      const target = Math.max(
        0,
        Math.min(1, (loudest - MIN_GAIN) / (MAX_GAIN - MIN_GAIN)),
      );
      levels[b] =
        target > levels[b] ? target : levels[b] + (target - levels[b]) * fall;
      peaks[b] =
        levels[b] >= peaks[b]
          ? levels[b]
          : Math.max(0, peaks[b] - PEAK_FALL_PER_MS * deltaMs);
      if (levels[b] > 0.002 || peaks[b] > 0.002) {
        isMoving = true;
      }
      const left = Math.round(b * (barWidth + gap));
      const barPx = Math.max(1, Math.round(barWidth));
      const colour = paint.tint || getBandColor(b / (bars - 1)).color;
      const lit = Math.round(levels[b] * rows);
      for (let r = 0; r < rows; r += 1) {
        const y = height - (r + 1) * (row + rowGap) + rowGap;
        context.globalAlpha = r < lit ? 0.62 + (0.38 * r) / rows : 1;
        context.fillStyle = r < lit ? colour : paint.ghost;
        context.fillRect(left, y, barPx, row);
      }
      const cap = Math.min(rows - 1, Math.round(peaks[b] * rows));
      if (cap > 0) {
        context.globalAlpha = 1;
        context.fillStyle = colour;
        context.fillRect(
          left,
          height - (cap + 1) * (row + rowGap) + rowGap,
          barPx,
          row,
        );
      }
    }
    context.globalAlpha = 1;
    return isMoving;
  }, []);

  const kick = useSmoothFrames(draw, { isEnabled: true, target: canvasRef });

  // Sized to its box, in device pixels, and the theme's colours read then:
  // they change with the look, which re-lays the page out and lands here.
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || typeof ResizeObserver === 'undefined') {
      return undefined;
    }
    const observer = new ResizeObserver(([entry]) => {
      const ratio = window.devicePixelRatio || 1;
      const width = Math.max(1, Math.round(entry.contentRect.width * ratio));
      const height = Math.max(1, Math.round(entry.contentRect.height * ratio));
      // Only when the size has really changed: assigning to `canvas.width`
      // wipes the bitmap whether or not the number is different, and this is
      // measured on every re-lay of the deck around it.
      if (canvas.width === width && canvas.height === height) {
        return;
      }
      canvas.width = width;
      canvas.height = height;
      const computed = getComputedStyle(canvas);
      paintRef.current = {
        ghost: computed.getPropertyValue('--player-lcd-ghost').trim(),
        scope: computed.getPropertyValue('--player-scope').trim(),
        tint: computed.getPropertyValue('--player-spectrum-tint').trim(),
      };
      kick();
    });
    observer.observe(canvas);
    return () => observer.disconnect();
  }, [kick]);

  // Sound arriving wakes the loop; it sleeps again once every column is down.
  useEffect(() => {
    if (isActive) {
      kick();
    }
  }, [isActive, kick]);

  // Rainbow mode, and the visualizer's own colour, both change what the
  // columns are painted in (`--player-spectrum-tint`, which resolves from the
  // accent) while nothing about the page's layout changes with them — so the
  // colours are read again here rather than waiting for a resize that may
  // never come.
  //
  // AND READ UNTIL THEY STOP MOVING, not once. The window's colour arrives as
  // a fade, and a scene's own colour is measured a moment after it is picked,
  // so a single read at the instant the look changes takes a colour still on
  // its way — or the one before it. That is why the meter kept the last
  // scene's pink until the app was restarted (Ivan, 2026-09-22). Each frame
  // until a frame changes nothing, and not one frame more: no clock, no
  // guess at how long a fade lasts.
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) {
      return undefined;
    }
    let frame = 0;
    let previous = '';
    const settle = () => {
      const computed = getComputedStyle(canvas);
      const next = {
        ghost: computed.getPropertyValue('--player-lcd-ghost').trim(),
        scope: computed.getPropertyValue('--player-scope').trim(),
        tint: computed.getPropertyValue('--player-spectrum-tint').trim(),
      };
      paintRef.current = next;
      kick();
      const seen = `${next.ghost}|${next.scope}|${next.tint}`;
      if (seen !== previous) {
        previous = seen;
        frame = requestAnimationFrame(settle);
      }
    };
    frame = requestAnimationFrame(settle);
    return () => cancelAnimationFrame(frame);
  }, [isRainbow, sky, kick]);

  return (
    <button
      type="button"
      className="player-well"
      aria-label={t('player.well.aria')}
      title={t('player.well.hint')}
      onClick={() => {
        const next: TWellStyle = style === 'bars' ? 'scope' : 'bars';
        setStyle(next);
        try {
          window.localStorage.setItem(STYLE_KEY, next);
        } catch {
          // Remembered where storage allows; the well works either way.
        }
        kick();
      }}
    >
      <canvas
        ref={canvasRef}
        className="player-well__canvas"
        aria-hidden="true"
      />
    </button>
  );
};

export default SpectrumWell;
