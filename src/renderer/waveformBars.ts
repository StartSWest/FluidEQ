/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU General Public License version 3 or later.
*/

import type { WaveformStyle } from 'common/waveformStyles';

/**
 * The titlebar's four bar styles, painted on the screen's own pixels.
 *
 * They were paths built in a fixed 420 x 58 box and stretched onto the pane,
 * so every bar edge landed between two device pixels and came out as a soft
 * grey column — the opposite of the sharp, clean look asked of this strip
 * (Ivan, 2026-09-26: "fix them all ... the wave on top", "sharp and clean
 * border"). Painted here at the pane's real size, every edge is on a pixel,
 * and each bar carries a thin lit cap the way the side meter's columns carry
 * their tip: the value lives at the top of a bar.
 *
 * Only while the analyser's bands are there; with none the styles fall back
 * to their time-domain shapes (`createWaveformShape`).
 */
export const CRISP_BAR_STYLES: ReadonlySet<WaveformStyle> = new Set([
  'bars',
  'mirror-bars',
  'blocks',
  'lattice',
]);

export interface IBarBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** How thick a lit cap is, in CSS pixels. */
const CAP = 1.5;
/** What a silent band still shows, so the strip reads as present and quiet. */
const STUMP = 1.5;

export const paintCrispBars = (
  context: CanvasRenderingContext2D,
  ratio: number,
  box: IBarBox,
  bands: readonly number[],
  style: WaveformStyle,
  body: string | CanvasGradient,
  cap: string,
) => {
  const count = bands.length;
  if (count === 0) {
    return;
  }
  const px = (value: number) => Math.round(value * ratio) / ratio;
  const hair = 1 / ratio;
  const pitch = box.width / count;
  const barWidth = Math.max(
    2 * hair,
    px(pitch * (style === 'lattice' ? 0.24 : 0.62)),
  );
  const floor = px(box.y + box.height);
  const centre = px(box.y + box.height / 2);
  const capHeight = Math.max(hair, px(CAP));
  const stump = Math.max(hair, px(STUMP));
  // A rung of the block ladder is as tall as its bar is wide, near enough,
  // so the ladder keeps its shape at every pane height and only the count
  // of lit rungs answers the music.
  const rung = Math.max(px(3), px(barWidth * 0.72));
  const rungGap = Math.max(hair, px(1.5));
  const rungPitch = rung + rungGap;

  // Two passes, bodies then caps, so the fill changes twice a frame rather
  // than twice a bar.
  const pieces: [number, number, number, number][] = [];
  const caps: [number, number, number, number][] = [];
  for (let index = 0; index < count; index += 1) {
    const magnitude = Math.max(0, Math.min(1, bands[index]));
    const left = px(box.x + index * pitch + (pitch - barWidth) / 2);
    if (style === 'mirror-bars') {
      const half = Math.max(stump / 2, px((magnitude * box.height) / 2));
      pieces.push([left, centre - half, barWidth, half * 2]);
      if (half >= capHeight * 2) {
        caps.push([left, centre - half, barWidth, capHeight]);
        caps.push([left, centre + half - capHeight, barWidth, capHeight]);
      }
    } else if (style === 'blocks') {
      const lit = Math.max(
        1,
        Math.floor((magnitude * box.height + rungGap) / rungPitch),
      );
      for (let level = 0; level < lit; level += 1) {
        const top = floor - (level + 1) * rungPitch + rungGap;
        (level === lit - 1 && lit > 1 ? caps : pieces).push([
          left,
          top,
          barWidth,
          rung,
        ]);
      }
    } else {
      const height = Math.max(stump, px(magnitude * box.height));
      pieces.push([left, floor - height, barWidth, height]);
      if (height >= capHeight * 2) {
        caps.push([left, floor - height, barWidth, capHeight]);
      }
    }
  }
  context.fillStyle = body;
  pieces.forEach(([x, y, width, height]) =>
    context.fillRect(x, y, width, height),
  );
  context.fillStyle = cap;
  caps.forEach(([x, y, width, height]) =>
    context.fillRect(x, y, width, height),
  );
};
