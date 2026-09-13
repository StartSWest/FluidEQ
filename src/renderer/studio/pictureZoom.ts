/**
 * The picture viewer's zoom, as arithmetic: where a picture sits and how big
 * it is drawn, in the CSS pixels of the space it is shown in. No DOM here.
 */

export interface ISize {
  width: number;
  height: number;
}

export interface IPoint {
  x: number;
  y: number;
}

/**
 * A zoomed picture: `scale` CSS pixels to each of its own, and its middle
 * `x`, `y` away from the middle of the space it is shown in.
 */
export interface IZoomView extends IPoint {
  scale: number;
}

export interface IZoomSpace {
  /** The picture's own size, upright. */
  size: ISize;
  /** The space it is shown in. */
  box: ISize;
  /** The scale it is fitted at (see `fitScale`). */
  fit: number;
}

/**
 * The steps − and + walk, doubling: from a picture shown whole to sixteen
 * screen pixels to each of its own, where a sprite a few hundred pixels
 * across can be read pixel by pixel. The fitted scale is a step too.
 */
export const ZOOM_STOPS = [0.1, 0.25, 0.5, 1, 2, 4, 8, 16];

export const MOST_ZOOM = 16;

/** Scales this close together are the same step. */
const SAME = 0.01;

/**
 * From this scale up a zoomed picture is drawn in hard square pixels. Below
 * it pixels are smoothed: nearest-neighbour between one and two screen
 * pixels to each draws some rows one pixel thick and some two, which reads
 * as a fault in the picture rather than as its pixels.
 */
export const CRISP_FROM = 2;

/** The scale that shows `size` whole in `box`, never past `most`. */
export const fitScale = (size: ISize, box: ISize, most: number) =>
  Math.min(box.width / size.width, box.height / size.height, most);

/**
 * The least a picture zooms out to: whole, or its own size when that is
 * smaller than whole — a small picture shown enlarged can still be seen at
 * its real size.
 */
export const leastScale = (fit: number) => Math.min(fit, 1);

/**
 * Keeps a picture from leaving its space: along an axis it overflows it pans
 * only until its edge meets the space's edge, and along an axis it fits it
 * stays in the middle.
 */
export const clampView = (view: IZoomView, { size, box }: IZoomSpace) => {
  const spareX = Math.max(0, (size.width * view.scale - box.width) / 2);
  const spareY = Math.max(0, (size.height * view.scale - box.height) / 2);
  return {
    scale: view.scale,
    x: Math.min(spareX, Math.max(-spareX, view.x)),
    y: Math.min(spareY, Math.max(-spareY, view.y)),
  };
};

/**
 * `from` zoomed to `scale` about `point` (from the middle of the space): the
 * part of the picture under the point stays under it. Undefined when that
 * is simply the picture fitted, so the fitted view follows the space when
 * the window is resized.
 */
export const zoomView = (
  from: IZoomView | undefined,
  scale: number,
  point: IPoint,
  space: IZoomSpace,
): IZoomView | undefined => {
  const { fit } = space;
  const target = Math.min(MOST_ZOOM, Math.max(leastScale(fit), scale));
  if (Math.abs(target - fit) <= fit * 0.001) {
    return undefined;
  }
  const start = from ? clampView(from, space) : { scale: fit, x: 0, y: 0 };
  const ratio = target / start.scale;
  return clampView(
    {
      scale: target,
      x: point.x - (point.x - start.x) * ratio,
      y: point.y - (point.y - start.y) * ratio,
    },
    space,
  );
};

/** `from` moved by `dx`, `dy`, as far as `clampView` lets it go. */
export const panView = (
  from: IZoomView,
  dx: number,
  dy: number,
  space: IZoomSpace,
) => clampView({ ...from, x: from.x + dx, y: from.y + dy }, space);

/** The next step from `scale` in `direction`, the fitted scale among them. */
export const nextStop = (scale: number, fit: number, direction: 1 | -1) => {
  const least = leastScale(fit);
  const stops = [...ZOOM_STOPS, fit]
    .filter(
      (stop) => stop >= least * (1 - SAME) && stop <= MOST_ZOOM * (1 + SAME),
    )
    .sort((a, b) => a - b);
  if (direction > 0) {
    return stops.find((stop) => stop > scale * (1 + SAME)) ?? MOST_ZOOM;
  }
  return stops.reverse().find((stop) => stop < scale * (1 - SAME)) ?? least;
};

/** Whether zooming further in `direction` would change anything. */
export const canZoom = (scale: number, fit: number, direction: 1 | -1) =>
  direction > 0
    ? scale < MOST_ZOOM * (1 - SAME)
    : scale > leastScale(fit) * (1 + SAME);

/**
 * Where the picture is drawn in its space: its size, and its top-left corner
 * on whole pixels, so hard pixels land on the screen's own.
 */
export const placement = (scale: number, point: IPoint, space: IZoomSpace) => {
  const width = space.size.width * scale;
  const height = space.size.height * scale;
  return {
    width,
    height,
    left: Math.round(space.box.width / 2 - width / 2 + point.x),
    top: Math.round(space.box.height / 2 - height / 2 + point.y),
  };
};
