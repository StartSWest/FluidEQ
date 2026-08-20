/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU General Public License as published by
the Free Software Foundation, either version 3 of the License, or
(at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
GNU General Public License for more details.

You should have received a copy of the GNU General Public License
along with this program.  If not, see <https://www.gnu.org/licenses/>.
*/

/**
 * The output level meter, in the sidebar under the visualizer switch.
 *
 * Ten styles a click cycles through, drawn on one canvas that covers both
 * channels — the shapes each style draws could not have been done as CSS
 * without inventing ten different DOM structures, and the meter is one
 * reading anyway so drawing them together lets a style span both channels
 * where it wants to. Ctrl+click walks the cycle backwards, and the style's
 * name sits under the strips permanently — cycling happens by clicking the
 * meter itself, so a label that faded away would leave no way to tell which
 * style is on without clicking again and changing it.
 *
 * At rest the palette is cyan tones; in rainbow mode it becomes the site's
 * signal-deck rainbow. Both modes fill the pane the same way — the mode
 * carries the colour, not the geometry.
 */

import type { TranslationKey } from 'common/i18n';
import {
  MouseEvent as ReactMouseEvent,
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react';
import { getStreakJoy } from 'common/rhythmGame';
import { getEaseFactor } from 'common/smoothing';
import {
  MeterStyle,
  METER_STYLE_KEY,
  nextMeterStyle,
  previousMeterStyle,
} from 'common/meterStyles';
import { useTranslation } from '../utils/I18nContext';
import { useLiveAudioFrame } from '../audio/LiveAudioContext';
import { useGraphMeterHidden } from '../utils/graphStyle';
import { useRhythmRun } from '../utils/rhythmRun';
import { useIsEuphoric } from '../utils/euphoriaMode';
import { useSmoothFrames } from '../utils/useSmoothFrames';
import {
  LEVEL_FLOOR_DB,
  LEVEL_HOT_DB,
  LEVEL_OVER_DB,
  levelFraction,
  levelZone,
} from './outputLevel';

/**
 * What to call a bar.
 *
 * A single letter, and still a key: several of the ten locales do not use L and
 * R for this — Russian sound gear says Л and П, Chinese 左 and 右 — and the one
 * place a translator can say so is a dictionary entry. `M` is the honest label
 * for the case where Windows handed over a mono endpoint and there is genuinely
 * only one channel to show.
 */
const channelNameKey = (index: number, isStereo: boolean): TranslationKey => {
  if (!isStereo) {
    return 'graph.meter.mono';
  }
  return index === 0 ? 'graph.meter.left' : 'graph.meter.right';
};

/**
 * How the level and peak ease between frames — the same numbers in both
 * modes. Rainbow's smoother look comes from FRAME RATE, not from easing:
 * `useSmoothFrames` caps the loop at thirty frames a second at rest and
 * lets it run at the display's own rate in euphoria. Slowing the release
 * for the mode instead made the meter lag the music, which reads as a
 * broken meter rather than as a smooth one.
 */
const LEVEL_ATTACK_MS = 35;
// A ten-millisecond half-life covers three quarters of the remaining
// distance in a single 60Hz frame, which is not a release at all — the
// bars simply teleported to the new reading and the fall was over before
// it could be seen. Two hundred lets the drop actually read as a drop.
const LEVEL_RELEASE_MS = 200;
const PEAK_RELEASE_MS = 900;

/**
 * The ceiling this capture can actually reach, in dBFS.
 *
 * Not zero, and the difference is measured rather than chosen. Equalizer APO's
 * documentation is explicit that since Vista the Windows audio engine will not
 * let audio clip — it runs a Limiter APO that lowers the overall volume instead
 * of letting the signal rail. So nothing arriving here is ever allowed to touch
 * full scale: sampled at +20 dB of preamp with the audio audibly breaking up,
 * not one sample in 143,360 reached it, and the peak sat between −0.1 and −1 dB.
 *
 * Minus one is therefore where the top of the scale is from this vantage point,
 * and reaching it is the only signature of an overdriven chain that survives
 * the limiter.
 */
const METER_CEILING_DB = -1;

/** How wide a single channel column is on the canvas. */
/** How thick the brightened reading edge is, on the styles that have one. */
const BAR_TIP_HEIGHT = 2;

const CHANNEL_WIDTH = 18;
const CHANNEL_GAP = 10;

/**
 * Where the meter's two zone boundaries sit on the strip.
 *
 * Derived from the thresholds rather than written as 0.8 and 0.95, so
 * moving `LEVEL_HOT_DB` or `LEVEL_OVER_DB` moves the colours with them
 * instead of quietly sliding them away from the decibels they are named
 * for. A unit test asserts the two figures these produce.
 */
const HOT_FRACTION = levelFraction(LEVEL_HOT_DB);
const OVER_FRACTION = levelFraction(LEVEL_OVER_DB);

/*
 * NO CURVE ON THE READING, and this is the one rule the meter cannot
 * bend.
 *
 * There was a `level ** 2.8` here, added because modern masters sit
 * between −20 and −3 dBFS and a linear strip of that range only moves in
 * its top third — the bars looked pinned. The curve spread that range
 * over more of the strip and the meter moved beautifully.
 *
 * It was also a lie, and the worst possible one. Somebody setting the
 * preamp is reading this to find out how much room is left before the
 * output rails; a curve that pushes the drawing down reports headroom
 * that is not there. `levelFraction` is linear in decibels for the same
 * reason every meter worth reading is, and whatever it returns is what
 * gets drawn.
 *
 * A meter that looks dull because the music really is that loud is
 * telling the truth. That is the whole job.
 */

/**
 * The cyan-tones and rainbow palettes for the level fill, ported from the
 * site's signal-deck. Rainbow in euphoria, cyan tones at rest — one set of
 * stops each way, both from the bottom of the bar to the top so a peak in
 * red-hot stays red regardless of how tall the level currently is.
 */
const CYAN_STOPS: ReadonlyArray<{ offset: number; colour: string }> = [
  { offset: 0, colour: '#005b7f' },
  { offset: 0.5, colour: '#00c5ff' },
  { offset: 1, colour: '#c8fff8' },
];
const RAINBOW_STOPS: ReadonlyArray<{ offset: number; colour: string }> = [
  { offset: 0, colour: '#00e5ff' },
  { offset: 0.28, colour: '#b6ff4a' },
  { offset: 0.52, colour: '#ffe66d' },
  { offset: 0.76, colour: '#ff3cac' },
  { offset: 1, colour: '#8b5cff' },
];

/**
 * The zones' colours, held out of the euphoria rule — a clipped peak stays
 * red regardless of the mode, because the warning is what the colour means
 * and the mode does not get to override it.
 */
const ZONE_COLOURS = {
  safe: '#54ff8a',
  hot: '#ffd24a',
  over: '#ff5a6e',
  clip: '#ff5a6e',
} as const;

/**
 * The colour of a style's reading line, by zone.
 *
 * A table rather than a chain of conditionals: three zones collapse to two
 * warnings and a rest colour, and written as nested ternaries that reads as
 * a puzzle at the exact place the meter is saying how close to the ceiling
 * the sound is.
 */
const READING_COLOURS: Record<'safe' | 'hot' | 'over' | 'clip', string> = {
  safe: '#c8fff8',
  hot: ZONE_COLOURS.hot,
  over: ZONE_COLOURS.over,
  clip: ZONE_COLOURS.over,
};

interface IChannelLevel {
  level: number; // 0..1 fraction of the meter's floor..0 dBFS range
  peak: number;
  zone: 'safe' | 'hot' | 'over' | 'clip';
  peakZone: 'safe' | 'hot' | 'over' | 'clip';
}

/**
 * Fill the given rect with the mode's gradient — cyan tones at rest,
 * rainbow in euphoria. Bottom-to-top so a colour sits at its own
 * fraction of the meter regardless of how loud the moment is.
 */
const paintLevel = (
  context: CanvasRenderingContext2D,
  rect: { x: number; y: number; width: number; height: number },
  // The body's ramp, supplied by the caller. Nearly every style wants the
  // mode's palette, but `segments` rotates its hue with the clock and has
  // no fixed palette to look up.
  stops: ReadonlyArray<{ offset: number; colour: string }>,
) => {
  const gradient = context.createLinearGradient(
    0,
    rect.y + rect.height,
    0,
    rect.y,
  );
  // The body takes the given palette, compressed into the part of the
  // strip that is not a warning.
  stops.forEach((stop) => {
    gradient.addColorStop(stop.offset * HOT_FRACTION, stop.colour);
  });
  /*
   * THE TIP CARRIES THE ZONES, and the two hard stops are the constants.
   *
   * Eighty per cent is `LEVEL_HOT_DB` (−12 dBFS) and ninety-five is
   * `LEVEL_OVER_DB` (−3 dBFS), both measured on the −60..0 strip
   * `levelFraction` maps onto — the same two figures the meter's old
   * stylesheet painted and a unit test still asserts.
   *
   * They went missing when the palette was unified: the whole strip
   * became cyan or rainbow, and with it went the one thing a level meter
   * exists to say, which is how close to the ceiling the sound is. The
   * palette says which mode the app is in; these say how loud it is, and
   * a meter that only answers the first question is decoration.
   *
   * Hard stops rather than a blend, so a colour belongs to a decibel
   * rather than to a gradient position — amber starts AT −12 and not a
   * few pixels either side of it.
   */
  gradient.addColorStop(HOT_FRACTION, ZONE_COLOURS.hot);
  gradient.addColorStop(OVER_FRACTION, ZONE_COLOURS.hot);
  gradient.addColorStop(OVER_FRACTION, ZONE_COLOURS.over);
  gradient.addColorStop(1, ZONE_COLOURS.over);
  return gradient;
};

/**
 * Palettes for the mirrored ramp, which cannot reuse the ones above.
 *
 * `RAINBOW_STOPS` ENDS ON VIOLET, and the zone colours that follow it are
 * amber and red. Up a bar that seam is one edge near the ceiling and it
 * passes; mirrored it happens at both ends of the strip at once, and
 * violet butted against amber is the ugly join it looks like.
 *
 * These run the other way round, cool core to warm rim, so the ramp is
 * already amber-adjacent by the time the zones take over and the whole
 * strip reads as one temperature scale blooming outward. Mirroring the
 * originals also drew the full spectrum twice back to back, which is ten
 * colour bands in an eighteen-pixel strip.
 */
const MIRRORED_CYAN_STOPS: ReadonlyArray<{ offset: number; colour: string }> = [
  { offset: 0, colour: '#0a3a4d' },
  { offset: 0.55, colour: '#00c5ff' },
  { offset: 1, colour: '#7ef9e8' },
];
const MIRRORED_RAINBOW_STOPS: ReadonlyArray<{
  offset: number;
  colour: string;
}> = [
  { offset: 0, colour: '#6a2fd6' },
  { offset: 0.4, colour: '#ff3cac' },
  { offset: 0.72, colour: '#00e5ff' },
  { offset: 1, colour: '#b6ff4a' },
];

/**
 * One hue, walked round the wheel by the clock.
 *
 * `segments` in euphoria takes this instead of the fixed rainbow: the
 * whole strip is a single colour at any instant and that colour cycles,
 * rather than every colour being on screen at once. A spectrum spread
 * across an eighteen-pixel strip is noise; a strip that is cyan now and
 * magenta in ten seconds reads as one lit object.
 *
 * The ramp within it still runs dark core to bright rim, so loudness is
 * carried by brightness whatever the hue happens to be.
 */
/** The mode's fixed palette, for every style that does not build its own. */
const modeStops = (isEuphoric: boolean) =>
  isEuphoric ? RAINBOW_STOPS : CYAN_STOPS;

const cyclingStops = (
  nowMs: number,
): ReadonlyArray<{ offset: number; colour: string }> => {
  const hue = (nowMs * 0.012) % 360;
  return [
    { offset: 0, colour: `hsl(${hue}, 80%, 32%)` },
    { offset: 0.55, colour: `hsl(${hue}, 95%, 58%)` },
    // The rim runs a little ahead of the core, so the segment has depth
    // instead of being one flat wash of the current hue.
    { offset: 1, colour: `hsl(${(hue + 34) % 360}, 100%, 74%)` },
  ];
};

/**
 * The ramp, mirrored about the middle of the strip.
 *
 * `paintLevel` runs floor-to-ceiling, which is right for every style that
 * grows upward and wrong for the one that grows out of the centre: the
 * upper half would climb into amber while the lower half of the very same
 * reading sat in the palette's cool end, so one value would be drawn in
 * two different colours at once.
 *
 * Here distance from the centre carries the ramp, so both halves of a
 * reading are always the same colour and a loud passage goes hot at both
 * ends together.
 */
const paintMirrored = (
  context: CanvasRenderingContext2D,
  // The gradient's own line rather than a rect, because two styles need
  // this ramp along different axes — `center` up the strip and `segments`
  // across it. Endpoints are geometry; a mode flag choosing between two
  // hard-coded axes would not be.
  from: { x: number; y: number },
  to: { x: number; y: number },
  // The caller supplies the ramp rather than a mode flag, because one
  // caller's ramp is not a mode: `segments` rotates its hue with the
  // clock and there is no fixed palette to look up.
  stops: ReadonlyArray<{ offset: number; colour: string }>,
) => {
  const gradient = context.createLinearGradient(from.x, from.y, to.x, to.y);
  // Canvas resolves stops sharing an offset in insertion order, which is
  // what makes the hard zone edges hard — so both halves are added in
  // increasing-position order rather than as one loop over the ramp.
  const above = (distance: number) => 0.5 - distance / 2;
  const below = (distance: number) => 0.5 + distance / 2;

  gradient.addColorStop(above(1), ZONE_COLOURS.over);
  gradient.addColorStop(above(OVER_FRACTION), ZONE_COLOURS.over);
  gradient.addColorStop(above(OVER_FRACTION), ZONE_COLOURS.hot);
  gradient.addColorStop(above(HOT_FRACTION), ZONE_COLOURS.hot);
  for (let i = stops.length - 1; i >= 0; i -= 1) {
    const stop = stops[i];
    gradient.addColorStop(above(stop.offset * HOT_FRACTION), stop.colour);
  }
  stops.forEach((stop) => {
    gradient.addColorStop(below(stop.offset * HOT_FRACTION), stop.colour);
  });
  gradient.addColorStop(below(HOT_FRACTION), ZONE_COLOURS.hot);
  gradient.addColorStop(below(OVER_FRACTION), ZONE_COLOURS.hot);
  gradient.addColorStop(below(OVER_FRACTION), ZONE_COLOURS.over);
  gradient.addColorStop(below(1), ZONE_COLOURS.over);
  return gradient;
};

/** The channel's rect within the canvas, top being high-level and bottom low. */
interface IChannelRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * One channel drawn in one of the ten styles. Kept as a big switch rather
 * than as ten small components: they are all one canvas pass over one rect
 * and the shared setup would be repeated ten times otherwise.
 */
const drawChannel = (
  context: CanvasRenderingContext2D,
  rect: IChannelRect,
  channel: IChannelLevel,
  style: MeterStyle,
  isEuphoric: boolean,
) => {
  const fillHeight = rect.height * channel.level;
  const fillTop = rect.y + rect.height - fillHeight;
  // `segments` and `leds` walk their hue round the wheel with the clock;
  // everything else takes the mode's fixed palette.
  const cyclesHue = style === 'segments' || style === 'leds';
  const bodyStops =
    cyclesHue && isEuphoric
      ? cyclingStops(performance.now())
      : modeStops(isEuphoric);
  const paint = paintLevel(context, rect, bodyStops);

  // The bead grid, hoisted out of the `dots` case because the peak
  // marker below has to land on it as well.
  const dotCount = 20;
  const dotSpacing = rect.height / dotCount;
  const dotRadius = Math.max(
    1.5,
    Math.min(rect.width / 2 - 1.5, dotSpacing / 2 - 1),
  );
  const beadAt = (index: number) =>
    rect.y + rect.height - (index + 0.5) * dotSpacing;

  /**
   * The two passes every style is built from, so all ten light the same
   * way rather than each inventing its own treatment.
   *
   * `ghost` is what has not happened yet: the rungs still to climb, the
   * empty part of the column. Faint, and deliberately unlit — a ladder
   * whose unlit rungs glow reads as a ladder that is entirely on.
   *
   * It is also NEUTRAL, which it was not: it used to take the level
   * gradient, so the part of the strip the sound had not reached was
   * painted in the amber and red of the zones it had not entered. On a
   * quiet meter that put warning colours at the top of every style and
   * coloured bricks at both ends of `center`, announcing something that
   * had not happened.
   *
   * `glow` is the reading itself, over a soft coloured bloom so the lit
   * pieces look like light rather than like paint. The bloom colour
   * follows the mode, which is the one place the meter announces which
   * mode it is in without a legend.
   */
  const ghost = (draw: () => void) => {
    context.save();
    context.globalAlpha = 0.26;
    context.fillStyle = '#94a3b8';
    context.strokeStyle = '#94a3b8';
    draw();
    context.restore();
  };
  const glow = (draw: () => void) => {
    context.save();
    context.shadowBlur = isEuphoric ? 12 : 8;
    context.shadowColor = isEuphoric
      ? 'rgba(255, 60, 172, 0.55)'
      : 'rgba(0, 229, 207, 0.7)';
    context.fillStyle = paint;
    context.strokeStyle = paint;
    draw();
    context.restore();
  };

  switch (style) {
    case 'bar': {
      /**
       * Solid fill from the floor, clipped from the top so a colour ramp
       * stays anchored to the decibel it belongs to. The unlit remainder
       * is drawn first so the strip reads as a bar with headroom rather
       * than as a bar floating in nothing.
       *
       * This is the plain one and stays plain — with ten styles on a
       * cycle, one of them has to be the reading and nothing else.
       */
      ghost(() => {
        context.fillRect(rect.x, rect.y, rect.width, rect.height - fillHeight);
      });
      glow(() => {
        context.fillRect(rect.x, fillTop, rect.width, fillHeight);
      });
      // The tip, brightened. On a bar the value lives at one edge and the
      // rest is only how it got there, so that edge gets the contrast —
      // the same reason a real meter's scale is read off the top of the
      // column and not off its middle.
      if (fillHeight > BAR_TIP_HEIGHT) {
        context.save();
        context.globalAlpha = 0.6;
        context.fillStyle = '#ffffff';
        context.fillRect(rect.x, fillTop, rect.width, BAR_TIP_HEIGHT);
        context.restore();
      }
      break;
    }
    case 'segments': {
      /**
       * A grid of lamps, lit from the floor to the level.
       *
       * It spent a while plotting the last two seconds of level as the
       * WIDTH of each row, and that could not work here for a reason
       * worth writing down: `levelFraction` maps −60..0 dB onto 0..1, so
       * music sits between about 0.70 and 0.90 — on an eighteen-pixel
       * strip that is 12.6px against 16.2px, under four pixels of travel
       * for the entire useful range. Every row came out the same width
       * and the strip read as a centipede. Height has five hundred and
       * eighty pixels for the same range, which is why every other style
       * on this meter reads level as extent and not as width.
       *
       * So it is a ladder, like `segments` always was. What keeps it from
       * being `leds` or `stack` is the grid: unlit lamps stay drawn the
       * whole way up, dim, so the strip is a panel of lamps of which some
       * are on — and the peak sits in it as one held lamp rather than as
       * a rule drawn across the reading.
       */
      const blockCount = 30;
      const blockPitch = rect.height / blockCount;
      const blockGap = Math.max(2, blockPitch * 0.26);
      const blockHeight = blockPitch - blockGap;
      const blockRadius = Math.min(blockHeight / 2, 3);
      const litBlocks = Math.round(channel.level * blockCount);
      const peakBlock = Math.round(channel.peak * blockCount) - 1;
      const blockAt = (index: number) =>
        rect.y + rect.height - (index + 1) * blockPitch + blockGap / 2;
      const lamp = (index: number) => {
        context.beginPath();
        context.roundRect(
          rect.x,
          blockAt(index),
          rect.width,
          blockHeight,
          blockRadius,
        );
      };

      /**
       * The lamps that are off — every one of them, all the way up.
       *
       * Deliberately fainter than the shared ghost draws things. At the
       * usual quarter alpha the dark lamps compete with the lit ones and
       * the strip reads as a lighter patch on a grey field rather than as
       * lamps switching on; this far down, a lit block looks like the
       * only thing in the strip that is emitting.
       */
      ghost(() => {
        context.globalAlpha = 0.13;
        for (let i = litBlocks; i < blockCount; i += 1) {
          lamp(i);
          context.fill();
        }
        // A rim on each dark lamp, so the grid is legible in silence and
        // the lit ones have something to be read against.
        context.globalAlpha = 0.2;
        context.lineWidth = 1;
        for (let i = litBlocks; i < blockCount; i += 1) {
          lamp(i);
          context.stroke();
        }
      });

      glow(() => {
        for (let i = 0; i < litBlocks; i += 1) {
          lamp(i);
          context.fill();
          // The lit face along the top of the lamp. Without it a block is
          // one flat colour and reads as painted rather than as glowing.
          if (blockHeight > 3) {
            context.globalAlpha = 0.32;
            context.fillStyle = '#ffffff';
            context.fillRect(rect.x + 1, blockAt(i) + 0.5, rect.width - 2, 1.2);
            context.fillStyle = paint;
            context.globalAlpha = 1;
          }
        }

        /**
         * Peak hold as one held lamp.
         *
         * A meter that shows only the moment cannot report the transient
         * that caused the trouble, which is most of what a level meter is
         * for. Keeping it inside the grid — a lamp that stays on above the
         * reading — means the peak is told in the instrument's own
         * language instead of by a rule drawn over it.
         */
        if (peakBlock >= litBlocks && peakBlock < blockCount) {
          context.fillStyle = ZONE_COLOURS[channel.peakZone];
          lamp(peakBlock);
          context.fill();
        }
      });
      break;
    }
    case 'leds': {
      // A column of round circles lit up to the level, drawn as
      // professional-style LED beads — clean pill track, a bloom under
      // each lit bead so they read as light rather than as painted
      // circles, and the unlit ones left showing faintly so the ladder
      // is legible before anything is playing. Modelled after PPM peak
      // meters (BAR mode with sharp attack and a held peak indicator)
      // but with FluidEQ's own cyan / rainbow palette rather than the
      // classic green-amber-red, so the meter says which mode the app is
      // in without a legend.
      const litDots = Math.round(channel.level * dotCount);
      const centreX = rect.x + rect.width / 2;
      const beadPath = (index: number) => {
        context.beginPath();
        context.arc(centreX, beadAt(index), dotRadius, 0, Math.PI * 2);
      };
      const bead = (index: number) => {
        beadPath(index);
        context.fill();
      };
      ghost(() => {
        for (let i = litDots; i < dotCount; i += 1) {
          bead(i);
        }
      });
      glow(() => {
        for (let i = 0; i < litDots; i += 1) {
          bead(i);
        }
        /**
         * The topmost lit bead blooms with the music.
         *
         * The shared `glow` pass carries a fixed bloom, which means the
         * ladder looks identical at a whisper and at full tilt once you
         * stop counting beads. Swelling the halo on the bead at the top
         * of the reading gives the level somewhere to show besides its
         * own height, and it lands on the one bead the eye is already on.
         */
        if (litDots > 0) {
          context.shadowBlur = 10 + channel.level * 26;
          context.globalAlpha = 0.5 + channel.level * 0.5;
          bead(litDots - 1);
        }
      });

      /**
       * The domes.
       *
       * A lit bead was one flat disc of colour with a bloom under it,
       * which reads as a sticker rather than as a lamp. Three passes over
       * the same circle turn it into a solid: a highlight up and to the
       * left where the light is coming from, shading down and to the
       * right where it is not, and a dark bezel round the rim so the lamp
       * sits IN the panel instead of on it.
       *
       * Deliberately outside the `glow` pass. Inside it every one of
       * these would pick up the bloom, and a blurred white highlight is
       * not a highlight — it is fog over the bead.
       *
       * They are also drawn over `paint` rather than instead of it, so
       * the bead keeps whatever colour its decibel gives it and the
       * shading works for any hue.
       */
      context.save();
      for (let i = 0; i < litDots; i += 1) {
        const cy = beadAt(i);
        const hiX = centreX - dotRadius * 0.32;
        const hiY = cy - dotRadius * 0.36;
        const gloss = context.createRadialGradient(
          hiX,
          hiY,
          dotRadius * 0.05,
          hiX,
          hiY,
          dotRadius * 1.2,
        );
        gloss.addColorStop(0, 'rgba(255, 255, 255, 0.62)');
        gloss.addColorStop(0.4, 'rgba(255, 255, 255, 0.14)');
        gloss.addColorStop(1, 'rgba(255, 255, 255, 0)');
        context.fillStyle = gloss;
        beadPath(i);
        context.fill();

        const shX = centreX + dotRadius * 0.4;
        const shY = cy + dotRadius * 0.46;
        const shade = context.createRadialGradient(
          shX,
          shY,
          dotRadius * 0.1,
          shX,
          shY,
          dotRadius * 1.3,
        );
        shade.addColorStop(0, 'rgba(0, 0, 0, 0.34)');
        shade.addColorStop(1, 'rgba(0, 0, 0, 0)');
        context.fillStyle = shade;
        beadPath(i);
        context.fill();

        context.strokeStyle = 'rgba(2, 8, 14, 0.6)';
        context.lineWidth = 1;
        beadPath(i);
        context.stroke();
      }
      // The unlit ones get the same bezel and a recess, so the dark part
      // of the ladder reads as empty sockets in a panel rather than as
      // faint dots printed on it.
      for (let i = litDots; i < dotCount; i += 1) {
        const cy = beadAt(i);
        const well = context.createRadialGradient(
          centreX,
          cy - dotRadius * 0.4,
          dotRadius * 0.1,
          centreX,
          cy,
          dotRadius,
        );
        well.addColorStop(0, 'rgba(0, 0, 0, 0.5)');
        well.addColorStop(1, 'rgba(0, 0, 0, 0)');
        context.fillStyle = well;
        beadPath(i);
        context.fill();
        context.strokeStyle = 'rgba(148, 163, 184, 0.16)';
        context.lineWidth = 1;
        beadPath(i);
        context.stroke();
      }
      context.restore();
      // Clipped: the top bead goes red, which is what the LED ladders
      // this style is drawn after do and the only mark here that cannot
      // be missed. A ring round the peak was tried instead and was
      // invisible by construction — it was the same size as the bead it
      // circled and landed on top of a lit one, so it vanished into it.
      if (channel.peakZone === 'clip') {
        context.save();
        context.shadowBlur = 12;
        context.shadowColor = ZONE_COLOURS.clip;
        context.fillStyle = ZONE_COLOURS.clip;
        bead(dotCount - 1);
        context.restore();
      }
      break;
    }
    case 'fluid': {
      /**
       * The column drawn as its edge instead of its body: two rails up the
       * sides and a cap across the top, hollow between them.
       *
       * Three things it used to do wrong, all of them about sitting on top
       * of something else. It stroked a rectangle round the whole track,
       * which the track already draws a rim for — two borders a pixel
       * apart. The rails sat flush on that same edge, so at rest the style
       * was indistinguishable from an empty track. And `strokeRect`
       * straddles its path, so half of every line landed outside the strip
       * it was meant to be inside.
       *
       * Inset on all four sides now, and drawn with `fillRect` so a stated
       * width is the width that appears. The bottom inset matters as much
       * as the others: a mark flush with the floor reads as part of the
       * track rather than as the reading standing on it.
       */
      const inset = 2.5;
      const wallWidth = 1.4;
      const left = rect.x + inset;
      const right = rect.x + rect.width - inset;
      const ceiling = rect.y + inset;
      const floor = rect.y + rect.height - inset;
      const usable = floor - ceiling;
      const surface = floor - usable * channel.level;

      // The vessel: two walls and a base, unlit. It is the container, not
      // the reading, so it stays quiet at every level.
      ghost(() => {
        context.fillRect(left, ceiling, wallWidth, usable);
        context.fillRect(right - wallWidth, ceiling, wallWidth, usable);
        context.fillRect(left, floor - wallWidth, right - left, wallWidth);
      });

      /**
       * The fluid, with a surface that moves.
       *
       * Two sine components rather than one, at frequencies that do not
       * divide into each other: a single sine reads as a rigid shape
       * sliding past, while two beating against each other never repeat
       * the same profile twice and the surface looks disturbed rather
       * than animated.
       *
       * Amplitude follows the level, so a full vessel sloshes and an
       * almost empty one is nearly still — which is what a container of
       * liquid does, and it keeps the surface from breaking through the
       * base when there is barely anything in it.
       */
      const now = performance.now();
      const inner = { x: left + wallWidth, w: right - left - wallWidth * 2 };
      const swell = Math.min(2.2, usable * 0.05) * (0.25 + channel.level);
      const surfaceAt = (x: number) => {
        const across = (x - inner.x) / Math.max(1, inner.w);
        return (
          surface +
          Math.sin(across * 6.1 + now * 0.0021) * swell +
          Math.sin(across * 3.3 - now * 0.0013) * swell * 0.6
        );
      };

      context.save();
      // Clipped to the vessel's interior so the swell can never spill over
      // a wall or out through the base.
      context.beginPath();
      context.rect(
        inner.x,
        ceiling + wallWidth,
        inner.w,
        floor - ceiling - wallWidth * 2,
      );
      context.clip();
      glow(() => {
        const steps = 14;
        // The body a shade translucent so the vessel reads through it —
        // an opaque column is a bar, not a liquid.
        context.globalAlpha = 0.78;
        context.beginPath();
        context.moveTo(inner.x, floor);
        for (let step = 0; step <= steps; step += 1) {
          const x = inner.x + (inner.w * step) / steps;
          context.lineTo(x, surfaceAt(x));
        }
        context.lineTo(inner.x + inner.w, floor);
        context.closePath();
        context.fill();
        context.globalAlpha = 1;
        // The meniscus, brighter than the body, so the level is read from
        // a line rather than from where a translucent fill fades out.
        context.lineWidth = 1.4;
        context.lineCap = 'round';
        context.beginPath();
        for (let step = 0; step <= steps; step += 1) {
          const x = inner.x + (inner.w * step) / steps;
          const y = surfaceAt(x);
          if (step === 0) {
            context.moveTo(x, y);
          } else {
            context.lineTo(x, y);
          }
        }
        context.stroke();
      });
      context.restore();
      break;
    }
    case 'mercury': {
      /**
       * A thermometer: mercury in a glass tube with a bulb at its foot.
       *
       * The glass is what makes this its own style rather than a second
       * `outline`. Both are a fluid in a vessel; the difference is that a
       * thermometer's vessel is a visible object with thickness and a
       * highlight down its side, so it reads as something you could pick
       * up rather than as a border round a fill.
       *
       * The tube is also narrower than the strip and the bulb wider,
       * which is the silhouette that says "thermometer" before any of the
       * shading is noticed.
       */
      const centreX = rect.x + rect.width / 2;
      const bulbRadius = rect.width * 0.44;
      const bulbCentreY = rect.y + rect.height - bulbRadius - 1;
      const tubeWidth = Math.max(3, rect.width * 0.34);
      const tubeX = centreX - tubeWidth / 2;
      const tubeTop = rect.y + 2;
      // Overlapped into the bulb so the two read as one cavity rather
      // than a tube resting on a ball.
      const tubeBottom = bulbCentreY;
      const columnTop = tubeTop + tubeWidth / 2;
      const travel = tubeBottom - columnTop;
      const mercuryTop = tubeBottom - travel * channel.level;

      // The glass, drawn once as tube plus bulb.
      const glassPath = () => {
        context.beginPath();
        context.roundRect(
          tubeX,
          tubeTop,
          tubeWidth,
          tubeBottom - tubeTop,
          tubeWidth / 2,
        );
        context.moveTo(centreX + bulbRadius, bulbCentreY);
        context.arc(centreX, bulbCentreY, bulbRadius, 0, Math.PI * 2);
      };

      // The cavity, unlit — the empty part of the instrument.
      ghost(() => {
        glassPath();
        context.fill();
      });

      // The mercury, clipped to the glass so it can never sit outside it.
      context.save();
      glassPath();
      context.clip();
      glow(() => {
        context.fillRect(
          tubeX - 1,
          mercuryTop,
          tubeWidth + 2,
          tubeBottom - mercuryTop,
        );
        // The bulb is the reservoir rather than part of the reading, so it
        // is always full — a thermometer with an empty bulb reads as
        // broken rather than as cold.
        context.beginPath();
        context.arc(centreX, bulbCentreY, bulbRadius + 1, 0, Math.PI * 2);
        context.fill();
      });
      context.restore();

      /**
       * What makes it glass: an edge and a highlight.
       *
       * The rim gives the cavity a wall to be seen through; the streak is
       * the reflection running down one side of a cylinder, which is the
       * single cue that separates a tube from a slot cut in the card. Both
       * are drawn over the mercury, because glass is in front of what it
       * contains.
       */
      context.save();
      context.strokeStyle = 'rgba(196, 240, 255, 0.34)';
      context.lineWidth = 1;
      glassPath();
      context.stroke();
      context.globalAlpha = 0.5;
      context.strokeStyle = 'rgba(255, 255, 255, 0.55)';
      context.lineWidth = Math.max(1, tubeWidth * 0.16);
      context.lineCap = 'round';
      context.beginPath();
      const streakX = centreX - tubeWidth * 0.24;
      context.moveTo(streakX, tubeTop + tubeWidth * 0.8);
      context.lineTo(streakX, bulbCentreY - bulbRadius);
      context.stroke();
      context.restore();
      break;
    }
    case 'needle': {
      /**
       * A pointer against a ruled scale — the one style that shows a
       * position rather than a quantity.
       *
       * It was a bare horizontal bar over a flat wash, overhanging the
       * strip by two pixels at each end. That is the same fault the peak
       * bars had: a rule drawn across the meter rather than a part of it,
       * and with nothing to read the position against it said no more than
       * a filled column would have.
       *
       * The ticks are what give it something to point at. Longer every
       * fifth mark, the way any printed scale does it, so the eye has
       * anchors rather than a uniform comb.
       */
      /**
       * A haze filling the whole tube, behind the scale.
       *
       * Not the `pulse` style's gas, and the difference is the point.
       * There the clouds ARE the reading — they are discrete, they pump,
       * and you look at them. Here the gas is the medium the pointer moves
       * through: it fills the tube edge to edge, drifts slowly enough that
       * you never catch it moving, and is faint enough to sit behind the
       * ticks without competing with them. It colours the instrument, it
       * does not report anything.
       *
       * Three very wide gradients rather than many small ones, so it
       * covers everything and reads as one body of gas with currents in
       * it, rather than as separate puffs.
       */
      const hazeNow = performance.now();
      /**
       * How hard the gas is being driven. Beats with the level, and never
       * reaches nothing: at silence a trace of colour still hangs in the
       * tube, which says the instrument is live and hearing quiet rather
       * than switched off.
       */
      const hazeBeat = 0.25 + channel.level * 2.6;
      context.save();
      // Clipped to this channel's own tube. The gradients are far wider
      // than the strip — that is what makes the gas fill it corner to
      // corner rather than fading out before the edges — so without this
      // each channel's gas would wash across the whole canvas and the two
      // would blend into one cloud.
      context.beginPath();
      context.rect(rect.x, rect.y, rect.width, rect.height);
      context.clip();
      /*
       * PLAIN BLENDING, and this is what makes the nebula dark.
       *
       * It composited with `lighter` at first, on the reasoning that light
       * through gas adds. It does — and that is exactly the problem here:
       * `lighter` sums channels, so six layers of a deep teal stack into a
       * pale pastel no matter how dark each one is on its own. Every
       * attempt to darken the palette came back bright.
       *
       * Ordinary `source-over` lets a dark colour stay the colour it is.
       */
      /**
       * A different hue per current, drawn from the app's own spectrum.
       *
       * One colour drifting is a tinted fog; three overlapping at
       * different speeds mix where they cross and separate again as they
       * pass, so the tube shifts through the spectrum without any one
       * frame looking like a chosen colour.
       */
      /**
       * The body of the nebula: one gradient down the whole tube.
       *
       * Round knots alone could not do this. The strip is some thirty
       * times taller than it is wide, so a circle big enough to cover a
       * useful stretch of it overflows the sides and stops varying across
       * the width, while circles small enough to travel visibly leave gaps
       * between them. Neither fills.
       *
       * A linear gradient along the length fills by construction, and the
       * knots below then move ON it. The stops slide with time, so the
       * whole spectrum drifts up the tube rather than sitting still.
       */
      const bodyShift = (hazeNow * 0.00004) % 1;
      /**
       * The nebula's palette, following the mode like everything else on
       * this meter: the full spectrum in rainbow, cyan tones at rest.
       *
       * The cyan set is six entries too, not one colour repeated, so the
       * drift still shows movement — a gradient between identical stops is
       * a flat fill however fast it slides. Deep teal through ice and back
       * gives the same travelling shape in one hue family.
       */
      /**
       * Deep colours rather than bright ones dimmed.
       *
       * A pale tint at low alpha does not read as dark, it reads as
       * washed out — the hue goes with the opacity and what is left is
       * grey haze. Choosing colours that are already deep keeps the hue
       * at the low alpha this sits at, so the nebula is dim and coloured
       * rather than faint and colourless.
       */
      const spectrum = isEuphoric
        ? [
            '0, 38, 58',
            '12, 30, 64',
            '30, 54, 20',
            '64, 46, 10',
            '58, 12, 39',
            '30, 18, 64',
          ]
        : [
            '0, 20, 30',
            '0, 30, 43',
            '0, 39, 51',
            '5, 47, 58',
            '0, 36, 40',
            '0, 25, 35',
          ];
      const body = context.createLinearGradient(
        0,
        rect.y + rect.height,
        0,
        rect.y,
      );
      // Two full passes of the spectrum so the drift never shows a seam:
      // whatever slides off one end has already been drawn arriving at
      // the other.
      for (let pass = 0; pass <= spectrum.length * 2; pass += 1) {
        const tint = spectrum[pass % spectrum.length];
        const offset = (pass / (spectrum.length * 2) + bodyShift) % 1;
        body.addColorStop(offset, `rgba(${tint}, ${0.6 * hazeBeat})`);
      }
      context.fillStyle = body;
      context.fillRect(rect.x, rect.y, rect.width, rect.height);

      /**
       * Knots of brighter colour moving through the body.
       *
       * `reach` is where each sits along the tube and `sway` how far it
       * wanders, so between them they work the whole length instead of
       * bunching at the middle.
       */
      // Drawn from the same palette as the body above, so the two agree
      // about which mode the app is in.
      const knots = [
        { reach: 0.08, sway: 0.16, speed: 0.00042, phase: 0 },
        { reach: 0.26, sway: 0.14, speed: -0.00035, phase: 1.7 },
        { reach: 0.44, sway: 0.18, speed: 0.00029, phase: 3.1 },
        { reach: 0.6, sway: 0.15, speed: -0.00047, phase: 4.4 },
        { reach: 0.78, sway: 0.17, speed: 0.00038, phase: 5.6 },
        { reach: 0.93, sway: 0.13, speed: -0.00031, phase: 2.3 },
      ].map((knot, index) => ({
        ...knot,
        tint: spectrum[index % spectrum.length],
      }));
      knots.forEach((knot) => {
        const t = hazeNow * knot.speed + knot.phase;
        const cx = rect.x + rect.width * (0.5 + Math.cos(t * 1.6) * 0.34);
        const cy =
          rect.y + rect.height * (knot.reach + Math.sin(t) * knot.sway);
        // Swells with the level as well as brightening, so a loud passage
        // makes the nebula bloom outward rather than only glow harder.
        const radius = rect.width * (1.5 + channel.level * 1.4);
        const haze = context.createRadialGradient(cx, cy, 0, cx, cy, radius);
        haze.addColorStop(0, `rgba(${knot.tint}, ${0.5 * hazeBeat})`);
        haze.addColorStop(0.45, `rgba(${knot.tint}, ${0.2 * hazeBeat})`);
        haze.addColorStop(1, `rgba(${knot.tint}, 0)`);
        context.fillStyle = haze;
        context.fillRect(rect.x, rect.y, rect.width, rect.height);
      });
      context.restore();

      const ticks = 20;
      const tickSpacing = rect.height / ticks;
      ghost(() => {
        for (let i = 0; i <= ticks; i += 1) {
          const y = rect.y + rect.height - i * tickSpacing;
          const isMajor = i % 5 === 0;
          const length = isMajor ? rect.width * 0.5 : rect.width * 0.28;
          context.fillRect(rect.x, y - 0.5, length, 1);
        }
      });
      glow(() => {
        // The pointer: a blade across the strip with a head on the left,
        // which is the side the ticks run from. A line on its own reads
        // as a boundary between two regions; a head makes it point.
        const y = fillTop;
        const headWidth = Math.max(3, rect.width * 0.34);
        context.fillRect(rect.x, y - 0.9, rect.width, 1.8);
        context.beginPath();
        context.moveTo(rect.x, y - headWidth * 0.55);
        context.lineTo(rect.x + headWidth, y);
        context.lineTo(rect.x, y + headWidth * 0.55);
        context.closePath();
        context.fill();
      });
      break;
    }
    case 'pulse': {
      /**
       * Sparks carried up the strip, thrown by the level and dying out
       * above it.
       *
       * Two earlier attempts are worth not repeating. A single hard-edged
       * circle that grew and shrank read as a bug rather than as
       * breathing, because no solid object changes size. Replacing it with
       * drifting gas clouds fixed the edge but not the idea: soft blobs
       * moving slowly are pretty and say nothing, and the `needle` style
       * now owns the haze look anyway.
       *
       * Sparks answer the question a meter is asked. How MANY are in the
       * air and how HIGH they get are both the level, so the reading is
       * carried by the density of a column rather than by the size of one
       * shape — which is the difference between an ember bed and a lamp on
       * a dimmer.
       */
      const centreX = rect.x + rect.width / 2;
      const now = performance.now();
      const drive = channel.level;
      // Sparks live: they rise, fade and are replaced. The count is fixed
      // and the level decides how many of them are lit, so nothing has to
      // be allocated or retired between frames.
      /**
       * How many sparks the column can hold.
       *
       * Sixty rather than the twenty-six it started at, which fills the
       * strip properly — and it costs nothing measurable. Each one is a
       * single `arc` of a couple of pixels with no gradient behind it, so
       * the whole column is around sixty small fills a frame per channel.
       * The expensive things on this canvas are the radial gradients the
       * other styles build, and this style builds none.
       */
      const sparkCount = 60;
      const lit = Math.round(sparkCount * (0.06 + drive * 0.94));
      /**
       * The throw IS the reading, not a decoration scaled by it.
       *
       * It used to be `height * (0.12 + drive * 0.88)`, which rises with
       * the level but does not equal it — so the top of the column landed
       * near the reading without ever being it, and there was nothing on
       * the strip anybody could take a number off. That is a visualiser,
       * not a meter.
       *
       * Now the embers reach exactly `fillHeight` and the line drawn at
       * their top is the level, read against the same scale every other
       * style uses. The sparks are the texture; the edge is the reading.
       */
      const throwHeight = fillHeight;

      /**
       * The bed the sparks come off, at the foot of the strip.
       *
       * Without it they arrive from nowhere — the column starts at a hard
       * edge and the eye has no reason to believe anything is throwing
       * them. A hot floor gives the shaft a source, which is what makes
       * the whole thing read as a flue rather than as dots moving upward.
       *
       * It brightens and reaches further with the level, so the source is
       * itself part of the reading rather than decoration under it.
       */
      const bedHeight = rect.height * (0.03 + drive * 0.1);
      /**
       * The bed flickers as well as brightening.
       *
       * Level alone gave it a smooth swell, which reads as a lamp being
       * turned up. Real embers are never steady — they gutter — and the
       * guttering is most of what makes a floor look hot rather than lit.
       *
       * Two sines at unrelated rates so the flicker never falls into a
       * pattern, and scaled BY the level so it is still driven by the
       * music: loud passages gutter hard, quiet ones barely stir.
       */
      const flicker =
        1 +
        (Math.sin(now * 0.011) * 0.16 + Math.sin(now * 0.027) * 0.09) * drive;
      const bedGlow = (0.28 + drive * 0.5) * flicker;
      /**
       * The bed keeps the mode's own colour — the travelling hue in
       * rainbow, cyan at rest — and does not take the zones.
       *
       * It did for a while, on the reasoning that the source should say
       * the channel's state. It should not: the reading line at the top
       * of the embers already carries the zone, and a second thing
       * turning red says the same fact twice while costing the style the
       * colour that makes it worth looking at.
       */
      const bedHue = isEuphoric
        ? `hsla(${(now * 0.02) % 360}, 95%, 62%,`
        : 'rgba(0, 200, 255,';
      const bed = context.createLinearGradient(
        0,
        rect.y + rect.height,
        0,
        rect.y + rect.height - bedHeight,
      );
      bed.addColorStop(0, `${bedHue} ${bedGlow})`);
      bed.addColorStop(1, `${bedHue} 0)`);

      /**
       * Drawn OUTSIDE the strip's clip, unlike everything else here.
       *
       * A hot floor throws light onto whatever is near it — that is what
       * heat looks like, and it is the difference between a lit shape and
       * a source. Clipped to the strip the glow stopped dead at the wall,
       * which reads as a bright rectangle rather than as something
       * burning. The shadow carries it past the edge; the fill itself
       * still sits inside.
       *
       * The blur widens with the level, so a loud passage throws further
       * as well as brighter.
       */
      context.save();
      context.globalCompositeOperation = 'lighter';
      context.shadowColor = `${bedHue} ${Math.min(1, bedGlow)})`;
      context.shadowBlur = 8 + drive * 22;
      context.fillStyle = bed;
      context.fillRect(
        rect.x,
        rect.y + rect.height - bedHeight,
        rect.width,
        bedHeight,
      );
      context.restore();

      context.save();
      context.beginPath();
      context.rect(rect.x, rect.y, rect.width, rect.height);
      context.clip();
      context.globalCompositeOperation = 'lighter';

      for (let i = 0; i < lit; i += 1) {
        /*
         * Each spark's own timing, from its index rather than from stored
         * state. Multiplying by irrationals and taking the fraction gives
         * every one a different phase and speed that never repeats across
         * the set, so the column looks scattered without a random number
         * anywhere — and nothing has to persist between frames.
         */
        const seedA = (i * 0.6180339887) % 1;
        const seedB = (i * 0.4142135624) % 1;
        const seedC = (i * 0.7320508076) % 1;
        const speed = 0.00018 + seedB * 0.00042;
        // Where it is in its own life, 0 at the floor and 1 spent.
        const life = (now * speed + seedA) % 1;
        const y = rect.y + rect.height - throwHeight * life;
        // Drifting sideways as it climbs, the way anything rising through
        // air does. The sway widens with height so the column opens out.
        const sway =
          Math.sin(life * 5 + seedC * 6.28) * rect.width * 0.3 * life;
        const x = centreX + sway;
        // Fading out toward the top of the throw, and small.
        const fade = (1 - life) ** 1.6;
        const radius = (0.7 + seedC * 1.3) * (0.5 + drive * 0.7);
        /**
         * Colour: the mode's own, and only the mode's.
         *
         * The sparks briefly took the amber and red zones as they climbed
         * past the thresholds. Two things were wrong with it. It reported
         * where a spark happened to be rather than where the level is, so
         * at a level just short of a zone none of them crossed it and the
         * warning never came; and the zone is already said, once, by the
         * reading line at the top of the column. Saying it here as well
         * cost the style the colour that makes it worth looking at and
         * bought nothing.
         *
         * A continuous hue in rainbow rather than a handful of tints
         * picked by index — five buckets read as five colours of spark,
         * where a hue varying across the set reads as a spectrum. Fixed
         * for the spark's whole climb, because a hue that shifted as it
         * rose would read as several sparks in a line rather than as one
         * travelling.
         */
        context.fillStyle = isEuphoric
          ? `hsla(${180 + seedC * 180}, 95%, 62%, ${0.85 * fade})`
          : `rgba(0, 220, 255, ${0.85 * fade})`;
        context.beginPath();
        context.arc(x, y, radius, 0, Math.PI * 2);
        context.fill();
      }

      /**
       * The reading itself: a crisp line where the embers stop.
       *
       * Without it this style says "loud" and "quiet" and nothing in
       * between — scattered points have no edge, so there is no position
       * to read against the scale. The line is what makes the column a
       * meter rather than a picture of one, and it takes the zone colour
       * so the same line also says which region the level is in.
       */
      context.globalCompositeOperation = 'source-over';
      context.fillStyle = READING_COLOURS[channel.zone];
      context.fillRect(rect.x, fillTop - 1, rect.width, 2);
      context.restore();
      break;
    }
    case 'stack': {
      /**
       * Slabs piled up, leaning as though the pile is about to go over.
       *
       * The squares it used to draw were sized from the strip's WIDTH
       * while their spacing came from its height, so on a tall strip they
       * sat eighteen pixels wide with twenty-pixel gaps and the column
       * read as sparse rather than stacked. Full-width slabs with a lit
       * top face fix that: a solid seen slightly from above is a cap and
       * a body a shade darker, and a pile of those reads as objects
       * resting on each other.
       *
       * The lean is what separates it from `segments` and `leds`, which
       * are also columns of lit pieces. Those two say how far up the
       * level reaches; this one also says how hard it is being pushed —
       * the slabs slide sideways like coins shoved off true, and the
       * higher up the pile a slab sits the further it goes.
       */
      const slabCount = 22;
      const pitch = rect.height / slabCount;
      const slabGap = Math.max(1, pitch * 0.22);
      const slabHeight = pitch - slabGap;
      const capHeight = Math.max(1, slabHeight * 0.34);
      const litSlabs = Math.round(channel.level * slabCount);
      const swayNow = performance.now();

      /**
       * How far the top of the pile is pushed, in fractions of the strip
       * width. Two waves at unrelated periods so the lean never settles
       * into a metronome, plus a small idle sway: a pile that stands
       * perfectly still in silence reads as bolted down, and this one is
       * meant to look like it is only just balancing.
       */
      const push =
        (Math.sin(swayNow * 0.00097) * 0.62 +
          Math.sin(swayNow * 0.00231 + 1.7) * 0.38) *
        (0.06 + channel.level * 0.44);

      /**
       * Slabs near the floor barely move and the top ones travel most,
       * which is how a stack pushed sideways actually fails — the power
       * curve is what makes it lean rather than slide as one block.
       */
      const leanAt = (index: number) =>
        push * rect.width * (index / (slabCount - 1)) ** 1.6;
      const slabAt = (index: number) =>
        rect.y + rect.height - (index + 1) * pitch + slabGap / 2;

      ghost(() => {
        for (let i = litSlabs; i < slabCount; i += 1) {
          context.fillRect(
            rect.x + leanAt(i),
            slabAt(i),
            rect.width,
            slabHeight,
          );
        }
      });
      glow(() => {
        for (let i = 0; i < litSlabs; i += 1) {
          const y = slabAt(i);
          const x = rect.x + leanAt(i);
          // The body, a shade down so the cap above it reads as a lit
          // face rather than as part of one flat block.
          context.globalAlpha = 0.55;
          context.fillRect(
            x,
            y + capHeight,
            rect.width,
            slabHeight - capHeight,
          );
          // The top face.
          context.globalAlpha = 1;
          context.fillRect(x, y, rect.width, capHeight);
        }
      });
      break;
    }
    case 'flow': {
      /**
       * A current running up the pipe.
       *
       * It was fourteen fixed zigzags lit up to the level, which made it
       * a fourth ladder next to `segments`, `leds` and `stack` — and it
       * did not flow at all: the wiggle came from the line's INDEX, with
       * no time in the expression anywhere, so the water was frozen.
       *
       * Nothing else on this meter moves along the strip, so that is what
       * this one does. The height the current reaches is the level, the
       * same reading as everywhere else; what it adds is how hard it is
       * running — streaks travel faster and there are more of them as the
       * level climbs, so a loud passage is a torrent and a quiet one a
       * trickle at the same height.
       */
      const flowNow = performance.now();
      const columnTop = rect.y + rect.height * (1 - channel.level);
      const columnHeight = rect.y + rect.height - columnTop;

      // The empty length of pipe above the current. The contrast between
      // it and the running part is what makes the level readable at a
      // glance, without a rule drawn across the strip to mark it.
      ghost(() => {
        context.fillRect(
          rect.x,
          rect.y,
          rect.width,
          Math.max(0, columnTop - rect.y),
        );
      });

      if (columnHeight >= 1) {
        context.save();
        context.beginPath();
        context.rect(rect.x, columnTop, rect.width, columnHeight);
        context.clip();
        glow(() => {
          // Body of the current, so the column reads as filled rather
          // than as a few marks floating in a dark gap.
          context.globalAlpha = 0.32;
          context.fillRect(rect.x, columnTop, rect.width, columnHeight);

          const streakCount = 4 + Math.round(channel.level * 7);
          const speed = 0.00022 + channel.level * 0.00075;
          const streakLength = Math.max(6, columnHeight * 0.24);
          const segments = 7;
          const segmentHeight = streakLength / segments;
          for (let i = 0; i < streakCount; i += 1) {
            // Golden-ratio spacing, so the streaks never line up into a
            // repeating pattern the eye can lock onto and read as a
            // rotating barber pole instead of as moving water.
            const phase = (i * 0.6180339887) % 1;
            const along = (flowNow * speed + phase) % 1;
            const headY =
              rect.y + rect.height - along * (columnHeight + streakLength);
            for (let s = 0; s < segments; s += 1) {
              // Squared falloff: a linear tail reads as a solid dash with
              // a soft end, this one reads as something leaving a wake.
              const fade = 1 - s / segments;
              context.globalAlpha = 0.7 * fade * fade;
              context.fillRect(
                rect.x,
                headY + s * segmentHeight,
                rect.width,
                segmentHeight + 0.5,
              );
            }
          }
        });
        context.restore();
      }
      break;
    }
    case 'center': {
      /**
       * Centre-zero: the reading grows out of the middle in both
       * directions, the way a balance meter reads either side of nought.
       *
       * Two things were wrong with it and neither was the shape. It
       * ghosted the WHOLE strip rather than only the part it had not
       * reached, so it sat there looking permanently half lit; and it took
       * its colour from `paintLevel`, which runs floor-to-ceiling — the
       * upper arm climbed into amber while the lower arm of the SAME
       * reading stayed in the palette's cool end, one value drawn in two
       * colours at once. `paintMirrored` fixes the second: distance from
       * the centre carries the ramp, so both arms always match and a loud
       * passage goes hot at both ends together.
       */
      const midY = rect.y + rect.height / 2;
      const reach = (rect.height / 2) * channel.level;
      const mirrored = paintMirrored(
        context,
        { x: 0, y: rect.y },
        { x: 0, y: rect.y + rect.height },
        isEuphoric ? MIRRORED_RAINBOW_STOPS : MIRRORED_CYAN_STOPS,
      );

      ghost(() => {
        context.fillRect(
          rect.x,
          rect.y,
          rect.width,
          Math.max(0, midY - reach - rect.y),
        );
        context.fillRect(
          rect.x,
          midY + reach,
          rect.width,
          Math.max(0, rect.y + rect.height - (midY + reach)),
        );
      });

      glow(() => {
        context.fillStyle = mirrored;
        context.fillRect(rect.x, midY - reach, rect.width, reach * 2);
        // Both tips brightened, because on a centre-zero meter the value
        // is at the ends and the middle is only where it grew from.
        if (reach > BAR_TIP_HEIGHT) {
          context.globalAlpha = 0.55;
          context.fillStyle = '#ffffff';
          context.fillRect(rect.x, midY - reach, rect.width, BAR_TIP_HEIGHT);
          context.fillRect(
            rect.x,
            midY + reach - BAR_TIP_HEIGHT,
            rect.width,
            BAR_TIP_HEIGHT,
          );
        }
      });

      /**
       * The axis it grows about.
       *
       * A single pale line was invisible: at rest it lay on the grey
       * ghost and at volume the glow washed straight over it, so it
       * disappeared in both of the states it exists to be read against.
       * A dark groove with a bright hairline cut into it survives either
       * way — the groove shows against the lit fill, the hairline shows
       * against the dark.
       */
      context.save();
      context.fillStyle = 'rgba(3, 10, 18, 0.85)';
      context.fillRect(rect.x - 2, midY - 1.5, rect.width + 4, 3);
      context.fillStyle = 'rgba(232, 240, 254, 0.95)';
      context.fillRect(rect.x - 2, midY - 0.5, rect.width + 4, 1);
      context.restore();
      break;
    }
    default:
      break;
  }

  // Peak hold, and only on the bead column.
  //
  // Every other style used to carry a horizontal bar across the strip for
  // this, overhanging a pixel either side. It read as a rule drawn over
  // the meter rather than as part of it — a second, unrelated mark
  // sitting on top of the reading — so it is gone. The bead column keeps
  // its marker because there the mark is a bead: a ring drawn on the grid
  // the rest of the column already uses, which is the same object lit a
  // different way rather than a new one laid over it.
  // Peak hold, on the bead column, and only while the peak is above the
  // level it would otherwise be hidden behind. Drawn as a hollow bead in
  // the grid's own position, so it reads as one of the column's own
  // pieces rather than as a mark laid over them.
  //
  // Two earlier versions are worth not repeating. A horizontal bar
  // across every style overhung the strip and read as a rule drawn on
  // top of the meter. A ring at the same radius as a bead was invisible:
  // it circled a lit bead exactly and disappeared into it, which is why
  // nothing showed at all for a while.
  const peakIndex = Math.max(
    0,
    Math.min(dotCount - 1, Math.round(channel.peak * dotCount) - 1),
  );
  const litIndex = Math.round(channel.level * dotCount) - 1;
  if (style === 'leds' && channel.peak > 0.02 && peakIndex > litIndex) {
    context.save();
    context.globalAlpha = 0.94;
    context.strokeStyle = ZONE_COLOURS[channel.peakZone];
    context.lineWidth = 1.6;
    context.shadowColor = ZONE_COLOURS[channel.peakZone];
    context.shadowBlur = 6;
    context.beginPath();
    context.arc(
      rect.x + rect.width / 2,
      beadAt(peakIndex),
      dotRadius,
      0,
      Math.PI * 2,
    );
    context.stroke();
    context.restore();
  }

  // The ember column deliberately gets no peak-hold mark of its own. It
  // already carries one line — the reading at the top of the embers — and
  // a second floating above it read as two readings disagreeing rather
  // than as a level and its recent peak.

  // No warning wash on the strip. A red rim was tried, then a red flood
  // from the ceiling, and both said the same thing the peak marker
  // already says by sitting in the last position — two marks for one
  // fact, and the louder of them covering the reading underneath.
};

const OutputLevelMeter = () => {
  const { isClipping, outputLevels } = useLiveAudioFrame();
  const { t } = useTranslation();
  const isHidden = useGraphMeterHidden();
  const isEuphoric = useIsEuphoric(getStreakJoy(useRhythmRun().streak) >= 1);
  const isEuphoricRef = useRef(isEuphoric);
  isEuphoricRef.current = isEuphoric;
  const isClippingRef = useRef(isClipping);
  isClippingRef.current = isClipping;

  // Remembered across launches: which one somebody likes is a preference,
  // and being handed back a different meter every morning is not charming.
  // The first-run default is `fluid`, the same look the titlebar wave
  // opens on, so the two visualisers agree about what the app looks like
  // before anybody has chosen anything.
  const [style, setStyle] = useState<MeterStyle>(() => {
    try {
      return (window.localStorage.getItem(METER_STYLE_KEY) ||
        'fluid') as MeterStyle;
    } catch {
      return 'fluid';
    }
  });
  const styleRef = useRef(style);
  styleRef.current = style;

  // The style's name is painted at the foot of the canvas on every frame
  // and never goes away, so cycling needs no timer and no announcement
  // state — see the label at the end of the frame loop.
  const cycleStyle = useCallback(
    (event: ReactMouseEvent<HTMLButtonElement>) => {
      const goingBack = event.ctrlKey || event.metaKey;
      setStyle((current) => {
        const next = goingBack
          ? previousMeterStyle(current)
          : nextMeterStyle(current);
        try {
          window.localStorage.setItem(METER_STYLE_KEY, next);
        } catch {
          // Not worth failing a click over.
        }
        return next;
      });
    },
    [],
  );

  // The buffered channel state, eased frame-to-frame so the meter carries
  // motion between analyser publishes and does not jump.
  const easedRef = useRef<IChannelLevel[]>([
    { level: 0, peak: 0, zone: 'safe', peakZone: 'safe' },
    { level: 0, peak: 0, zone: 'safe', peakZone: 'safe' },
  ]);
  const targetsRef = useRef<IChannelLevel[]>(easedRef.current);

  useEffect(() => {
    const isIdle = outputLevels.length === 0;
    const channels = isIdle
      ? [
          { levelDb: LEVEL_FLOOR_DB, peakDb: LEVEL_FLOOR_DB },
          { levelDb: LEVEL_FLOOR_DB, peakDb: LEVEL_FLOOR_DB },
        ]
      : outputLevels;
    targetsRef.current = channels.map((channel) => {
      const level = levelFraction(channel.levelDb);
      const peak = levelFraction(channel.peakDb);
      /**
       * This channel's own measured peak, against the ceiling the capture
       * can actually reach.
       *
       * MEASURED, AND ONLY MEASURED. No preamp, no chain gain, no
       * prediction — the loudest sample this channel produced and nothing
       * else. Two calculated approaches were tried before this and both
       * were wrong in ways worth not repeating: judging by the chain's gain
       * alone assumed the input reached full scale, so a +2 dB preamp lit
       * the meter over a quiet passage; and combining the gain with the
       * measurement needed a figure computed by the response chart, which
       * is unmounted whenever another tab is open — so the meter went
       * silent everywhere except the EQ tab.
       *
       * WHY THE LINE IS HERE AND NOT AT ZERO. Equalizer APO's own
       * documentation is explicit that since Vista the Windows audio engine
       * will not let audio clip: it runs a Limiter APO that lowers the
       * overall volume rather than letting the signal rail. Nothing
       * reaching this capture is ever allowed to touch full scale —
       * measured at +20 dB of preamp with the audio audibly breaking up,
       * not one sample in 143,360 got there, and the peak sat between −0.1
       * and −1 dB. So −1 dBFS is where the ceiling actually is from here,
       * and arriving at it is the only signature of an overdriven chain
       * that survives the limiter.
       *
       * `isClipping` stays alongside as the capture's own verdict from
       * railed samples, for anything clipping outside our own chain.
       */
      const isRailed = isClipping || channel.peakDb > METER_CEILING_DB;
      return {
        level,
        peak,
        // Zones from this channel's own decibels. The global flag is
        // deliberately not folded in here for the reason above.
        zone: levelZone(channel.levelDb, false),
        peakZone: isRailed
          ? ('clip' as const)
          : levelZone(channel.peakDb, false),
      };
    });
    if (easedRef.current.length !== targetsRef.current.length) {
      easedRef.current = targetsRef.current.map((channel) => ({ ...channel }));
    }
  }, [isClipping, outputLevels]);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const contextRef = useRef<CanvasRenderingContext2D | null>(null);
  const sizeRef = useRef({ width: 0, height: 0 });
  const drawFrame = useCallback(
    (deltaMs: number) => {
      const canvas = canvasRef.current;
      const context = contextRef.current;
      if (!canvas || !context) {
        return false;
      }
      const boxWidth = sizeRef.current.width;
      const boxHeight = sizeRef.current.height;
      if (boxWidth <= 0 || boxHeight <= 0) {
        return false;
      }

      const ratio = window.devicePixelRatio || 1;
      const backingWidth = Math.max(1, Math.round(boxWidth * ratio));
      const backingHeight = Math.max(1, Math.round(boxHeight * ratio));
      if (canvas.width !== backingWidth || canvas.height !== backingHeight) {
        canvas.width = backingWidth;
        canvas.height = backingHeight;
      }
      context.setTransform(1, 0, 0, 1, 0, 0);
      context.clearRect(0, 0, canvas.width, canvas.height);
      context.setTransform(ratio, 0, 0, ratio, 0, 0);

      const rise = getEaseFactor(deltaMs, LEVEL_ATTACK_MS);
      const fall = getEaseFactor(deltaMs, LEVEL_RELEASE_MS);
      const peakFall = getEaseFactor(deltaMs, PEAK_RELEASE_MS);
      let moving = false;

      for (let i = 0; i < easedRef.current.length; i += 1) {
        const target = targetsRef.current[i];
        // A channel with no reading yet is left at whatever it was holding
        // rather than eased toward nothing, which would drop it to the floor
        // for one frame every time the capture restarts.
        if (target) {
          const eased = easedRef.current[i];
          const levelGap = target.level - eased.level;
          if (Math.abs(levelGap) > 0.002) {
            eased.level += levelGap * (levelGap > 0 ? rise : fall);
            moving = true;
          } else {
            eased.level = target.level;
          }
          const peakGap = target.peak - eased.peak;
          if (Math.abs(peakGap) > 0.002) {
            // Peak rises instantly to the new peak, falls slowly.
            eased.peak += peakGap * (peakGap > 0 ? 1 : peakFall);
            moving = true;
          } else {
            eased.peak = target.peak;
          }
          eased.zone = target.zone;
          eased.peakZone = target.peakZone;
        }
      }

      const channelCount = easedRef.current.length;
      // Layout: two channels centred with a gap between them.
      const totalWidth =
        channelCount * CHANNEL_WIDTH + (channelCount - 1) * CHANNEL_GAP;
      const startX = (boxWidth - totalWidth) / 2;
      // Room at the top for the channel letters, and room at the bottom
      // for the clip rim — that rim is stroked half a pixel outside the
      // strip and carries a ten-pixel glow, so a strip standing on the
      // canvas edge had both sliced flat along the bottom the moment the
      // warning came up.
      const labelBand = 12;
      // Room at the foot for the style name plus the clip rim, which is
      // stroked half a pixel outside the strip and carries a glow — a strip
      // standing on the canvas edge had both sliced flat the moment the
      // warning came up.
      const footBand = 20;
      const rectY = labelBand;
      const rectHeight = Math.max(1, boxHeight - labelBand - footBand);

      for (let i = 0; i < channelCount; i += 1) {
        const rect: IChannelRect = {
          x: startX + i * (CHANNEL_WIDTH + CHANNEL_GAP),
          y: rectY,
          width: CHANNEL_WIDTH,
          height: rectHeight,
        };
        // One track for every style: `$surface-base`, the shell's own
        // colour, so the strip reads as a well cut into the card rather
        // than as something laid on top of it. Nothing about it competes
        // with the reading inside.
        //
        // It replaced a faint green/amber/red zone gradient. That gradient
        // was trying to name the loud region before anything was playing,
        // and the cost was lighting the empty part of the meter — the one
        // part that should never draw the eye. The zones are still said,
        // by the peak marker's colour and by the clip rim, both of which
        // only appear when there is something to say.
        //
        // The corner radius follows the style: the bead column runs in a
        // pill, everything else in a slot with a soft corner.
        const trackRadius = styleRef.current === 'leds' ? rect.width / 2 : 3;
        context.fillStyle = '#0c131d';
        context.beginPath();
        context.roundRect(rect.x, rect.y, rect.width, rect.height, trackRadius);
        context.fill();

        // Clipped: the well itself goes red at the ceiling, and its rim
        // with it.
        //
        // The colour belongs on the TRACK rather than over the reading —
        // painted on top it covered the beads it was warning about, which
        // is the fault that got two earlier versions of this taken out. In
        // the background it is the container that heats up while the
        // reading stays exactly as legible as it was.
        const clipped = easedRef.current[i]?.peakZone === 'clip';
        if (clipped) {
          context.save();
          context.clip();
          const heat = context.createLinearGradient(
            0,
            rect.y,
            0,
            rect.y + rect.height * 0.22,
          );
          heat.addColorStop(0, 'rgba(255, 90, 110, 0.55)');
          heat.addColorStop(1, 'rgba(255, 90, 110, 0)');
          context.fillStyle = heat;
          context.fillRect(rect.x, rect.y, rect.width, rect.height);
          context.restore();
        }

        // A hairline rim, so the well has an edge to be read by rather
        // than dissolving into whatever is behind it. It takes the warning
        // colour while the channel is clipped, so the edge says it too.
        context.strokeStyle = clipped
          ? 'rgba(255, 90, 110, 0.85)'
          : 'rgba(139, 246, 255, 0.14)';
        context.lineWidth = 1;
        context.stroke();

        // A soft outer glow in euphoria — the pane is always lit even when
        // audio is quiet, and the mode announces itself around the strip
        // rather than over the meter's reading.
        if (isEuphoricRef.current) {
          context.save();
          context.shadowColor = 'rgba(255, 60, 172, 0.5)';
          context.shadowBlur = 14;
          context.strokeStyle = 'rgba(255, 60, 172, 0.15)';
          context.lineWidth = 1;
          context.beginPath();
          // The same radius the track was drawn with, so the glow traces
          // the well rather than boxing it.
          context.roundRect(
            rect.x,
            rect.y,
            rect.width,
            rect.height,
            trackRadius,
          );
          context.stroke();
          context.restore();
        }

        drawChannel(
          context,
          rect,
          easedRef.current[i],
          styleRef.current,
          isEuphoricRef.current,
        );
      }

      // The channel letters above each strip. Drawn in canvas rather than
      // as DOM so the whole meter is one image and the labels track the
      // channel rects exactly.
      context.font = '700 8px system-ui, sans-serif';
      context.textAlign = 'center';
      context.textBaseline = 'top';
      context.fillStyle = 'rgba(216, 210, 255, 0.6)';
      const isStereo = channelCount > 1;
      for (let i = 0; i < channelCount; i += 1) {
        const letter = t(channelNameKey(i, isStereo));
        const cx =
          startX + i * (CHANNEL_WIDTH + CHANNEL_GAP) + CHANNEL_WIDTH / 2;
        context.fillText(letter, cx, 1);
      }

      /**
       * The style's name, centred under the strips and always there.
       *
       * It used to appear for two seconds after a click and fade out. That is
       * the wrong shape for this control: the meter is cycled by clicking the
       * meter itself, with nothing else on it to say what the current style
       * is, so a label that leaves means the only way to find out is to click
       * again and change the thing you were asking about.
       *
       * Quiet enough to be furniture rather than a reading — it names the
       * instrument, it is not part of what the instrument says.
       */
      context.save();
      context.font = '800 11px system-ui, sans-serif';
      context.textAlign = 'center';
      context.textBaseline = 'bottom';
      context.fillStyle = 'rgba(216, 210, 255, 0.62)';
      context.fillText(
        styleRef.current.toUpperCase(),
        boxWidth / 2,
        boxHeight - 3,
      );
      context.restore();

      // Some styles are driven by the clock as well as by the reading — the
      // fluid's surface, the gas's drift, the stack's lean and the flow's
      // current all carry on after the level has settled — so the loop has
      // to stay awake for them. Every other style reports honestly and lets
      // it stop through a quiet passage.
      return (
        moving ||
        styleRef.current === 'fluid' ||
        styleRef.current === 'pulse' ||
        styleRef.current === 'needle' ||
        styleRef.current === 'stack' ||
        styleRef.current === 'flow' ||
        // The two hue-cycling ladders, and only in euphoria: at rest they
        // are plain ladders with nothing to redraw between readings.
        ((styleRef.current === 'segments' || styleRef.current === 'leds') &&
          isEuphoricRef.current)
      );
    },
    [t],
  );

  const kickFrames = useSmoothFrames(drawFrame, { isEnabled: true });

  const attachCanvas = useCallback((canvas: HTMLCanvasElement | null) => {
    canvasRef.current = canvas;
    contextRef.current = canvas ? canvas.getContext('2d') : null;
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || typeof ResizeObserver === 'undefined') {
      return undefined;
    }
    const observer = new ResizeObserver((entries) => {
      const box = entries[entries.length - 1]?.contentRect;
      if (!box) {
        return;
      }
      sizeRef.current.width = box.width;
      sizeRef.current.height = box.height;
      kickFrames();
    });
    observer.observe(canvas);
    return () => observer.disconnect();
  }, [kickFrames]);

  // Kick the loop on new frames and on state that changes the drawing.
  useEffect(() => {
    kickFrames();
  }, [isClipping, isEuphoric, kickFrames, outputLevels, style]);

  if (isHidden) {
    return null;
  }

  const isIdle = outputLevels.length === 0;
  return (
    <button
      type="button"
      className={`output-meter${isClipping ? ' is-clipping' : ''}${
        isIdle ? ' is-idle' : ''
      }`}
      aria-label={`${t('graph.meter.aria')} — ${style}`}
      title={`${t('graph.meter.aria')} — ${style}`}
      onClick={cycleStyle}
    >
      <canvas ref={attachCanvas} className="output-meter__canvas" aria-hidden />
    </button>
  );
};

export default OutputLevelMeter;
