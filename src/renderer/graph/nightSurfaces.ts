/**
 * The night's big soft layer, painted once and blitted.
 *
 * A moon halo the size of a fifth of the plot is a large translucent
 * raster; filled fresh every frame at 2560×1440, it and the mist of a
 * scene since removed held that scene at thirty milliseconds a frame while
 * the profile showed the script idle. It does not change shape between
 * frames — only the alpha it is drawn at — so it is rendered to its own
 * offscreen canvas when its size changes and drawn as an image after that,
 * which costs a copy instead of a fill.
 */

import { keepCanvasPicture, takeCanvasEmptied } from '../utils/canvasLoss';
import { isLightWindow } from '../utils/windowSide';

interface ISurface {
  canvas: HTMLCanvasElement;
  key: string;
}

export interface NightSurfaces {
  halo?: ISurface;
}

export const createNightSurfaces = (): NightSurfaces => ({});

const surfaceFor = (
  current: ISurface | undefined,
  key: string,
  width: number,
  height: number,
  paint: (context: CanvasRenderingContext2D) => void,
): ISurface | undefined => {
  // Drawn again when a loss of the GPU emptied it (`canvasLoss.ts`).
  if (current && current.key === key && !takeCanvasEmptied(current.canvas)) {
    return current;
  }
  const canvas =
    current?.canvas ?? keepCanvasPicture(document.createElement('canvas'));
  canvas.width = Math.max(1, Math.ceil(width));
  canvas.height = Math.max(1, Math.ceil(height));
  const context = canvas.getContext('2d');
  if (!context) {
    return undefined;
  }
  context.clearRect(0, 0, canvas.width, canvas.height);
  paint(context);
  return { canvas, key };
};

/** How far the halo reaches, in moon radii. */
export const HALO_REACH = 4.5;
/** Where the halo's light starts falling off, in moon radii. */
export const HALO_INNER = 0.8;
/** The halo's light from there to its reach. */
export const HALO_STOPS = [
  { at: 0, colour: 'rgba(236,232,210,0.55)' },
  { at: 0.35, colour: 'rgba(200,205,235,0.16)' },
  { at: 1, colour: 'rgba(160,170,220,0)' },
];

/**
 * The same sky by day, on a light window: the moon's pale light vanished
 * against white (1.2:1, 2026-11-19 scan), so the disc becomes a warm sun
 * (`DAY_SUN`) and its halo the sun's warmth, falling off the same way.
 */
export const DAY_HALO_STOPS = [
  { at: 0, colour: 'rgba(233,138,44,0.32)' },
  { at: 0.35, colour: 'rgba(240,170,80,0.12)' },
  { at: 1, colour: 'rgba(245,190,110,0)' },
];

/** The sun that stands where the moon does on a light window. */
export const DAY_SUN = '#e98a2c';

/** The halo's stops for the window's side. */
export const haloStops = () => (isLightWindow() ? DAY_HALO_STOPS : HALO_STOPS);

/** The moon's halo, centred on the moon, in the caller's scene space. */
export const paintMoonHalo = (
  context: CanvasRenderingContext2D,
  surfaces: NightSurfaces,
  x: number,
  y: number,
  radius: number,
  ratio: number,
) => {
  const reach = radius * HALO_REACH;
  const side = reach * 2;
  const stops = haloStops();
  const key = `${radius.toFixed(1)}:${ratio}:${stops === DAY_HALO_STOPS ? 'day' : 'night'}`;
  surfaces.halo = surfaceFor(
    surfaces.halo,
    key,
    side * ratio,
    side * ratio,
    (target) => {
      target.scale(ratio, ratio);
      const halo = target.createRadialGradient(
        reach,
        reach,
        radius * HALO_INNER,
        reach,
        reach,
        reach,
      );
      stops.forEach(({ at, colour }) => halo.addColorStop(at, colour));
      target.fillStyle = halo;
      target.beginPath();
      target.arc(reach, reach, reach, 0, Math.PI * 2);
      target.fill();
    },
  );
  if (surfaces.halo) {
    context.drawImage(surfaces.halo.canvas, x - reach, y - reach, side, side);
  }
};
