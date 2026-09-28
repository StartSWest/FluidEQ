/**
 * The night's big soft layers, painted once and blitted.
 *
 * A moon halo the size of a fifth of the plot and two mist bands the width
 * of the plot are each a large translucent raster; filled fresh every
 * frame at 2560×1440 they held the terrace at thirty milliseconds a frame
 * while the profile showed the script idle. Neither changes shape between
 * frames — only the alpha they are drawn at — so each is rendered to its
 * own offscreen canvas when its size changes and drawn as an image after
 * that, which costs a copy instead of a fill.
 */

interface ISurface {
  canvas: HTMLCanvasElement;
  key: string;
}

export interface NightSurfaces {
  halo?: ISurface;
  mist?: ISurface;
}

export const createNightSurfaces = (): NightSurfaces => ({});

const surfaceFor = (
  current: ISurface | undefined,
  key: string,
  width: number,
  height: number,
  paint: (context: CanvasRenderingContext2D) => void,
): ISurface | undefined => {
  if (current && current.key === key) {
    return current;
  }
  const canvas = current?.canvas ?? document.createElement('canvas');
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
  const key = `${radius.toFixed(1)}:${ratio}`;
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
      HALO_STOPS.forEach(({ at, colour }) => halo.addColorStop(at, colour));
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

/** The two mist bands' strip: this far above the base, this deep. */
export const MIST_TOP = 0.72;
export const MIST_DEPTH = 0.5;
/**
 * The bands: where each is thickest, as a height above the base, and how
 * thick against the lower one. Each rises from nothing `MIST_ABOVE` of the
 * depth above that and falls to nothing `MIST_BELOW` under it.
 */
export const MIST_BANDS = [
  { band: 0.62, weight: 1 },
  { band: 0.34, weight: 0.7 },
];
export const MIST_ABOVE = 0.08;
export const MIST_BELOW = 0.06;
/** The mist's colour, and how solid the thicker band is at its middle. */
export const MIST_INK = [159, 180, 232] as const;
export const MIST_PEAK = 0.16;

/** Two bands of mist between the tiers, the lower one denser. */
export const paintMist = (
  context: CanvasRenderingContext2D,
  surfaces: NightSurfaces,
  left: number,
  right: number,
  base: number,
  depth: number,
  ratio: number,
) => {
  const width = Math.max(1, right - left);
  const height = depth * MIST_DEPTH;
  const top = base - depth * MIST_TOP;
  const key = `${width.toFixed(1)}:${depth.toFixed(1)}:${ratio}`;
  surfaces.mist = surfaceFor(
    surfaces.mist,
    key,
    width * ratio,
    height * ratio,
    (target) => {
      target.scale(ratio, ratio);
      const ink = MIST_INK.join(',');
      MIST_BANDS.forEach(({ band, weight }) => {
        const y = depth * (MIST_TOP - band);
        const mist = target.createLinearGradient(
          0,
          y - depth * MIST_ABOVE,
          0,
          y + depth * MIST_BELOW,
        );
        mist.addColorStop(0, `rgba(${ink},0)`);
        mist.addColorStop(
          0.5,
          `rgba(${ink},${(MIST_PEAK * weight).toFixed(3)})`,
        );
        mist.addColorStop(1, `rgba(${ink},0)`);
        target.fillStyle = mist;
        target.fillRect(
          0,
          y - depth * MIST_ABOVE,
          width,
          depth * (MIST_ABOVE + MIST_BELOW),
        );
      });
    },
  );
  if (surfaces.mist) {
    context.drawImage(surfaces.mist.canvas, left, top, width, height);
  }
};
