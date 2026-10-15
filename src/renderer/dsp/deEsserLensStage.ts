/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { GRAPH_FONT } from './deEsserPlot';
import {
  CENTRE_FROM,
  CENTRE_SURE,
  CUT_SLOPE,
  distanceDb,
  glow,
  ILensPicture,
  label,
  line,
  noGlow,
  POINT_FONT,
  POINT_INK,
  SPARE_DB,
} from './deEsserLensKit';

/**
 * The lens pictures about which sounds are taken for a voice: Keep cymbals'
 * margin and Where's stereo picture.
 */

/** How far over where it starts the drawn S and hi-hat stand, dB. */
const STAND_DB = 20;

/**
 * Keep cymbals: a voice's S and a hi-hat standing the same height over where
 * the stage starts. The voice is cut from the line; the hi-hat only from as
 * far over it as Keep cymbals asks of a sound that is surely not a voice.
 */
export const drawCymbals = ({
  context,
  box,
  settings,
  inks,
  labels,
}: ILensPicture) => {
  const topDb = SPARE_DB + 4;
  const top = box.y + 18;
  const base = box.y + box.height - 20;
  const yOf = (db: number) => base - (db / topDb) * (base - top);
  const spare = settings.keepCymbals * SPARE_DB;
  const width = Math.min(90, box.width * 0.18);
  const columns = [
    { name: labels.voice, ink: inks.voice, from: 0, centre: 0.3 },
    { name: labels.cymbal, ink: inks.notVoice, from: spare, centre: 0.62 },
  ];

  // The line a voice is cut from, across both.
  const threshold = Math.round(yOf(0)) + 0.5;
  context.setLineDash([3, 3]);
  context.strokeStyle = 'rgba(255,255,255,0.45)';
  line(context, box.x + 8, threshold, box.x + box.width - 8, threshold);
  context.setLineDash([]);
  label(
    context,
    labels.threshold,
    box.x + 8,
    threshold + 12,
    'left',
    inks.text,
  );

  columns.forEach((column) => {
    const centre = box.x + box.width * column.centre;
    const left = centre - width / 2;
    const standY = yOf(STAND_DB);
    const cut = Math.max(
      0,
      Math.min(settings.rangeDb, (STAND_DB - column.from) * CUT_SLOPE),
    );
    context.fillStyle = `rgba(${column.ink},0.32)`;
    context.beginPath();
    context.roundRect(left, standY, width, base - standY, [6, 6, 0, 0]);
    context.fill();
    if (cut > 0) {
      // What the stage takes, from the top down.
      glow(context, inks.cut, 10);
      context.fillStyle = `rgba(${inks.cut},0.9)`;
      context.beginPath();
      const depth = yOf(STAND_DB - cut) - standY;
      context.roundRect(left, standY, width, depth, [6, 6, 0, 0]);
      context.fill();
      noGlow(context);
    }
    const ink = `rgba(${column.ink},1)`;
    label(context, column.name, centre, base + 12, 'center', ink);
  });

  // Where a cymbal starts, raised by the dial.
  const cymbal = box.x + box.width * 0.62;
  const y = Math.round(yOf(spare)) + 0.5;
  glow(context, '255,255,255', 8);
  context.strokeStyle = POINT_INK;
  context.lineWidth = 2;
  line(context, cymbal - width / 2 - 14, y, cymbal + width / 2 + 14, y);
  context.lineWidth = 1;
  noGlow(context);
  context.font = POINT_FONT;
  const needs = labels.cymbalNeeds(distanceDb(spare));
  label(context, needs, cymbal + width / 2 + 20, y, 'left', POINT_INK);
  context.font = GRAPH_FONT;
};

/**
 * How much the centre tell lets the stage cut a sound at `pan` (-1 hard
 * left, 1 hard right, constant power): the centre's share of it read from
 * side to sure (`kCentreFrom`, `kCentreSure`).
 */
const centreWeight = (pan: number) => {
  const angle = ((pan + 1) * Math.PI) / 4;
  const mid = (Math.cos(angle) + Math.sin(angle)) / 2;
  const side = (Math.cos(angle) - Math.sin(angle)) / 2;
  const share = (mid * mid) / (mid * mid + side * side);
  return Math.max(
    0,
    Math.min(1, (share - CENTRE_FROM) / (CENTRE_SURE - CENTRE_FROM)),
  );
};

/**
 * Where: the stereo picture from the listening seat, weighted by how much
 * the stage may cut a sound panned there. Everything is listened to evenly;
 * Centre fades to nothing toward the sides, where a hi-hat usually is.
 */
export const drawWhere = (
  { context, box, inks, labels }: ILensPicture,
  centreOnly: boolean,
) => {
  const weight = (pan: number) => (centreOnly ? centreWeight(pan) : 1);
  const cx = box.x + box.width / 2;
  const radius = Math.min(box.width * 0.42, box.height - 40);
  const cy = box.y + 18 + radius;
  const toAngle = (pan: number) => Math.PI * 1.5 + pan * (Math.PI / 3);
  // One stroke under a conic gradient, so the arc has no seams where pieces
  // of it would overlap.
  const start = toAngle(-1);
  const arc = context.createConicGradient(start, cx, cy);
  const steps = 48;
  for (let step = 0; step <= steps; step += 1) {
    const pan = -1 + (2 * step) / steps;
    arc.addColorStop(
      (toAngle(pan) - start) / (Math.PI * 2),
      `rgba(${inks.voice},${(0.12 + 0.78 * weight(pan)).toFixed(3)})`,
    );
  }
  context.strokeStyle = arc;
  context.lineWidth = 14;
  context.lineCap = 'round';
  context.beginPath();
  context.arc(cx, cy, radius, start, toAngle(1));
  context.stroke();
  context.lineCap = 'butt';
  context.lineWidth = 1;

  // The seat, the two sides, and two sounds.
  context.fillStyle = 'rgba(255,255,255,0.7)';
  context.beginPath();
  context.arc(cx, cy, 4, 0, Math.PI * 2);
  context.fill();
  const at = (pan: number, r: number): readonly [number, number] => [
    cx + Math.cos(toAngle(pan)) * r,
    cy + Math.sin(toAngle(pan)) * r,
  ];
  const [lx, ly] = at(-1, radius + 18);
  const [rx, ry] = at(1, radius + 18);
  label(context, labels.left, lx, ly, 'center', inks.text);
  label(context, labels.right, rx, ry, 'center', inks.text);
  // The hi-hat well to one side: the centre tell spares only wide pans (one
  // 9 dB louder on a side still reads 0.85 of the centre), so that is where
  // Centre is seen to leave a sound alone.
  [
    { pan: 0, name: labels.voice },
    { pan: -0.9, name: labels.cymbal },
  ].forEach(({ pan, name }) => {
    const [x, y] = at(pan, radius);
    const heard = weight(pan) > 0.5;
    const ink = heard ? inks.voice : inks.notVoice;
    if (heard) {
      glow(context, ink, 12);
    }
    context.fillStyle = `rgba(${ink},1)`;
    context.beginPath();
    context.arc(x, y, 7, 0, Math.PI * 2);
    context.fill();
    noGlow(context);
    label(context, name, x, y + 20, 'center', `rgba(${ink},1)`);
  });
  context.font = POINT_FONT;
  const title = centreOnly ? labels.centre : labels.everything;
  label(context, title, box.x, box.y + 8, 'left', POINT_INK);
  context.font = GRAPH_FONT;
};
