/**
 * Build every installed copy of the app icon from its drawing
 * (`appIconArt.ts`), each size in the frame made for it
 * (`src/common/appIconFrame.ts`):
 *
 *   assets/icon.svg, icon-mid.svg, icon-small.svg  the three frames
 *   assets/icons/<n>x<n>.png  16 to 1024: Linux, the tray menu, the lighting
 *                             assets and the tour
 *   assets/icon.png           512: macOS and Linux windows and tray
 *   assets/icon.ico           16 to 256: the window, taskbar, tray, the
 *                             installer and uninstaller, the dev binary
 *   assets/icon.icns          16 to 1024: macOS
 *
 * then run `pnpm make-tray-badge-icon` for assets/icon-update.ico, which is
 * drawn from icon.ico (`pnpm make-app-icons` does both).
 *
 * Every size is painted by Chromium from the SVG at its own pixel size,
 * never scaled from another bitmap: a 16px frame resampled from the 256 is
 * the soft icon this exists to avoid.
 */
import fs from 'fs';
import path from 'path';
import {
  APP_ICON_FRAMES,
  appIconFrameFor,
  type IAppIconFrame,
} from '../../src/common/appIconFrame';
import { appIconSvg } from './appIconArt';
import { evaluateInChrome } from './headlessChrome';

const assets = path.resolve(__dirname, '../../assets');

const PNG_SET = [16, 24, 32, 48, 64, 96, 128, 256, 512, 1024];
/**
 * What Windows asks a window, the taskbar and the notification area for at
 * 100% to 300% (16 to 96), Explorer's 128 and the 256 of large icon views.
 * Every one drawn, so none is resampled by the shell.
 */
const ICO_SET = [16, 20, 24, 28, 32, 40, 48, 56, 64, 80, 96, 128, 256];
/** At and above this an .ico frame is PNG; below, a DIB System.Drawing reads. */
const ICO_PNG_FROM = 256;
/** The macOS entries the file has always carried, PNG in each. */
const ICNS_SET: readonly [string, number][] = [
  ['icp4', 16],
  ['icp5', 32],
  ['ic11', 32],
  ['ic12', 64],
  ['ic07', 128],
  ['ic13', 256],
  ['ic08', 256],
  ['ic14', 512],
  ['ic09', 512],
  ['ic10', 1024],
];

interface IRender {
  png: Buffer;
  /** Straight RGBA, top row first. */
  rgba: Buffer;
}

const svgAt = (frame: IAppIconFrame, size: number) =>
  appIconSvg(frame).replace(
    / width="512" height="512"/,
    ` width="${size}" height="${size}"`,
  );

/** Paint each size from its frame's SVG at that size, in one browser. */
const renderAll = async (sizes: number[]) => {
  const jobs = sizes.map((size) => ({
    size,
    url: `data:image/svg+xml;base64,${Buffer.from(
      svgAt(appIconFrameFor(size), size),
    ).toString('base64')}`,
  }));
  const expression = `(async (jobs) => {
    const out = {};
    for (const { size, url } of jobs) {
      const image = new Image();
      image.src = url;
      await image.decode();
      const canvas = document.createElement('canvas');
      canvas.width = size;
      canvas.height = size;
      const context = canvas.getContext('2d', { willReadFrequently: true });
      context.drawImage(image, 0, 0, size, size);
      const { data } = context.getImageData(0, 0, size, size);
      let binary = '';
      for (let at = 0; at < data.length; at += 0x8000) {
        binary += String.fromCharCode(...data.subarray(at, at + 0x8000));
      }
      out[size] = {
        png: canvas.toDataURL('image/png').split(',')[1],
        rgba: btoa(binary),
      };
    }
    return out;
  })(${JSON.stringify(jobs)})`;
  const painted =
    await evaluateInChrome<Record<string, { png: string; rgba: string }>>(
      expression,
    );
  const renders = new Map<number, IRender>();
  sizes.forEach((size) => {
    const one = painted[size];
    if (!one) {
      throw new Error(`The ${size}px icon was not painted.`);
    }
    const rgba = Buffer.from(one.rgba, 'base64');
    if (rgba.length !== size * size * 4) {
      throw new Error(`The ${size}px icon has ${rgba.length} bytes of pixels.`);
    }
    renders.set(size, { png: Buffer.from(one.png, 'base64'), rgba });
  });
  return renders;
};

/**
 * A 32-bit DIB frame: rows bottom-up in BGRA, the transparency in the alpha
 * channel and an all-clear AND mask after it (biHeight counts both).
 */
const dibFrame = (size: number, rgba: Buffer) => {
  const maskRow = Math.ceil(size / 32) * 4;
  const frame = Buffer.alloc(40 + size * size * 4 + maskRow * size);
  frame.writeUInt32LE(40, 0);
  frame.writeInt32LE(size, 4);
  frame.writeInt32LE(size * 2, 8);
  frame.writeUInt16LE(1, 12);
  frame.writeUInt16LE(32, 14);
  for (let row = 0; row < size; row += 1) {
    for (let column = 0; column < size; column += 1) {
      const source = (row * size + column) * 4;
      const target = 40 + ((size - 1 - row) * size + column) * 4;
      frame[target] = rgba[source + 2];
      frame[target + 1] = rgba[source + 1];
      frame[target + 2] = rgba[source];
      frame[target + 3] = rgba[source + 3];
    }
  }
  return frame;
};

const packIco = (renders: Map<number, IRender>) => {
  const frames = ICO_SET.map((size) => {
    const render = renders.get(size);
    if (!render) {
      throw new Error(`No ${size}px render for the .ico.`);
    }
    return size >= ICO_PNG_FROM ? render.png : dibFrame(size, render.rgba);
  });
  const header = Buffer.alloc(6 + 16 * frames.length);
  header.writeUInt16LE(1, 2);
  header.writeUInt16LE(frames.length, 4);
  let offset = header.length;
  ICO_SET.forEach((size, index) => {
    const entry = 6 + index * 16;
    // A width or height byte of 0 means 256.
    header.writeUInt8(size >= 256 ? 0 : size, entry);
    header.writeUInt8(size >= 256 ? 0 : size, entry + 1);
    header.writeUInt16LE(1, entry + 4);
    header.writeUInt16LE(32, entry + 6);
    header.writeUInt32LE(frames[index].length, entry + 8);
    header.writeUInt32LE(offset, entry + 12);
    offset += frames[index].length;
  });
  return Buffer.concat([header, ...frames]);
};

const packIcns = (renders: Map<number, IRender>) => {
  const entries = ICNS_SET.map(([type, size]) => {
    const render = renders.get(size);
    if (!render) {
      throw new Error(`No ${size}px render for the .icns.`);
    }
    const head = Buffer.alloc(8);
    head.write(type, 0, 'ascii');
    head.writeUInt32BE(render.png.length + 8, 4);
    return Buffer.concat([head, render.png]);
  });
  const body = Buffer.concat(entries);
  const head = Buffer.alloc(8);
  head.write('icns', 0, 'ascii');
  head.writeUInt32BE(body.length + 8, 4);
  return Buffer.concat([head, body]);
};

/**
 * Temp then rename: `pnpm dev` loads icon.ico for the window and the tray,
 * and a file caught half written reads as no icon at all.
 */
const writeAtomically = (file: string, bytes: Buffer | string) => {
  const temporary = `${file}.tmp`;
  fs.writeFileSync(temporary, bytes);
  fs.renameSync(temporary, file);
};

const main = async () => {
  const [small, mid, large] = APP_ICON_FRAMES;
  writeAtomically(path.join(assets, 'icon.svg'), appIconSvg(large));
  writeAtomically(path.join(assets, 'icon-mid.svg'), appIconSvg(mid));
  writeAtomically(path.join(assets, 'icon-small.svg'), appIconSvg(small));

  const sizes = [
    ...new Set([...PNG_SET, ...ICO_SET, ...ICNS_SET.map(([, size]) => size)]),
  ].sort((left, right) => left - right);
  const renders = await renderAll(sizes);

  PNG_SET.forEach((size) => {
    const render = renders.get(size);
    if (render) {
      writeAtomically(
        path.join(assets, 'icons', `${size}x${size}.png`),
        render.png,
      );
    }
  });
  const iconPng = renders.get(512);
  if (!iconPng) {
    throw new Error('No 512px render for icon.png.');
  }
  writeAtomically(path.join(assets, 'icon.png'), iconPng.png);
  writeAtomically(path.join(assets, 'icon.ico'), packIco(renders));
  writeAtomically(path.join(assets, 'icon.icns'), packIcns(renders));
  process.stdout.write(
    `Wrote the app icon at ${sizes.join(', ')}px into ${path.relative(process.cwd(), assets) || '.'}\n`,
  );
};

main().catch((error: unknown) => {
  console.error('make-app-icons failed:', error);
  process.exitCode = 1;
});
