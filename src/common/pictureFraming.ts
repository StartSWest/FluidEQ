/**
 * How a photo sits in the place a scene keeps for it: the one piece of
 * geometry the Studio's framing editor draws, the scene's image is composed
 * with, and the main process checks what the page sends against — shared, so
 * what the editor shows is exactly what gets saved.
 *
 * `fit` says what the zoom starts from: `cover` fills the place and crops
 * what spills over, `contain` shows the whole photo with clear margins.
 * `zoom` goes in from there. `focus` is the point of the photo, as fractions
 * of its width and height from its top-left, that sits at the centre of the
 * place — a pet's face, a horizon — and stays there as the zoom changes.
 * Wherever the photo is larger than the place along an axis it is never let
 * leave an edge uncovered, and wherever it is smaller it stays whole inside.
 */

export type TPictureFit = 'cover' | 'contain';

export interface IPictureFraming {
  fit: TPictureFit;
  zoom: number;
  focus: readonly [number, number];
}

export interface ISize {
  width: number;
  height: number;
}

/** Where the photo is drawn inside the place, in the place's own pixels. */
export interface IPlacement {
  x: number;
  y: number;
  width: number;
  height: number;
}

export const MIN_PICTURE_ZOOM = 1;
/** Four times in is a face out of a group photo; past it the pixels show. */
export const MAX_PICTURE_ZOOM = 4;

export const DEFAULT_FRAMING: IPictureFraming = {
  fit: 'cover',
  zoom: 1,
  focus: [0.5, 0.5],
};

const clamp = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, value));

const isFraction = (value: unknown): value is number =>
  typeof value === 'number' &&
  Number.isFinite(value) &&
  value >= 0 &&
  value <= 1;

/**
 * A framing from anything — `pack.json`, a saved file, the page — with every
 * part that is missing or not a framing taken from `fallback`.
 */
export const readFraming = (
  raw: unknown,
  fallback: IPictureFraming = DEFAULT_FRAMING,
): IPictureFraming => {
  if (typeof raw !== 'object' || raw === null) {
    return fallback;
  }
  const value = raw as Record<string, unknown>;
  const fit =
    value.fit === 'cover' || value.fit === 'contain' ? value.fit : fallback.fit;
  const zoom =
    typeof value.zoom === 'number' && Number.isFinite(value.zoom)
      ? clamp(value.zoom, MIN_PICTURE_ZOOM, MAX_PICTURE_ZOOM)
      : fallback.zoom;
  const focus =
    Array.isArray(value.focus) &&
    value.focus.length === 2 &&
    isFraction(value.focus[0]) &&
    isFraction(value.focus[1])
      ? ([value.focus[0], value.focus[1]] as const)
      : fallback.focus;
  return { fit, zoom, focus };
};

/** One axis: where the photo starts, kept covering or kept whole. */
const placeAxis = (
  placeLength: number,
  drawnLength: number,
  focus: number,
): number => {
  const start = placeLength / 2 - focus * drawnLength;
  return drawnLength >= placeLength
    ? clamp(start, placeLength - drawnLength, 0)
    : clamp(start, 0, placeLength - drawnLength);
};

export const placePicture = (
  photo: ISize,
  place: ISize,
  framing: IPictureFraming,
): IPlacement => {
  const fitScale =
    framing.fit === 'cover'
      ? Math.max(place.width / photo.width, place.height / photo.height)
      : Math.min(place.width / photo.width, place.height / photo.height);
  const scale =
    fitScale * clamp(framing.zoom, MIN_PICTURE_ZOOM, MAX_PICTURE_ZOOM);
  const width = photo.width * scale;
  const height = photo.height * scale;
  return {
    x: placeAxis(place.width, width, framing.focus[0]),
    y: placeAxis(place.height, height, framing.focus[1]),
    width,
    height,
  };
};

/**
 * The focus that puts the photo where it is actually drawn: after a drag or
 * a zoom pushed it against an edge, the stored focus is the one the picture
 * shows, so the next zoom grows from what the member sees.
 */
const focusOf = (place: ISize, drawn: IPlacement): [number, number] => [
  clamp((place.width / 2 - drawn.x) / drawn.width, 0, 1),
  clamp((place.height / 2 - drawn.y) / drawn.height, 0, 1),
];

/** The framing after dragging the photo by `dx`, `dy` of the place's pixels. */
export const dragFraming = (
  photo: ISize,
  place: ISize,
  framing: IPictureFraming,
  dx: number,
  dy: number,
): IPictureFraming => {
  const drawn = placePicture(photo, place, framing);
  const moved = placePicture(photo, place, {
    ...framing,
    focus: focusOf(place, { ...drawn, x: drawn.x + dx, y: drawn.y + dy }),
  });
  return { ...framing, focus: focusOf(place, moved) };
};

/** The framing at another zoom, the point at the centre staying put. */
export const zoomFraming = (
  photo: ISize,
  place: ISize,
  framing: IPictureFraming,
  zoom: number,
): IPictureFraming => {
  const next = {
    ...framing,
    zoom: clamp(zoom, MIN_PICTURE_ZOOM, MAX_PICTURE_ZOOM),
  };
  return {
    ...next,
    focus: focusOf(place, placePicture(photo, place, next)),
  };
};
