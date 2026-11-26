/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import type { IPetPose } from './petPose';

/** Her face, her colours and her star (`furPaint.ts` draws the rest). */

export type TRgb = readonly [number, number, number];

export const WHITE: TRgb = [255, 255, 255];
const INK: TRgb = [6, 19, 29];

export const mix = (a: TRgb, b: TRgb, t: number): TRgb => [
  a[0] + (b[0] - a[0]) * t,
  a[1] + (b[1] - a[1]) * t,
  a[2] + (b[2] - a[2]) * t,
];

export const rgba = (colour: TRgb, alpha = 1) =>
  `rgba(${Math.round(colour[0])},${Math.round(colour[1])},${Math.round(colour[2])},${alpha})`;

export interface IFurPalette {
  tone: TRgb;
  light: TRgb;
  dark: TRgb;
  belly: TRgb;
  inner: TRgb;
  nose: TRgb;
  band: TRgb;
  cupLight: TRgb;
  cupDark: TRgb;
  /** The speakers' rims and the waves in her eyes: the accent's light. */
  speaker: TRgb;
}

/**
 * Every colour of her from her one tone (`--pet-tone`, which follows a
 * scene's accent): the light and the shade are that tone toward white and
 * toward her ink, so a red accent gives a red creature lit the same way,
 * never a mint shade on a red body.
 */
export const furPalette = (tone: TRgb, speaker: TRgb): IFurPalette => ({
  tone,
  light: mix(tone, WHITE, 0.42),
  dark: mix(tone, INK, 0.62),
  belly: mix(tone, WHITE, 0.62),
  inner: mix([244, 165, 182], tone, 0.25),
  nose: [196, 92, 119],
  band: [34, 50, 59],
  cupLight: [74, 87, 97],
  cupDark: [20, 28, 34],
  speaker,
});

/** Everything one frame of her needs (`paintFurPet`). */
export interface IFurFrame {
  /** Her square's side, and the room around it, in CSS px. */
  art: number;
  pad: number;
  /** Device pixels to a CSS px. */
  ratio: number;
  palette: IFurPalette;
  pose: IPetPose;
  /** A loud chorus (`IPetPose.joy`): her squint, her grin, the waves in her eyes. */
  joy: number;
  /** The waves' travel across her pupils, 0..1 of a period. */
  waveTravel: number;
  /** The star, 0 hidden to 1 shown; its twinkle's scale and turn. */
  star: number;
  starScale: number;
  starTurn: number;
  /** How far a press has squashed her, 0..1. */
  press: number;
  /** The face a tap in the Support dialog earned. */
  mood: '' | 'perfect' | 'miss';
}

const paintEye = (
  context: CanvasRenderingContext2D,
  frame: IFurFrame,
  x: number,
  y: number,
  size: number,
  squint: number,
) => {
  const { pose, palette } = frame;
  context.save();
  context.translate(x, y);
  context.scale(1, squint);
  context.translate(-x, -y);
  const socket = context.createRadialGradient(
    x,
    y,
    size * 0.9,
    x,
    y,
    size * 1.35,
  );
  socket.addColorStop(0, rgba(palette.dark, 0.3));
  socket.addColorStop(1, rgba(palette.dark, 0));
  context.fillStyle = socket;
  context.beginPath();
  context.arc(x, y, size * 1.35, 0, Math.PI * 2);
  context.fill();
  const ball = context.createRadialGradient(
    x - size * 0.3,
    y - size * 0.35,
    size * 0.1,
    x,
    y,
    size,
  );
  ball.addColorStop(0, '#3b4757');
  ball.addColorStop(0.55, '#0b1118');
  ball.addColorStop(1, '#03060a');
  context.fillStyle = ball;
  context.beginPath();
  context.arc(x, y, size, 0, Math.PI * 2);
  context.fill();
  const ix = x + pose.gazeX * size * 0.24;
  const iy = y + pose.gazeY * size * 0.2;
  const iris = context.createRadialGradient(
    ix,
    iy,
    size * 0.3,
    ix,
    iy,
    size * 0.76,
  );
  iris.addColorStop(0, 'rgba(3,6,10,1)');
  iris.addColorStop(0.62, 'rgba(3,6,10,0.6)');
  iris.addColorStop(1, rgba(palette.dark, 0.85));
  context.fillStyle = iris;
  context.beginPath();
  context.arc(ix, iy, size * 0.76, 0, Math.PI * 2);
  context.fill();
  context.fillStyle = '#010204';
  context.beginPath();
  context.arc(ix, iy, size * 0.4 * pose.pupil, 0, Math.PI * 2);
  context.fill();
  if (frame.joy > 0.02) {
    // Sound reflected in her eye on a streak: a wave scrolling across the
    // pupil, clipped to it.
    context.save();
    context.beginPath();
    context.arc(ix, iy, size * 0.62, 0, Math.PI * 2);
    context.clip();
    context.strokeStyle = rgba(palette.speaker, 0.85 * frame.joy);
    context.lineWidth = Math.max(0.6 / frame.ratio, size * 0.1);
    context.beginPath();
    for (let k = -1.2; k <= 1.2001; k += 0.08) {
      const px = ix + k * size;
      const py =
        iy + Math.sin((k + frame.waveTravel) * Math.PI * 2 * 1.4) * size * 0.18;
      if (k === -1.2) {
        context.moveTo(px, py);
      } else {
        context.lineTo(px, py);
      }
    }
    context.stroke();
    context.restore();
  }
  context.fillStyle = 'rgba(255,255,255,0.92)';
  context.beginPath();
  context.ellipse(
    x - size * 0.32,
    y - size * 0.36,
    size * 0.27,
    size * 0.21,
    -0.5,
    0,
    Math.PI * 2,
  );
  context.fill();
  context.fillStyle = 'rgba(255,255,255,0.7)';
  context.beginPath();
  context.arc(x + size * 0.32, y + size * 0.3, size * 0.1, 0, Math.PI * 2);
  context.fill();
  context.strokeStyle = rgba(palette.light, 0.35);
  context.lineWidth = size * 0.1;
  context.beginPath();
  context.arc(x, y, size * 0.84, 0.25 * Math.PI, 0.75 * Math.PI);
  context.stroke();
  const close = Math.max(pose.blink, pose.lid);
  if (close > 0.02) {
    // Her lid, in her own fur, coming down over the eye; the lower edge
    // bulges only while it is part way down.
    context.save();
    context.beginPath();
    context.arc(x, y, size * 1.04, 0, Math.PI * 2);
    context.clip();
    const edge = y - size * 1.05 + size * 2.1 * close;
    const bulge = size * 0.8 * Math.min(close, 1 - close);
    const lid = context.createLinearGradient(0, y - size, 0, edge);
    lid.addColorStop(0, rgba(palette.light));
    lid.addColorStop(1, rgba(mix(palette.tone, palette.dark, 0.25)));
    context.fillStyle = lid;
    context.beginPath();
    context.moveTo(x - size * 1.2, y - size * 1.3);
    context.lineTo(x + size * 1.2, y - size * 1.3);
    context.lineTo(x + size * 1.2, edge);
    context.quadraticCurveTo(x, edge + bulge, x - size * 1.2, edge);
    context.closePath();
    context.fill();
    context.strokeStyle = rgba(INK, 0.6);
    context.lineWidth = Math.max(0.5 / frame.ratio, size * 0.13);
    context.beginPath();
    context.moveTo(x - size, edge + size * 0.02);
    context.quadraticCurveTo(
      x,
      edge + bulge + size * 0.02,
      x + size,
      edge + size * 0.02,
    );
    context.stroke();
    context.restore();
  }
  context.restore();
};

const paintMouth = (
  context: CanvasRenderingContext2D,
  frame: IFurFrame,
  faceX: number,
  faceY: number,
  radius: number,
  smile: number,
) => {
  const { pose, palette, ratio } = frame;
  const nx = faceX;
  const ny = faceY + radius * 0.16;
  if (pose.mouth > 0.03) {
    const height = radius * (0.03 + pose.mouth * 0.15);
    context.fillStyle = '#3a0e1b';
    context.beginPath();
    context.ellipse(
      nx,
      ny + radius * 0.07 + height * 0.5,
      radius * (0.085 + pose.mouth * 0.03),
      height * 0.6,
      0,
      0,
      Math.PI * 2,
    );
    context.fill();
    context.fillStyle = '#e07a92';
    context.beginPath();
    context.ellipse(
      nx,
      ny + radius * 0.07 + height * 0.85,
      radius * 0.06,
      height * 0.25,
      0,
      0,
      Math.PI * 2,
    );
    context.fill();
  }
  // Her smile; a missed tap turns it down at the corners.
  const corners = ny + radius * (0.05 + Math.max(0, -smile) * 0.06);
  const curve = radius * (0.03 + smile * 0.05);
  context.strokeStyle = rgba(
    INK,
    0.85 * (1 - Math.min(1, pose.mouth * 1.4) * 0.7),
  );
  context.lineWidth = Math.max(0.55 / ratio, radius * 0.034);
  context.lineCap = 'round';
  context.beginPath();
  context.moveTo(nx - radius * 0.15, corners);
  context.quadraticCurveTo(
    nx - radius * 0.075,
    ny + radius * 0.07 + curve,
    nx,
    ny + radius * 0.06,
  );
  context.quadraticCurveTo(
    nx + radius * 0.075,
    ny + radius * 0.07 + curve,
    nx + radius * 0.15,
    corners,
  );
  context.stroke();
  context.fillStyle = rgba(palette.nose);
  context.beginPath();
  context.moveTo(nx - radius * 0.055, ny - radius * 0.025);
  context.quadraticCurveTo(
    nx,
    ny - radius * 0.05,
    nx + radius * 0.055,
    ny - radius * 0.025,
  );
  context.quadraticCurveTo(
    nx + radius * 0.02,
    ny + radius * 0.04,
    nx,
    ny + radius * 0.045,
  );
  context.quadraticCurveTo(
    nx - radius * 0.02,
    ny + radius * 0.04,
    nx - radius * 0.055,
    ny - radius * 0.025,
  );
  context.fill();
};

/** Her face, in her body's frame: muzzle, eyes, cheeks, nose and mouth. */
export const paintFace = (
  context: CanvasRenderingContext2D,
  frame: IFurFrame,
  centreY: number,
  radius: number,
) => {
  const { pose, palette } = frame;
  const faceX = pose.faceX * radius * 0.24;
  const faceY = centreY - radius * 0.12 + pose.faceY * radius * 0.12;
  const muzzle = context.createRadialGradient(
    faceX,
    faceY + radius * 0.2,
    0,
    faceX,
    faceY + radius * 0.2,
    radius * 0.3,
  );
  muzzle.addColorStop(0, rgba(palette.belly, 0.75));
  muzzle.addColorStop(1, rgba(palette.belly, 0));
  context.fillStyle = muzzle;
  context.beginPath();
  context.arc(faceX, faceY + radius * 0.2, radius * 0.3, 0, Math.PI * 2);
  context.fill();
  const perfect = frame.mood === 'perfect';
  const squint = perfect ? 0.55 : 1 - frame.joy * 0.3;
  const size = radius * 0.2 * pose.eyeWide;
  paintEye(
    context,
    frame,
    faceX - radius * 0.33,
    faceY - radius * 0.04,
    size,
    squint,
  );
  paintEye(
    context,
    frame,
    faceX + radius * 0.33,
    faceY - radius * 0.04,
    size,
    squint,
  );
  [-1, 1].forEach((side) => {
    const cx = faceX + side * radius * 0.55;
    const cy = faceY + radius * 0.2;
    const cheek = context.createRadialGradient(
      cx,
      cy,
      0,
      cx,
      cy,
      radius * 0.16,
    );
    cheek.addColorStop(0, rgba(palette.inner, 0.28));
    cheek.addColorStop(1, rgba(palette.inner, 0));
    context.fillStyle = cheek;
    context.beginPath();
    context.arc(cx, cy, radius * 0.16, 0, Math.PI * 2);
    context.fill();
  });
  let smile = pose.smile + frame.joy * 0.5;
  if (perfect) {
    smile = 1.3;
  } else if (frame.mood === 'miss') {
    smile = -1;
  }
  paintMouth(context, frame, faceX, faceY, radius, smile);
};

/** The star a supporter's pet wears, over her right ear. */
export const paintStar = (
  context: CanvasRenderingContext2D,
  frame: IFurFrame,
  x: number,
  y: number,
  size: number,
) => {
  const { pose } = frame;
  const scale =
    size *
    frame.starScale *
    (1 + pose.starPop * 0.06) *
    (0.4 + 0.6 * frame.star);
  context.save();
  context.globalAlpha = frame.star;
  context.translate(x, y);
  context.rotate(frame.starTurn + pose.starPop * 0.05);
  context.fillStyle = '#ffe66d';
  context.beginPath();
  for (let point = 0; point < 10; point += 1) {
    const angle = -Math.PI / 2 + (point * Math.PI) / 5;
    const reach = point % 2 === 0 ? scale : scale * 0.45;
    if (point === 0) {
      context.moveTo(Math.cos(angle) * reach, Math.sin(angle) * reach);
    } else {
      context.lineTo(Math.cos(angle) * reach, Math.sin(angle) * reach);
    }
  }
  context.closePath();
  context.fill();
  context.restore();
};
