/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
} from 'react';
import type {
  IAmbientElement,
  IAmbientParam,
  TAmbientField,
} from 'common/sceneAmbient';
import type { TAmbientPictures } from '../ambient/ambientPictures';
import { ambientSprite } from '../ambient/ambientSprites';

/** The tile's side, in CSS pixels. */
const TILE = 28;

/** Where each shape stands in the tile, and how large: x, y, size. */
type TPlace = readonly [number, number, number];

/**
 * One element as a few of it, three sizes apart, the way the window shows a
 * flock or a fall; several as one of each, the largest first.
 */
const LAYOUTS: Record<number, readonly TPlace[]> = {
  1: [
    [15.5, 12, 15],
    [7, 20.5, 9],
    [22, 22, 6],
  ],
  2: [
    [10.5, 11, 14],
    [19, 18.5, 11],
  ],
  3: [
    [14, 9, 11],
    [8, 19.5, 10],
    [20.5, 19.5, 10],
  ],
};

/**
 * What the setting does to them, told by how they are drawn: a count shows
 * them as they are, how much they show fades them across the tile, and a
 * speed leaves each one a short smear behind it.
 */
type TAmbientDoes = 'count' | 'opacity' | 'speed';

/** A speed's trail: how far behind each copy stands, and how strong it is. */
const SMEAR: readonly (readonly [number, number])[] = [
  [9, 0.1],
  [6, 0.22],
  [3, 0.42],
];
const SMEAR_ROOM = 3;

const doesOf = (fields: readonly TAmbientField[]): TAmbientDoes => {
  if (fields.length > 0 && fields.every((field) => field === 'opacity')) {
    return 'opacity';
  }
  if (fields.length > 0 && fields.every((field) => field === 'speed')) {
    return 'speed';
  }
  return 'count';
};

const readRatio = () => Math.min(2, Math.max(1, window.devicePixelRatio || 1));

/** One shape of `element` at `x`, `y`, in its `colour`, `size` across. */
const drawOne = (
  context: CanvasRenderingContext2D,
  element: IAmbientElement,
  pictures: TAmbientPictures,
  [x, y, size]: TPlace,
  colour: string,
  ratio: number,
) => {
  if (element.shape === 'picture') {
    const pose = pictures.get(element.id)?.[element.rest ?? 0];
    const frame = element.frames?.[element.rest ?? 0];
    if (!pose || !frame) {
      return;
    }
    // The element's size is the pose's longer side, as the window draws it.
    const longer = Math.max(frame[2], frame[3]);
    const across = (size * frame[2]) / longer;
    const down = (size * frame[3]) / longer;
    context.drawImage(pose, x - across / 2, y - down / 2, across, down);
    return;
  }
  const sprite = ambientSprite({
    shape: element.shape,
    path: element.path,
    colour,
    size,
    ratio,
  });
  if (sprite) {
    const { image, extent } = sprite;
    context.drawImage(image, x - extent / 2, y - extent / 2, extent, extent);
  }
};

interface IStudioAmbientIconProps {
  /** The setting: which elements it moves, and what it does to them. */
  param: IAmbientParam;
  /** Every element the scene puts in the window. */
  elements: readonly IAmbientElement[];
  /** The poses of its pictures, once cut (`useAmbientPictures`). */
  pictures: TAmbientPictures;
  /** The scene's darkest colour, the night the elements are drawn on. */
  sky?: string;
}

/**
 * What an element-in-the-window setting moves, beside its name (Ivan,
 * 2026-09-28: "show on each slider the element icon so they know what it is
 * about"): the scene's own elements — the snow, the gulls, the petals — made
 * by the same sprites and cut from the same poses the window layer draws, on
 * a little square of the scene's own night, so a white flake shows on a light
 * window as it would over the scene. "Things in the window" and "How much
 * they show" move every element and carry them all; a slider for one element
 * carries a few of that one.
 */
export default function StudioAmbientIcon({
  param,
  elements,
  pictures,
  sky,
}: IStudioAmbientIconProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [ratio, setRatio] = useState(readRatio);
  // A window moved to a screen of another density redraws at its pixels.
  useEffect(() => {
    const query = window.matchMedia(`(resolution: ${ratio}dppx)`);
    const change = () => setRatio(readRatio());
    query.addEventListener('change', change);
    return () => query.removeEventListener('change', change);
  }, [ratio]);

  const moved = useMemo(() => {
    const ids = [...new Set(param.targets.map((target) => target.element))];
    return {
      elements: ids
        .map((id) => elements.find((element) => element.id === id))
        .filter((element): element is IAmbientElement => element !== undefined)
        .slice(0, 3),
      does: doesOf(param.targets.map((target) => target.field)),
    };
  }, [param, elements]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const context = canvas?.getContext('2d');
    if (!canvas || !context) {
      return;
    }
    const pixels = Math.round(TILE * ratio);
    canvas.width = pixels;
    canvas.height = pixels;
    context.setTransform(ratio, 0, 0, ratio, 0, 0);
    context.clearRect(0, 0, TILE, TILE);
    const count = moved.elements.length;
    if (count === 0) {
      return;
    }
    const layout = LAYOUTS[count] ?? LAYOUTS[1];
    // A speed's shapes stand a little right, leaving their smear the room.
    const ahead = moved.does === 'speed' ? SMEAR_ROOM : 0;
    layout.forEach(([x, y, size], index) => {
      const element = moved.elements[count === 1 ? 0 : index];
      const colour =
        element.colours[index % Math.max(1, element.colours.length)] ??
        '#ffffff';
      if (moved.does === 'speed') {
        // The smear first, farthest and faintest first, so the shape itself
        // stands over it.
        SMEAR.forEach(([behind, alpha]) => {
          context.globalAlpha = alpha;
          drawOne(
            context,
            element,
            pictures,
            [x + ahead - behind, y, size],
            colour,
            ratio,
          );
        });
        context.globalAlpha = 1;
      }
      drawOne(context, element, pictures, [x + ahead, y, size], colour, ratio);
    });
    if (moved.does === 'opacity') {
      // Full on the left, a quarter on the right: how much they show.
      const fade = context.createLinearGradient(0, 0, TILE, 0);
      fade.addColorStop(0.2, 'rgba(0, 0, 0, 1)');
      fade.addColorStop(1, 'rgba(0, 0, 0, 0.22)');
      context.globalCompositeOperation = 'destination-in';
      context.fillStyle = fade;
      context.fillRect(0, 0, TILE, TILE);
      context.globalCompositeOperation = 'source-over';
    }
  }, [moved, pictures, ratio]);

  return (
    <span
      className="studio-ambient-icon"
      style={sky ? ({ '--sky': sky } as CSSProperties) : undefined}
      aria-hidden
    >
      <canvas ref={canvasRef} className="studio-ambient-icon__canvas" />
    </span>
  );
}
