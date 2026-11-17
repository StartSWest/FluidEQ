/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import type { CSSProperties } from 'react';
import './styles/SupportPet.scss';

/** One cycle of the waveform in the eye, in SVG user units. */
export const EYE_WAVE_PERIOD = 3.2;
/** Enough cycles to cover the pupil plus a full period of scroll either side. */
const EYE_WAVE_CYCLES = 8;
/**
 * Exported so the share card can draw the same wave rather than a lookalike.
 * The card paints her on a canvas, which cannot use the path below, so the
 * numbers are the only thing the two can share — and if they drift, the
 * creature in the picture stops being the creature on screen.
 */
export const EYE_WAVE_AMPLITUDE = 1.1;

/**
 * A small horizontal waveform to run behind a pupil.
 *
 * Built rather than hand-written so the period is exact: the scroll animation
 * translates by precisely one period and loops, and the join is only invisible
 * if every cycle is identical. A hand-drawn path drifts and the wave visibly
 * jumps once a second.
 */
export const buildEyeWave = (centreX: number, centreY: number) => {
  const start = centreX - (EYE_WAVE_CYCLES * EYE_WAVE_PERIOD) / 2;
  const quarter = EYE_WAVE_PERIOD / 4;
  let path = `M ${start} ${centreY}`;
  for (let cycle = 0; cycle < EYE_WAVE_CYCLES; cycle += 1) {
    const x = start + cycle * EYE_WAVE_PERIOD;
    path += ` Q ${x + quarter} ${centreY - EYE_WAVE_AMPLITUDE} ${x + quarter * 2} ${centreY}`;
    path += ` Q ${x + quarter * 3} ${centreY + EYE_WAVE_AMPLITUDE} ${x + quarter * 4} ${centreY}`;
  }
  return path;
};

/** Every layer is the same 40-unit square, so they stack pixel for pixel. */
const VIEW_BOX = '0 0 40 40';

/** Where the pupils sit in the square, and how big they are. */
const EYE_Y = 22;
const PUPIL_RADIUS = 3.4;
const LEFT_PUPIL_X = 15.4;
const RIGHT_PUPIL_X = 24.6;

/**
 * The waveform in one pupil: a window of the page the shape of the pupil
 * (`support-pet__pupil`, squinting with it), and inside it the whole square
 * as a layer that slides one period and loops (`support-pet__eye-wave`). The
 * wave runs well past the iris, so its ends never come into view. The
 * squint is drawn inside the square as well as cut by the window, so the
 * wave flattens with the eye exactly as it did under the pupil's clip.
 */
const EyeWave = ({ centreX }: { centreX: number }) => (
  <span
    className="support-pet__pupil"
    style={
      {
        '--pupil-x': centreX,
        '--pupil-y': EYE_Y,
        '--pupil-r': PUPIL_RADIUS,
      } as CSSProperties
    }
  >
    <span className="support-pet__eye-wave">
      <svg className="support-pet__layer" viewBox={VIEW_BOX} focusable="false">
        <g className="support-pet__squint">
          <path d={buildEyeWave(centreX, EYE_Y)} />
        </g>
      </svg>
    </span>
  </span>
);

/**
 * The creature itself. Shared by the titlebar button, the dialog's hero and
 * the EQ bubble, so none of them can drift apart.
 *
 * In a frame of its own because it moves every frame while music plays, and a
 * drawing that moves has to be laid out again. Standing straight in the grid
 * that centres it, it had the browser lay out the whole window with it each
 * time: a grid's item is never laid out on its own. Inside the frame the
 * drawing is, so the moving creature costs its own few shapes and nothing
 * around it.
 *
 * Drawn as stacked layers of one 40-unit square rather than as one drawing:
 * the ears; the body, which carries the eyes (their pupils, the waves in them
 * and the highlights); and the star. She breathes and blinks for everybody,
 * forever, in the titlebar, and inside one drawing each of those was a
 * group's transform, which Chromium lays out and paints on the main thread:
 * two paints and a layout of the whole creature on every frame. A layer's own
 * transform is the compositor's to animate, and it moves the pixels the layer
 * already painted. Breathing scales the body layer and the eyes with it,
 * blinking scales the eyes layer alone, and the ears and the star hold still
 * through both exactly as they did. Each layer pivots where its group did
 * (`SupportPet.scss`), and the paint order is the drawing's. Moving the whole
 * frame instead would have bobbed the ears about 1.2 px at 36 px and 4 px in
 * the hero.
 */
export function PetArt() {
  // One flat colour, `--pet-tone` (`SupportPet.scss`), set by class: no
  // gradient, so no id a hidden copy of her could take away from the others.
  return (
    <span className="support-pet__frame">
      <span className="support-pet__art" aria-hidden="true">
        {/* Ears double as a little EQ curve - the creature is made of the
          thing the app does. Kept chunky so they survive at 40px. What
          stretches them - the music, the press - is the group's, inside the
          drawing, because a non-scaling stroke keeps its width only under a
          transform inside the drawing: on the layer the stretch would
          thicken them. Their sway and their bob are a layer's of their own
          around the drawing (`support-pet__ears-sway`): a turn and a shift
          thicken nothing, and on a group they were laid out and painted on
          the main thread on every frame of the music. */}
        <span className="support-pet__ears-sway support-pet__layer">
          <svg
            className="support-pet__layer"
            viewBox={VIEW_BOX}
            focusable="false"
          >
            <g className="support-pet__ears">
              <path
                d="M11 12 L14 6 L17 12"
                fill="none"
                className="support-pet__tone-stroke"
                strokeWidth="3"
                strokeLinecap="round"
                strokeLinejoin="round"
                vectorEffect="non-scaling-stroke"
              />
              <path
                d="M23 12 L26 8 L29 12"
                fill="none"
                className="support-pet__tone-stroke"
                strokeWidth="3"
                strokeLinecap="round"
                strokeLinejoin="round"
                vectorEffect="non-scaling-stroke"
              />
            </g>
          </svg>
        </span>

        <span className="support-pet__body support-pet__layer">
          <svg
            className="support-pet__layer"
            viewBox={VIEW_BOX}
            focusable="false"
          >
            <circle className="support-pet__tone" cx="20" cy="24" r="12.5" />
            <path
              className="support-pet__mouth"
              d="M16.6 28.4 Q20 31.4 23.4 28.4"
              fill="none"
              stroke="#06131d"
              strokeWidth="1.8"
              strokeLinecap="round"
              vectorEffect="non-scaling-stroke"
            />
          </svg>

          {/* Eyes carry almost all of the personality, so they are large and
            maximum contrast. Above the mouth now rather than below it; the
            two never meet, so nothing drawn changes. The squint of a streak is
            each drawing's own (`support-pet__squint`), so it is drawn at the
            size it is seen: held on the layer for as long as a streak lasts,
            it was the layer's picture squeezed, and visibly softer. */}
          <span className="support-pet__eyes support-pet__layer">
            <svg
              className="support-pet__layer"
              viewBox={VIEW_BOX}
              focusable="false"
            >
              <g className="support-pet__squint">
                <circle
                  cx={LEFT_PUPIL_X}
                  cy={EYE_Y}
                  r={PUPIL_RADIUS}
                  fill="#06131d"
                />
                <circle
                  cx={RIGHT_PUPIL_X}
                  cy={EYE_Y}
                  r={PUPIL_RADIUS}
                  fill="#06131d"
                />
              </g>
            </svg>

            {/* Sound reflected in the eye: a little waveform scrolling across
              each pupil, clipped to it so it reads as something seen IN the
              eye rather than drawn over it. Invisible at rest and brightening
              with the streak — see `--pet-joy`. Always in the markup rather
              than mounted on demand, so nothing re-renders mid-run to make it
              appear; left out of the page by the stylesheet while there is no
              streak (`has-pet-joy`), so it scrolls only while it can be seen.
              A layer of its own between the pupils and their highlights,
              because that is what takes it out: Chromium keeps animating what
              is inside a hidden group of a drawing it is showing, and it laid
              the page out sixty times a second for waves nobody could see.

              Each pupil is a window of the page, the wave in it a layer that
              slides: the compositor moves the one inside the other. As a path
              scrolling under an SVG clip it was laid out and painted on the
              main thread on every frame, 240 a second on Ivan's display, for
              as long as Colourful mode kept her joyful. */}
            <span className="support-pet__eye-waves support-pet__layer">
              <EyeWave centreX={LEFT_PUPIL_X} />
              <EyeWave centreX={RIGHT_PUPIL_X} />
            </span>

            <svg
              className="support-pet__layer"
              viewBox={VIEW_BOX}
              focusable="false"
            >
              <g className="support-pet__squint">
                <circle cx="16.4" cy="21" r="1.15" fill="#ffffff" />
                <circle cx="25.6" cy="21" r="1.15" fill="#ffffff" />
              </g>
            </svg>
          </span>
        </span>

        {/* Only ever drawn for a supporter. Its twinkle is the layer's
          around the drawing: on the drawing's own root it still counted as
          an SVG element's and ran on the main thread. */}
        <span className="support-pet__star support-pet__layer">
          <svg
            className="support-pet__layer"
            viewBox={VIEW_BOX}
            focusable="false"
          >
            <path
              d="M31.5 8.2 L32.7 11 L35.6 11.3 L33.4 13.2 L34.1 16 L31.5 14.5 L28.9 16 L29.6 13.2 L27.4 11.3 L30.3 11 Z"
              fill="#ffe66d"
            />
          </svg>
        </span>
      </span>
    </span>
  );
}
