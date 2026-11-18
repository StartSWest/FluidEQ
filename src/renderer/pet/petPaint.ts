/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { EYE_WAVE_PERIOD, buildEyeWave } from '../PetArt';

/**
 * Painting the pet on a canvas: the drawing of `PetArt.tsx`, the same 40-unit
 * square, the same shapes and inks, with every layer's motion as
 * `SupportPet.scss` composes it - the individual `translate`, `rotate` and
 * `scale` first, then the `transform`, each about its own pivot.
 */

const UNITS = 40;
const EYE_Y = 22;
const PUPIL_RADIUS = 3.4;
const LEFT_PUPIL_X = 15.4;
const RIGHT_PUPIL_X = 24.6;
const INK = '#06131d';
const STAR = '#ffe66d';
const EARS: readonly (readonly [number, number])[][] = [
  [
    [11, 12],
    [14, 6],
    [17, 12],
  ],
  [
    [23, 12],
    [26, 8],
    [29, 12],
  ],
];
const STAR_OUTLINE =
  'M31.5 8.2 L32.7 11 L35.6 11.3 L33.4 13.2 L34.1 16 L31.5 14.5 L28.9 16 L29.6 13.2 L27.4 11.3 L30.3 11 Z';

interface IPetShapes {
  star: Path2D;
  waves: readonly (readonly [number, Path2D])[];
}

// Built at the first paint, never when the module loads: the titlebar, the
// share card and the rhythm game import the pet, and a `Path2D` made at
// import put a canvas API in front of every one of them - the whole App
// failed to load wherever there is none (jsdom's tests had none).
let shapes: IPetShapes | undefined;
const petShapes = (): IPetShapes => {
  shapes ??= {
    star: new Path2D(STAR_OUTLINE),
    waves: [LEFT_PUPIL_X, RIGHT_PUPIL_X].map(
      (centreX) => [centreX, new Path2D(buildEyeWave(centreX, EYE_Y))] as const,
    ),
  };
  return shapes;
};

/** Everything one frame of her needs, already sampled and eased. */
export interface IPetFrame {
  /** The square's side in CSS px, and the canvas's room around it. */
  size: number;
  pad: number;
  /** The creature's sway: shift in px and lean in degrees. */
  swayX: number;
  swayDeg: number;
  /** The ears' turn in degrees, and their rise as a share of the square. */
  earDeg: number;
  earBob: number;
  /** The ears' stretch with the music: 1 at rest. */
  earStretch: number;
  /** The body's scale and rise as a share of the square. */
  bodyScaleX: number;
  bodyScaleY: number;
  bodyBob: number;
  /** How far a press has squashed her, 0 to 1. */
  press: number;
  /** The eyes: the blink's height, the streak's squint. */
  blink: number;
  squint: number;
  /** The streak, 0 to 1: the grin and the waves in the eyes. */
  joy: number;
  /** The wave's travel across the pupil, 0 to 1 of a period. */
  waveTravel: number;
  waveInk: string;
  /** The star: how shown, its twinkle, and its rise as a share. */
  star: number;
  starOpacity: number;
  starScale: number;
  starDeg: number;
  starBob: number;
  /** Her one flat colour (`--pet-tone`). */
  tone: string;
}

const radians = (degrees: number) => (degrees * Math.PI) / 180;

/** `transform-origin`: run `apply` about the point (`x`, `y`). */
const about = (
  context: CanvasRenderingContext2D,
  x: number,
  y: number,
  apply: () => void,
) => {
  context.translate(x, y);
  apply();
  context.translate(-x, -y);
};

/**
 * The stroke of a path whose width does not scale with the drawing - SVG's
 * `vector-effect: non-scaling-stroke` - with a vertical gradient over the
 * path's own box, as the drawing's `objectBoundingBox` gradient is.
 */
const strokeUnscaled = (
  context: CanvasRenderingContext2D,
  build: () => void,
  widthPx: number,
  ratio: number,
  ink: string,
) => {
  context.beginPath();
  build();
  context.save();
  context.setTransform(ratio, 0, 0, ratio, 0, 0);
  context.strokeStyle = ink;
  context.lineWidth = widthPx;
  context.lineCap = 'round';
  context.lineJoin = 'round';
  context.stroke();
  context.restore();
};

/** A gradient between two points of the drawing, placed in CSS px. */
const paintEars = (
  context: CanvasRenderingContext2D,
  frame: IPetFrame,
  ratio: number,
) => {
  const { size, press } = frame;
  const unit = size / UNITS;
  context.save();
  about(context, size * 0.5, size * 0.3, () => {
    context.translate(0, frame.earBob * size);
    context.rotate(radians(frame.earDeg));
  });
  context.scale(unit, unit);
  // The group's stretch, then the press's transform, about the foot of the
  // ears' box (20, 12).
  about(context, 20, 12, () => {
    context.scale(1, frame.earStretch);
    context.translate(0, (3.4 * press) / unit);
    context.scale(1, 1 - 0.06 * press);
  });
  EARS.forEach((points) => {
    strokeUnscaled(
      context,
      () => {
        points.forEach(([x, y], index) =>
          index === 0 ? context.moveTo(x, y) : context.lineTo(x, y),
        );
      },
      3,
      ratio,
      frame.tone,
    );
  });
  context.restore();
};

const paintEyes = (context: CanvasRenderingContext2D, frame: IPetFrame) => {
  const { size, squint } = frame;
  const unit = size / UNITS;
  context.save();
  about(context, size * 0.5, size * 0.55, () => context.scale(1, frame.blink));
  context.scale(unit, unit);
  const squinted = (paint: () => void) => {
    context.save();
    about(context, 20, EYE_Y, () => context.scale(1, squint));
    paint();
    context.restore();
  };
  squinted(() => {
    context.fillStyle = INK;
    [LEFT_PUPIL_X, RIGHT_PUPIL_X].forEach((x) => {
      context.beginPath();
      context.arc(x, EYE_Y, PUPIL_RADIUS, 0, Math.PI * 2);
      context.fill();
    });
  });
  if (frame.joy > 0) {
    petShapes().waves.forEach(([centreX, wave]) => {
      context.save();
      context.beginPath();
      context.ellipse(
        centreX,
        EYE_Y,
        PUPIL_RADIUS,
        PUPIL_RADIUS * squint,
        0,
        0,
        Math.PI * 2,
      );
      context.clip();
      squinted(() => {
        context.translate(-frame.waveTravel * EYE_WAVE_PERIOD, 0);
        context.globalAlpha = frame.joy * 0.95;
        context.strokeStyle = frame.waveInk;
        context.lineWidth = 0.35 + frame.joy * 0.55;
        context.lineCap = 'round';
        context.stroke(wave);
      });
      context.restore();
    });
  }
  squinted(() => {
    context.fillStyle = '#ffffff';
    [16.4, 25.6].forEach((x) => {
      context.beginPath();
      context.arc(x, 21, 1.15, 0, Math.PI * 2);
      context.fill();
    });
  });
  context.restore();
};

const paintBody = (
  context: CanvasRenderingContext2D,
  frame: IPetFrame,
  ratio: number,
) => {
  const { size, press, joy } = frame;
  const unit = size / UNITS;
  context.save();
  about(context, size * 0.5, size * 0.9125, () => {
    context.translate(0, frame.bodyBob * size);
    context.scale(frame.bodyScaleX, frame.bodyScaleY);
    context.translate(0, 0.0375 * size * press);
    context.scale(1, 1 - 0.08 * press);
  });
  context.save();
  context.scale(unit, unit);
  context.fillStyle = frame.tone;
  context.beginPath();
  context.arc(20, 24, 12.5, 0, Math.PI * 2);
  context.fill();
  about(context, 20, 28.4, () => context.scale(1 + joy * 0.25, 1 + joy * 1.7));
  strokeUnscaled(
    context,
    () => {
      context.moveTo(16.6, 28.4);
      context.quadraticCurveTo(20, 31.4, 23.4, 28.4);
    },
    1.8,
    ratio,
    INK,
  );
  context.restore();
  paintEyes(context, frame);
  context.restore();
};

const paintStar = (context: CanvasRenderingContext2D, frame: IPetFrame) => {
  if (frame.star <= 0.001) {
    return;
  }
  const { size } = frame;
  const unit = size / UNITS;
  context.save();
  context.globalAlpha = frame.star * frame.starOpacity;
  context.translate(0, (frame.starBob + 0.085 * frame.press) * size);
  about(context, size * 0.7875, size * 0.3025, () => {
    context.scale(frame.starScale, frame.starScale);
    context.rotate(radians(frame.starDeg));
  });
  context.scale(unit, unit);
  context.fillStyle = STAR;
  context.fill(petShapes().star);
  context.restore();
};

/**
 * The creature onto `context`, whose canvas is the square with `pad` of room
 * on every side, at `ratio` device pixels to the CSS pixel.
 */
export const paintPet = (
  context: CanvasRenderingContext2D,
  frame: IPetFrame,
  ratio: number,
) => {
  const { size, pad } = frame;
  context.setTransform(ratio, 0, 0, ratio, 0, 0);
  context.clearRect(0, 0, size + pad * 2, size + pad * 2);
  context.translate(pad, pad);
  about(context, size * 0.5, size * 0.88, () => {
    context.translate(frame.swayX, 0);
    context.rotate(radians(frame.swayDeg));
  });
  paintEars(context, frame, ratio);
  paintBody(context, frame, ratio);
  paintStar(context, frame);
  context.setTransform(1, 0, 0, 1, 0, 0);
};
