/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { APP_ICON_GRID, appIconFrameFor } from 'common/appIconFrame';
import { TASKBAR_ICON_SIZES, type ITaskbarIconImage } from 'common/taskbarIcon';

/**
 * THE TASKBAR ICON IN THE WINDOW'S COLOURS (Ivan, 2026-10-26: "change the
 * color on the icon that is on the taskbar to match the app color ? see for
 * example icon in the mini player").
 *
 * The app icon's own composition (`assets/icon.svg`) — a rounded tile, an edge
 * along it, the wave with its glow — painted the way the header's mark is
 * (`SignalBrand.scss`): the tile in the window's surfaces, the edge and the
 * wave in the accent's run (`--logo-1` … `--logo-5`). Drawn at every size
 * Windows asks a window for, each on its own pixel grid, because one bitmap
 * scaled to the others is what makes a taskbar icon soft.
 */

/** The colours one icon is painted in, each as `#rrggbb`. */
export interface ITaskbarIconColours {
  /** The tile, top to bottom (the header mark's 160° gradient). */
  tile: readonly [string, string, string];
  /** The accent's run, the header's `--logo-1` to `--logo-5`. */
  logo: readonly [string, string, string, string, string];
}

const GRID = APP_ICON_GRID;
/** The wave, on that grid. */
const WAVE = {
  from: [112, 256],
  first: [
    [160, 144],
    [208, 144],
    [256, 256],
  ],
  second: [
    [304, 368],
    [352, 368],
    [400, 256],
  ],
} as const;

const hex = (red: number, green: number, blue: number) =>
  `#${[red, green, blue]
    .map((channel) => channel.toString(16).padStart(2, '0'))
    .join('')}`;

/**
 * The window's icon colours as they are painted now. Read from the page, not
 * worked out, so whatever decides the header's colours — a theme, the Tint, a
 * visualizer's colours, Colourful mode, Brightness — decides these too.
 *
 * The run is the header mark's own: a hidden tile with its classes, whose
 * `--logo-*` the stylesheet sets. Each colour is then painted once on a
 * one-pixel canvas and read back, because the page speaks oklch and
 * relative colours, and the icon file wants bytes.
 */
export const readTaskbarIconColours = (
  doc: Document = document,
): ITaskbarIconColours | undefined => {
  const canvas = doc.createElement('canvas');
  canvas.width = 1;
  canvas.height = 1;
  const pixel = canvas.getContext('2d', { willReadFrequently: true });
  if (!pixel) {
    return undefined;
  }
  const mark = doc.createElement('div');
  mark.className = 'brand-mark brand-mark--signal';
  mark.style.display = 'none';
  doc.body.append(mark);
  const resolve = (colour: string) => {
    const probe = doc.createElement('i');
    probe.style.color = colour;
    mark.append(probe);
    const computed = getComputedStyle(probe).color;
    probe.remove();
    pixel.clearRect(0, 0, 1, 1);
    pixel.fillStyle = '#000';
    pixel.fillStyle = computed;
    pixel.fillRect(0, 0, 1, 1);
    const [red, green, blue] = pixel.getImageData(0, 0, 1, 1).data;
    return hex(red, green, blue);
  };
  try {
    return {
      // The header tile's 160° gradient (`SignalBrand.scss`): a step over
      // the pane at its top, the pane, and down to the floor.
      tile: [
        resolve('oklch(from var(--surface-panel) calc(l + 0.05) c h)'),
        resolve('var(--surface-panel)'),
        resolve('var(--surface-base)'),
      ],
      logo: [
        resolve('var(--logo-1)'),
        resolve('var(--logo-2)'),
        resolve('var(--logo-3)'),
        resolve('var(--logo-4)'),
        resolve('var(--logo-5)'),
      ],
    };
  } finally {
    mark.remove();
  }
};

const withAlpha = (colour: string, alpha: number) => {
  const [red, green, blue] = [1, 3, 5].map((at) =>
    Number.parseInt(colour.slice(at, at + 2), 16),
  );
  return `rgba(${red}, ${green}, ${blue}, ${alpha})`;
};

/** Whether `colour` is a light one: its relative luminance past the middle. */
const isLight = (colour: string) => {
  const [red, green, blue] = [1, 3, 5].map((at) => {
    const channel = Number.parseInt(colour.slice(at, at + 2), 16) / 255;
    return channel <= 0.04045
      ? channel / 12.92
      : ((channel + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * red + 0.7152 * green + 0.0722 * blue > 0.5;
};

/** The wave's path, on a context already scaled from the grid. */
const traceWave = (context: CanvasRenderingContext2D) => {
  context.beginPath();
  context.moveTo(WAVE.from[0], WAVE.from[1]);
  [WAVE.first, WAVE.second].forEach(([one, two, end]) =>
    context.bezierCurveTo(one[0], one[1], two[0], two[1], end[0], end[1]),
  );
};

const runAcross = (
  context: CanvasRenderingContext2D,
  colours: readonly string[],
  x0: number,
  y0: number,
  x1: number,
  y1: number,
) => {
  const gradient = context.createLinearGradient(x0, y0, x1, y1);
  colours.forEach((colour, index) =>
    gradient.addColorStop(index / (colours.length - 1), colour),
  );
  return gradient;
};

/**
 * Where the tile and its edge fall at `size`, in that size's frame
 * (`appIconFrame.ts`), so the drawn icon is the installed one's size and
 * weight. The tile's outline and the edge's width land on whole pixels, the
 * edge flush inside the outline; `edgeAlpha` keeps the large frame's edge at
 * the grid's own weight where whole pixels round it up (1.7px at 96 is drawn
 * 2px wide at 84%).
 */
const frameAt = (size: number) => {
  const frame = appIconFrameFor(size);
  const exactEdge = size * (frame.rim.width / GRID);
  if (frame.name === 'large') {
    const edgeWidth = Math.max(1, Math.round(exactEdge));
    return {
      inset: Math.floor(size * ((GRID / 2 - frame.body) / GRID)),
      edgeWidth,
      edgeAlpha: Math.min(1, exactEdge / edgeWidth),
      glyphScale: frame.glyphScale,
    };
  }
  // The small and mid frames carry the edge at full strength: a ring as
  // visible as FluidWallpapers' beside it (Ivan, 2026-11-25), where a faint
  // one left the tile reading as smaller than its neighbour.
  return {
    inset: Math.round(size * ((GRID / 2 - frame.body) / GRID)),
    edgeWidth: Math.max(1, Math.round(exactEdge)),
    edgeAlpha: 1,
    glyphScale: frame.glyphScale,
  };
};

/**
 * One size of the icon, filling a `size` × `size` canvas.
 *
 * The tile's edge sits on whole pixels and its stroke is whole pixels wide at
 * every size, and the wave is thickened a little at the two smallest, where
 * the grid's weight would be a pixel and a half of grey.
 */
export const drawTaskbarIcon = (
  context: CanvasRenderingContext2D,
  size: number,
  { tile, logo }: ITaskbarIconColours,
) => {
  const scale = size / GRID;
  const { inset, edgeWidth, edgeAlpha, glyphScale } = frameAt(size);
  const extent = size - inset * 2;
  const radius = extent * 0.24;
  const glowBlur = Math.max(0.6, size * (16 / GRID));
  const waveWeight = size <= 24 ? 1.25 : 1;

  context.save();
  context.clearRect(0, 0, size, size);

  // The tile.
  const tilePath = new Path2D();
  tilePath.roundRect(inset, inset, extent, extent, radius);
  const angle = (160 * Math.PI) / 180;
  const dx = Math.sin(angle) * size * 0.5;
  const dy = -Math.cos(angle) * size * 0.5;
  const centre = size / 2;
  const ground = context.createLinearGradient(
    centre - dx,
    centre - dy,
    centre + dx,
    centre + dy,
  );
  ground.addColorStop(0, tile[0]);
  ground.addColorStop(0.5, tile[1]);
  ground.addColorStop(1, tile[2]);
  context.fillStyle = ground;
  context.fill(tilePath);

  // Depth and sheen inside the tile, as the app icon has them.
  context.save();
  context.clip(tilePath);
  const depth = context.createRadialGradient(
    256 * scale,
    300 * scale,
    0,
    256 * scale,
    300 * scale,
    250 * scale,
  );
  depth.addColorStop(0, withAlpha(logo[2], 0.22));
  depth.addColorStop(0.6, withAlpha(logo[2], 0.05));
  depth.addColorStop(1, withAlpha(logo[2], 0));
  context.fillStyle = depth;
  context.fillRect(0, 0, size, size);
  const sheen = context.createLinearGradient(0, 20 * scale, 0, 250 * scale);
  sheen.addColorStop(0, 'rgba(255, 255, 255, 0.07)');
  sheen.addColorStop(1, 'rgba(255, 255, 255, 0)');
  context.fillStyle = sheen;
  context.fillRect(0, 0, size, 250 * scale);
  context.restore();

  // The wave: its glow, then the stroke, grown with the tile about its centre.
  context.save();
  context.scale(scale, scale);
  context.translate(GRID / 2, GRID / 2);
  context.scale(glyphScale, glyphScale);
  context.translate(-GRID / 2, -GRID / 2);
  const waveRun = runAcross(context, logo, 112, 0, 400, 0);
  context.lineCap = 'round';
  context.strokeStyle = waveRun;
  context.filter = `blur(${glowBlur}px)`;
  context.globalAlpha = 0.55;
  context.lineWidth = 64 * waveWeight;
  traceWave(context);
  context.stroke();
  context.filter = 'none';
  context.globalAlpha = 1;
  context.lineWidth = 48 * waveWeight;
  traceWave(context);
  context.stroke();
  // The highlight along its first crest, where there are pixels for it.
  if (size >= 64) {
    context.translate(0, -10);
    context.strokeStyle = 'rgba(255, 255, 255, 0.45)';
    context.lineWidth = 9;
    context.setLineDash([0, 34, 150, 400]);
    traceWave(context);
    context.stroke();
  }
  context.restore();

  // The edge, on whole pixels, in the accent's run.
  const half = edgeWidth / 2;
  const edgePath = new Path2D();
  edgePath.roundRect(
    inset + half,
    inset + half,
    extent - edgeWidth,
    extent - edgeWidth,
    Math.max(0, radius - half),
  );
  context.strokeStyle = runAcross(context, logo, 0, 0, size, size);
  context.lineWidth = edgeWidth;
  // A light window's light tile keeps its edge whole: faint, the tile all but
  // vanished on a light taskbar, where the dark stock icon stands out.
  context.globalAlpha = isLight(tile[1]) ? 1 : edgeAlpha;
  context.stroke(edgePath);

  context.restore();
};

/** Every size of the icon, as the pixels main packs into its .ico. */
export const drawTaskbarIcons = (
  colours: ITaskbarIconColours,
  doc: Document = document,
): ITaskbarIconImage[] =>
  TASKBAR_ICON_SIZES.flatMap((size) => {
    const canvas = doc.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const context = canvas.getContext('2d', { willReadFrequently: true });
    if (!context) {
      return [];
    }
    drawTaskbarIcon(context, size, colours);
    const { data } = context.getImageData(0, 0, size, size);
    return [{ size, rgba: new Uint8Array(data.buffer.slice(0)) }];
  });
