/**
 * Build assets/trayTemplate.png and its @2x: FluidEQ's mark for the Mac's
 * menu bar.
 *
 * WHY NOT THE APP ICON. A Mac draws a menu bar item at the image's own size
 * in points, so the 512px icon the tray was handed stood in the menu bar at
 * full size. And the menu bar is the system's, light or dark under whatever
 * wallpaper is behind it: the items in it are template images, black with an
 * alpha channel, which AppKit tints itself. A file whose name ends in
 * `Template` is one — that is how Electron tells AppKit — and the `@2x` beside
 * it is picked up by name for a Retina menu bar.
 *
 * WHAT IT IS. The icon's tile as an outline with the wave inside it: the same
 * shape as the Dock's icon, at the stroke weight of the system's own menu bar
 * symbols. A solid tile with the wave cut out of it was drawn too and stood
 * in the bar a good deal heavier than everything beside it.
 *
 * DRAWN HERE, NOT RESAMPLED. The wave is the icon's own curve
 * (`assets/icon.svg`), rasterised at 18 and 36 pixels with 6×6 samples a
 * pixel, so its edges are coverage and not a 512px picture shrunk to 18. The
 * repository has no SVG renderer and a menu bar mark needs nothing one does.
 *
 * Re-run this whenever the wave in assets/icon.svg changes:
 *   pnpm exec ts-node .erb/scripts/make-mac-tray-icon.ts
 */
import fs from 'fs';
import path from 'path';
import { deflateSync } from 'zlib';

type TPoint = readonly [number, number];

/** The icon's 512-unit canvas: the tile's edges and the wave's two halves. */
const TILE_MIN = 32;
const TILE_MAX = 480;
const TILE_RADIUS = 104;
const WAVE: readonly (readonly [TPoint, TPoint, TPoint, TPoint])[] = [
  [
    [112, 256],
    [160, 144],
    [208, 144],
    [256, 256],
  ],
  [
    [256, 256],
    [304, 368],
    [352, 368],
    [400, 256],
  ],
];

/**
 * In the icon's units. Thicker than the icon's own 48 and the tile's edge
 * drawn at all, because at 16 points a 48-unit stroke is 1.7 points wide and
 * the system's symbols in the bar beside it are closer to two.
 */
const WAVE_WIDTH = 52;
const RING_WIDTH = 44;

/**
 * The menu bar's item height in points, and the mark inside it.
 *
 * 13, measured against the system's own: on macOS 26 Wi-Fi stands 12.5 points
 * tall, Search 12.5, Control Center's rounded square 13.5, the battery 12.
 * Drawn at 16 the tile was the biggest thing in the bar — a full square reads
 * larger than a glyph of the same height, and Ivan saw it at once.
 */
const CANVAS_PT = 18;
const GLYPH_PT = 13;
const SAMPLES = 6;

const repoRoot = path.resolve(__dirname, '../..');

/** The curve as short straight pieces, fine enough that nobody sees them. */
const flatten = (pieces: typeof WAVE, steps: number): TPoint[] =>
  pieces.flatMap(([p0, p1, p2, p3], piece) =>
    Array.from({ length: steps + 1 }, (_, step): TPoint => {
      const t = step / steps;
      const u = 1 - t;
      const a = u * u * u;
      const b = 3 * u * u * t;
      const c = 3 * u * t * t;
      const d = t * t * t;
      return [
        a * p0[0] + b * p1[0] + c * p2[0] + d * p3[0],
        a * p0[1] + b * p1[1] + c * p2[1] + d * p3[1],
      ];
      // The second half starts where the first ends; one copy of that point.
    }).slice(piece === 0 ? 0 : 1),
  );

const wave = flatten(WAVE, 200);

const distanceToSegment = (x: number, y: number, a: TPoint, b: TPoint) => {
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  const length = dx * dx + dy * dy;
  const t =
    length === 0
      ? 0
      : Math.max(0, Math.min(1, ((x - a[0]) * dx + (y - a[1]) * dy) / length));
  return Math.hypot(a[0] + t * dx - x, a[1] + t * dy - y);
};

const distanceToWave = (x: number, y: number) =>
  wave.reduce(
    (nearest, point, index) =>
      index === 0
        ? nearest
        : Math.min(nearest, distanceToSegment(x, y, wave[index - 1], point)),
    Number.POSITIVE_INFINITY,
  );

/** Signed distance to the tile's edge: negative inside. */
const distanceToTile = (x: number, y: number) => {
  const centre = (TILE_MIN + TILE_MAX) / 2;
  const half = (TILE_MAX - TILE_MIN) / 2 - TILE_RADIUS;
  const qx = Math.abs(x - centre) - half;
  const qy = Math.abs(y - centre) - half;
  return (
    Math.hypot(Math.max(qx, 0), Math.max(qy, 0)) +
    Math.min(Math.max(qx, qy), 0) -
    TILE_RADIUS
  );
};

const isInk = (x: number, y: number) => {
  const edge = distanceToTile(x, y);
  return (
    (edge <= 0 && edge >= -RING_WIDTH) || distanceToWave(x, y) <= WAVE_WIDTH / 2
  );
};

/** Black, with the mark's coverage as alpha: what a template image is. */
const rasterise = (pixels: number): Buffer => {
  const rgba = Buffer.alloc(pixels * pixels * 4);
  const pointsPerPixel = CANVAS_PT / pixels;
  const unitsPerPoint = (TILE_MAX - TILE_MIN) / GLYPH_PT;
  const margin = (CANVAS_PT - GLYPH_PT) / 2;
  for (let row = 0; row < pixels; row += 1) {
    for (let column = 0; column < pixels; column += 1) {
      let covered = 0;
      for (let sy = 0; sy < SAMPLES; sy += 1) {
        for (let sx = 0; sx < SAMPLES; sx += 1) {
          const xPt = (column + (sx + 0.5) / SAMPLES) * pointsPerPixel;
          const yPt = (row + (sy + 0.5) / SAMPLES) * pointsPerPixel;
          if (
            isInk(
              (xPt - margin) * unitsPerPoint + TILE_MIN,
              (yPt - margin) * unitsPerPoint + TILE_MIN,
            )
          ) {
            covered += 1;
          }
        }
      }
      rgba[(row * pixels + column) * 4 + 3] = Math.round(
        (255 * covered) / (SAMPLES * SAMPLES),
      );
    }
  }
  return rgba;
};

const CRC_TABLE = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k += 1) {
    c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  }
  return c >>> 0;
});

const crc32 = (bytes: Buffer) => {
  let crc = 0xffffffff;
  bytes.forEach((byte) => {
    crc = CRC_TABLE[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  });
  return (crc ^ 0xffffffff) >>> 0;
};

const chunk = (type: string, data: Buffer) => {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([length, body, crc]);
};

/** An 8-bit RGBA PNG, every row unfiltered. */
const encodePng = (pixels: number, rgba: Buffer) => {
  const header = Buffer.alloc(13);
  header.writeUInt32BE(pixels, 0);
  header.writeUInt32BE(pixels, 4);
  header[8] = 8;
  header[9] = 6;
  const stride = pixels * 4;
  const raw = Buffer.alloc((stride + 1) * pixels);
  for (let row = 0; row < pixels; row += 1) {
    rgba.copy(raw, row * (stride + 1) + 1, row * stride, (row + 1) * stride);
  }
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', header),
    chunk('IDAT', deflateSync(raw)),
    chunk('IEND', Buffer.alloc(0)),
  ]);
};

const write = (name: string, pixels: number) => {
  const target = path.join(repoRoot, 'assets', name);
  // Beside the target and renamed over it, so a reader never sees half a file.
  const staging = `${target}.tmp`;
  fs.writeFileSync(staging, encodePng(pixels, rasterise(pixels)));
  fs.renameSync(staging, target);
  console.log(`Wrote ${path.relative(repoRoot, target)} (${pixels}px)`);
};

write('trayTemplate.png', CANVAS_PT);
write('trayTemplate@2x.png', CANVAS_PT * 2);
