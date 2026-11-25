/* Copyright (C) 2026 Ivan Carmenates Garcia. SPDX-License-Identifier: GPL-3.0-or-later */

import { useLayoutEffect, useRef } from 'react';
import { LIGHT_WINDOW_METER_STYLE, type MeterStyle } from 'common/meterStyles';
import { useLiveAudioFrames } from '../../audio/LiveAudioContext';
import type { ILiveAudioFrame } from '../../audio/liveFrameStore';
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
import {
  type ILevelFollower,
  LEVEL_FLOOR_DB,
  advanceLevel,
  createLevelFollower,
  levelFraction,
  levelZone,
} from '../../graph/outputLevel';
import { useTranslation } from '../../utils/I18nContext';
import { readSurface, readTextInk, useLiveSurface } from '../../utils/theme';
import { useLightWindow } from '../../utils/windowSide';

/**
 * The output meter in a figure: `OutputLevelMeter`'s own strips, scale and
 * letters, painted with its own drawing functions from the made-up music the
 * figure plays (`HelpMusic`), in the style the window opens on (`fluid` on a
 * dark window, `segments` on a light one) and in the window's own inks.
 *
 * Not the meter itself: that one claims the reader's audio capture, and
 * reads and writes the reader's own choice of style.
 */

/** `OutputLevelMeter`'s own geometry. */
const CHANNEL_WIDTH = 18;
const CHANNEL_GAP = 8;
const LABEL_BAND = 12;
const FOOT_BAND = 28;

const STYLE_NAME_KEYS = {
  fluid: 'look.meter.fluid',
  segments: 'look.meter.segments',
} as const;

const channelOf = ({ levelDb, peakDb }: ILevelFollower): IChannelLevel => ({
  level: levelFraction(levelDb),
  peak: levelFraction(peakDb),
  zone: levelZone(levelDb, false),
  peakZone: levelZone(peakDb, false),
});

export default function HelpMeter({
  onReading,
}: {
  /**
   * The loudest held peak whenever its printed number changes, or null for
   * nothing to read: `OutputLevelMeter`'s own report.
   */
  onReading?: (peakDb: number | null) => void;
}) {
  const { t } = useTranslation();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const frames = useLiveAudioFrames();
  const onReadingRef = useRef(onReading);
  onReadingRef.current = onReading;
  const isLight = useLightWindow();
  const style: MeterStyle & keyof typeof STYLE_NAME_KEYS = isLight
    ? (LIGHT_WINDOW_METER_STYLE as 'segments')
    : 'fluid';
  // Read so a change of the window's colours paints it in the new ones.
  const well = useLiveSurface('--meter-well', '#2e4f63');
  const unlit = useLiveSurface('--meter-unlit', '#1a3a4e');

  useLayoutEffect(() => {
    const canvas = canvasRef.current;
    const context = canvas?.getContext('2d');
    if (!canvas || !context) {
      return undefined;
    }
    let width = 0;
    let height = 0;
    let ratio = 1;
    // The meter's own ballistics: an instant attack, a release, and a peak
    // held for a second before it falls (`advanceLevel`).
    const followers: ILevelFollower[] = [];
    let lastAt: number | undefined;
    let printed = '';

    // Sized apart from painting: setting a canvas's size empties and
    // reallocates it, which every frame of music would otherwise do.
    const size = () => {
      const box = canvas.getBoundingClientRect();
      // The figure is drawn under CSS zoom; the canvas's own box, unzoomed.
      width = canvas.clientWidth;
      height = canvas.clientHeight;
      if (width <= 0 || height <= 0) {
        return;
      }
      ratio = Math.max(1, (box.width / width) * window.devicePixelRatio);
      canvas.width = Math.round(width * ratio);
      canvas.height = Math.round(height * ratio);
    };

    const paint = ({ outputLevels }: ILiveAudioFrame) => {
      if (width <= 0 || height <= 0) {
        return;
      }
      const now = performance.now();
      const deltaMs = lastAt === undefined ? 0 : now - lastAt;
      lastAt = now;
      outputLevels.forEach(({ levelDb }, index) => {
        followers[index] = advanceLevel(
          followers[index] ?? createLevelFollower(),
          levelDb,
          deltaMs,
        );
      });

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
      outputLevels.forEach((_, index) => {
        const rect = {
          x: startX + index * (CHANNEL_WIDTH + CHANNEL_GAP),
          y: LABEL_BAND,
          width: CHANNEL_WIDTH,
          height: rectHeight,
        };
        if (standsInSlot(style)) {
          drawSlot(pen, rect, well, 0);
        }
        drawChannel(
          pen,
          rect,
          channelOf(followers[index] ?? createLevelFollower()),
          style,
          false,
          unlit,
        );
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

      // The rail prints the loudest held peak, and only when the printed
      // number changes, as `OutputLevelMeter` reports it.
      const loudest = Math.max(
        LEVEL_FLOOR_DB,
        ...followers.map(({ peakDb }) => peakDb),
      );
      const next = loudest <= LEVEL_FLOOR_DB ? '' : loudest.toFixed(1);
      if (next !== printed) {
        printed = next;
        onReadingRef.current?.(next ? loudest : null);
      }
    };

    size();
    paint(frames.read());
    const unsubscribe = frames.subscribe(() => paint(frames.read()));
    if (typeof ResizeObserver === 'undefined') {
      return unsubscribe;
    }
    const observer = new ResizeObserver(() => {
      size();
      paint(frames.read());
    });
    observer.observe(canvas);
    return () => {
      unsubscribe();
      observer.disconnect();
    };
  }, [frames, isLight, style, t, unlit, well]);

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
