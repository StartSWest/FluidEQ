/* Copyright (C) 2026 Ivan Carmenates Garcia. SPDX-License-Identifier: GPL-3.0-or-later */

import { useLayoutEffect, useRef } from 'react';
import { LIGHT_WINDOW_METER_STYLE, type MeterStyle } from 'common/meterStyles';
import {
  drawChannel,
  drawClipCap,
  drawSlot,
  standsInSlot,
  unlitLuminance,
} from '../../graph/meter/meterDraw';
import {
  type IChannelLevel,
  createPen,
  ladderRows,
  meterInks,
} from '../../graph/meter/meterPaint';
import { drawMeterPrint } from '../../graph/meter/meterPrint';
import { levelFraction, levelZone } from '../../graph/outputLevel';
import { useTranslation } from '../../utils/I18nContext';
import { readSurface, readTextInk, useLiveSurface } from '../../utils/theme';
import { useLightWindow } from '../../utils/windowSide';

/**
 * The output meter as a picture: `OutputLevelMeter`'s own strips, scale and
 * letters painted once with its own drawing functions, at a made-up level.
 * The meter itself claims the reader's audio capture to draw their sound,
 * which a figure must never do; this paints the same canvas, in the style
 * the window opens on (`fluid` on a dark window, `segments` on a light one)
 * and in the window's own inks, and paints it again when those change.
 */

/** Two channels, a loud passage just under the ceiling's warning. */
const LEVELS_DB: readonly { level: number; peak: number }[] = [
  { level: -9.5, peak: -6.4 },
  { level: -10.5, peak: -7.1 },
];

/** `OutputLevelMeter`'s own geometry. */
const CHANNEL_WIDTH = 18;
const CHANNEL_GAP = 8;
const LABEL_BAND = 12;
const FOOT_BAND = 28;

const STYLE_NAME_KEYS = {
  fluid: 'look.meter.fluid',
  segments: 'look.meter.segments',
} as const;

const channelOf = ({ level, peak }: { level: number; peak: number }) =>
  ({
    level: levelFraction(level),
    peak: levelFraction(peak),
    zone: levelZone(level, false),
    peakZone: levelZone(peak, false),
  }) satisfies IChannelLevel;

export default function HelpMeterStill() {
  const { t } = useTranslation();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const isLight = useLightWindow();
  const style: MeterStyle & keyof typeof STYLE_NAME_KEYS = isLight
    ? (LIGHT_WINDOW_METER_STYLE as 'segments')
    : 'fluid';
  // Read so a change of the window's colours paints the picture again.
  const well = useLiveSurface('--meter-well', '#2e4f63');
  const unlit = useLiveSurface('--meter-unlit', '#1a3a4e');

  useLayoutEffect(() => {
    const canvas = canvasRef.current;
    const context = canvas?.getContext('2d');
    if (!canvas || !context) {
      return undefined;
    }
    const paint = () => {
      const box = canvas.getBoundingClientRect();
      // The figure is drawn under CSS zoom; the canvas's own box, unzoomed.
      const width = canvas.clientWidth;
      const height = canvas.clientHeight;
      if (width <= 0 || height <= 0) {
        return;
      }
      const ratio = Math.max(1, (box.width / width) * window.devicePixelRatio);
      canvas.width = Math.round(width * ratio);
      canvas.height = Math.round(height * ratio);
      context.setTransform(ratio, 0, 0, ratio, 0, 0);
      context.clearRect(0, 0, width, height);
      const inks = meterInks(
        unlitLuminance(readSurface('--surface-base', '#0b0f14'), well, unlit),
        isLight,
      );
      const pen = createPen(context, ratio, 0, inks);
      const totalWidth = 2 * CHANNEL_WIDTH + CHANNEL_GAP;
      const startX = (width - totalWidth) / 2;
      const rectHeight = Math.max(1, height - LABEL_BAND - FOOT_BAND);
      LEVELS_DB.forEach((reading, index) => {
        const rect = {
          x: startX + index * (CHANNEL_WIDTH + CHANNEL_GAP),
          y: LABEL_BAND,
          width: CHANNEL_WIDTH,
          height: rectHeight,
        };
        if (standsInSlot(style)) {
          drawSlot(pen, rect, well, 0);
        }
        drawChannel(pen, rect, channelOf(reading), style, false, unlit);
        drawClipCap(pen, rect, 0);
      });
      drawMeterPrint(context, {
        boxWidth: width,
        boxHeight: height,
        startX,
        totalWidth,
        channelWidth: CHANNEL_WIDTH,
        channelGap: CHANNEL_GAP,
        rectY: LABEL_BAND,
        rectHeight,
        scale: { rows: ladderRows(style, rectHeight) },
        letters: [t('graph.meter.left'), t('graph.meter.right')],
        styleName: t(STYLE_NAME_KEYS[style]).toUpperCase(),
        ink: readTextInk(),
        ceiling: inks.zones.over,
      });
    };
    paint();
    if (typeof ResizeObserver === 'undefined') {
      return undefined;
    }
    const observer = new ResizeObserver(paint);
    observer.observe(canvas);
    return () => observer.disconnect();
  }, [isLight, style, t, unlit, well]);

  return (
    <button
      type="button"
      className="output-meter"
      aria-label={t('graph.meter.aria')}
    >
      <canvas ref={canvasRef} className="output-meter__canvas" aria-hidden />
    </button>
  );
}
