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
        radius * 0.8,
        reach,
        reach,
        reach,
      );
      halo.addColorStop(0, 'rgba(236,232,210,0.55)');
      halo.addColorStop(0.35, 'rgba(200,205,235,0.16)');
      halo.addColorStop(1, 'rgba(160,170,220,0)');
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
      [
        [0.62, 1],
        [0.34, 0.7],
      ].forEach(([band, weight]) => {
        const y = depth * (MIST_TOP - band);
        const mist = target.createLinearGradient(
          0,
          y - depth * 0.08,
          0,
          y + depth * 0.06,
        );
        mist.addColorStop(0, 'rgba(159,180,232,0)');
        mist.addColorStop(
          0.5,
          `rgba(159,180,232,${(0.16 * weight).toFixed(3)})`,
        );
        mist.addColorStop(1, 'rgba(159,180,232,0)');
        target.fillStyle = mist;
        target.fillRect(0, y - depth * 0.08, width, depth * 0.14);
      });
    },
  );
  if (surfaces.mist) {
    context.drawImage(surfaces.mist.canvas, left, top, width, height);
  }
};
