/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { alphaOf, type IShareCardInks } from './shareCardInks';

/**
 * THE MUSIC WAVE BEHIND THE SHARE CARD (Ivan, 2026-11-27: "B with a music
 * wave bg"): a ribbon of fine strands swelling and crossing like a sound
 * drawn in light, beaded along its crest, over a floor that catches it.
 *
 * Drawn rather than painted: the picture it replaces was one artwork turned
 * round the colour wheel, so a gold window got a gold-ish copy of a cyan
 * scene, its glass panels stood behind the score, and at the card's 2x it was
 * a 1200px picture stretched to 2400. Drawn, it is the window's own run
 * exactly, sharp at any size, and a different swell for every score.
 *
 * It is faint under the score and brightest where the pet jumps, so the
 * number stands on calm ground.
 */

const WIDTH = 1200;
const HEIGHT = 630;

/** Strands in the ribbon, and how far apart the pen is set down along one. */
const STRANDS = 34;
const STEP = 6;

/** A small deterministic generator, so a score always draws the same swell. */
const generatorFor = (seed: number) => {
  let state = (seed * 2654435761) % 4294967296;
  return () => {
    state = (state * 1664525 + 1013904223) % 4294967296;
    return state / 4294967296;
  };
};

interface ISwell {
  /** Phases of the three movements the ribbon is made of. */
  long: number;
  middle: number;
  short: number;
}

/**
 * Where strand `share` (0 the top, 1 the bottom) is at `x`: a long swell, a
 * shorter one riding it, the strands fanned apart where the sound is wide and
 * pinched together where it is quiet.
 */
const strandY = (swell: ISwell, share: number, x: number) => {
  const centre =
    440 +
    62 * Math.sin(x * 0.0058 + swell.long) +
    22 * Math.sin(x * 0.0165 + swell.middle + share * 1.4);
  const spread =
    (share - 0.5) *
    (48 + 60 * (0.5 + 0.5 * Math.sin(x * 0.0042 + swell.short)));
  return centre + spread;
};

/**
 * How much of the light reaches `x`: a quarter under the score, so the
 * digits stay whole at a chat's 300px, and all of it by the pet.
 */
const reachAt = (x: number) =>
  0.25 + 0.75 * Math.min(1, Math.max(0, (x - 300) / 520));

const traceStrand = (
  context: CanvasRenderingContext2D,
  swell: ISwell,
  share: number,
) => {
  context.beginPath();
  for (let x = -20; x <= WIDTH + 20; x += STEP) {
    const y = strandY(swell, share, x);
    if (x === -20) {
      context.moveTo(x, y);
    } else {
      context.lineTo(x, y);
    }
  }
};

const drawSoundField = (
  context: CanvasRenderingContext2D,
  inks: IShareCardInks,
  seed: number,
) => {
  const random = generatorFor(seed);
  const swell: ISwell = {
    long: random() * Math.PI * 2,
    middle: random() * Math.PI * 2,
    short: random() * Math.PI * 2,
  };
  const run = [inks.start, inks.accent, inks.active];

  context.save();
  context.globalCompositeOperation = 'lighter';

  // The floor, catching the ribbon's light.
  context.save();
  context.translate(860, 560);
  context.scale(1, 0.16);
  const floor = context.createRadialGradient(0, 0, 0, 0, 0, 620);
  floor.addColorStop(0, alphaOf(inks.accent, 0.2));
  floor.addColorStop(1, alphaOf(inks.accent, 0));
  context.fillStyle = floor;
  context.fillRect(-620, -620, 1240, 1240);
  context.restore();

  // The strands, brightest in the middle of the ribbon, each in the run
  // across the card and dimmer under the score.
  const across = (alpha: number) => {
    const gradient = context.createLinearGradient(0, 0, WIDTH, 0);
    gradient.addColorStop(0, alphaOf(run[0], alpha * reachAt(0)));
    gradient.addColorStop(0.5, alphaOf(run[1], alpha * reachAt(WIDTH / 2)));
    gradient.addColorStop(1, alphaOf(run[2], alpha * reachAt(WIDTH)));
    return gradient;
  };
  context.lineCap = 'round';
  context.lineJoin = 'round';
  for (let strand = 0; strand < STRANDS; strand += 1) {
    const share = strand / (STRANDS - 1);
    const middle = 1 - Math.abs(share - 0.5) * 2;
    context.strokeStyle = across(0.05 + 0.3 * middle * middle);
    context.lineWidth = 1.1;
    traceStrand(context, swell, share);
    context.stroke();
  }
  // The crest: one strand lit through, the light the eye follows.
  context.strokeStyle = across(0.55);
  context.lineWidth = 2.4;
  traceStrand(context, swell, 0.32);
  context.stroke();
  context.strokeStyle = alphaOf([255, 255, 255], 0.18);
  context.lineWidth = 0.9;
  traceStrand(context, swell, 0.32);
  context.stroke();

  // Beads of light along the upper strands, as a sound drawn in points.
  [0.08, 0.2, 0.32].forEach((share, row) => {
    for (let x = 12 + row * 5; x < WIDTH; x += 13 + row * 3) {
      const shine = random();
      // About a third of the places along a strand stay dark: a row of
      // beads at every step read as a dotted rule, not a sound.
      const lit = shine >= 0.35;
      const y = strandY(swell, share, x) - 4 - random() * 10;
      if (lit) {
        const colour = run[Math.min(2, Math.floor((x / WIDTH) * 3))];
        context.fillStyle = alphaOf(colour, (0.2 + 0.55 * shine) * reachAt(x));
        context.beginPath();
        context.arc(x, y, 0.8 + shine * 1.1, 0, Math.PI * 2);
        context.fill();
      }
    }
  });
  context.restore();

  // A touch of the run's first colour at the left of the floor, so the
  // ground under the score is never a flat black.
  const ground = context.createLinearGradient(0, HEIGHT - 160, 0, HEIGHT);
  ground.addColorStop(0, alphaOf(inks.start, 0));
  ground.addColorStop(1, alphaOf(inks.start, 0.06));
  context.fillStyle = ground;
  context.fillRect(0, HEIGHT - 160, WIDTH, 160);
};

export default drawSoundField;
