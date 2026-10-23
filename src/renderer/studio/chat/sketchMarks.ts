/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * The marks a member can put on the stage's picture (`StudioChatSketch.tsx`)
 * and how each is drawn, at the picture's own size: a pen line, an arrow
 * (Ivan, 2026-10-09: "also let me draw arrows and add text") and a word.
 *
 * Every mark has a soft dark rim under its ink, so yellow on snow and white
 * on cloud still read as marks; text has a dark outline for the same reason.
 */

export interface IPoint {
  x: number;
  y: number;
}

export type TSketchMark =
  | { kind: 'pen'; colour: string; width: number; points: IPoint[] }
  | { kind: 'arrow'; colour: string; width: number; from: IPoint; to: IPoint }
  | { kind: 'text'; colour: string; size: number; at: IPoint; text: string };

export type TSketchTool = TSketchMark['kind'];

/** How long an arrow's head is, in pen widths. */
const HEAD_LENGTH = 4.5;
/** Half the angle the head opens to, in radians. */
const HEAD_SPREAD = Math.PI / 7;
/** An arrow shorter than this many pen widths is a slip, not an arrow. */
export const LEAST_ARROW = 3;

const withRim = (
  context: CanvasRenderingContext2D,
  width: number,
  draw: () => void,
) => {
  context.save();
  context.shadowColor = 'rgba(0, 0, 0, 0.55)';
  context.shadowBlur = width * 0.8;
  draw();
  context.restore();
};

const drawPen = (
  context: CanvasRenderingContext2D,
  mark: Extract<TSketchMark, { kind: 'pen' }>,
) => {
  const [first, ...rest] = mark.points;
  if (!first) {
    return;
  }
  withRim(context, mark.width, () => {
    context.strokeStyle = mark.colour;
    context.fillStyle = mark.colour;
    context.lineWidth = mark.width;
    context.lineCap = 'round';
    context.lineJoin = 'round';
    context.beginPath();
    if (rest.length === 0) {
      context.arc(first.x, first.y, mark.width / 2, 0, Math.PI * 2);
      context.fill();
      return;
    }
    context.moveTo(first.x, first.y);
    rest.forEach((point) => context.lineTo(point.x, point.y));
    context.stroke();
  });
};

const drawArrow = (
  context: CanvasRenderingContext2D,
  mark: Extract<TSketchMark, { kind: 'arrow' }>,
) => {
  const { from, to, width } = mark;
  const angle = Math.atan2(to.y - from.y, to.x - from.x);
  const head = width * HEAD_LENGTH;
  // The shaft stops where the head begins, so the tip stays sharp.
  const neck = {
    x: to.x - Math.cos(angle) * head * 0.8,
    y: to.y - Math.sin(angle) * head * 0.8,
  };
  withRim(context, width, () => {
    context.strokeStyle = mark.colour;
    context.fillStyle = mark.colour;
    context.lineWidth = width;
    context.lineCap = 'round';
    context.beginPath();
    context.moveTo(from.x, from.y);
    context.lineTo(neck.x, neck.y);
    context.stroke();
    context.beginPath();
    context.moveTo(to.x, to.y);
    context.lineTo(
      to.x - Math.cos(angle - HEAD_SPREAD) * head,
      to.y - Math.sin(angle - HEAD_SPREAD) * head,
    );
    context.lineTo(
      to.x - Math.cos(angle + HEAD_SPREAD) * head,
      to.y - Math.sin(angle + HEAD_SPREAD) * head,
    );
    context.closePath();
    context.fill();
  });
};

/**
 * The app's own face for the words, as the page has it: a mark in the
 * picture reads like everything else the member writes in FluidEQ.
 */
const fontFamily = () => getComputedStyle(document.body).fontFamily;

const drawText = (
  context: CanvasRenderingContext2D,
  mark: Extract<TSketchMark, { kind: 'text' }>,
) => {
  context.save();
  context.font = `700 ${mark.size}px ${fontFamily()}`;
  context.textBaseline = 'middle';
  context.lineJoin = 'round';
  context.lineWidth = Math.max(2, mark.size * 0.16);
  context.strokeStyle = 'rgba(0, 0, 0, 0.8)';
  context.strokeText(mark.text, mark.at.x, mark.at.y);
  context.fillStyle = mark.colour;
  context.fillText(mark.text, mark.at.x, mark.at.y);
  context.restore();
};

export const drawMark = (
  context: CanvasRenderingContext2D,
  mark: TSketchMark,
) => {
  if (mark.kind === 'pen') {
    drawPen(context, mark);
  } else if (mark.kind === 'arrow') {
    drawArrow(context, mark);
  } else {
    drawText(context, mark);
  }
};
