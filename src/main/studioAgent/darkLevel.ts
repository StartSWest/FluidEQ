/**
 * How dark a picture of a scene is, as numbers the member's AI can be held
 * to.
 *
 * Ivan, 2026-11-11: "make sure the studio agent builds scenes very dark bg
 * for 0 brightness ... all scenes I build always make night at 0 too light;
 * it needs to be fully black look, as dark as the night". A picture alone
 * did not stop it: a grey-blue night looks dark enough to a model that has
 * nothing to compare it with. So a look says how dark the picture's
 * background is, and at Daylight 0 says whether that is night
 * (`darknessLines`).
 *
 * A pixel's brightness here is its brightest channel, 0 to 100. Not its
 * luminance: the complaint is a blue wash, and luminance counts blue at 7%,
 * so a sky of (0, 0, 80) would measure as black while reading on screen as
 * plainly lit. It also makes the number the same whichever order the
 * decoder hands the channels in.
 */

import { NIGHT_BACKGROUND_MOST } from '../../common/sceneDaylight';

export interface IPixels {
  /** Four bytes a pixel, the alpha last; the colour channels in any order. */
  data: Uint8Array | Uint8ClampedArray;
  width: number;
  height: number;
}

export interface IDarkLevel {
  /**
   * The background: the mean brightness of the darkest 60% of the picture,
   * 0 (black) to 100. The share a scene's sky, ground and water take up
   * when its subject and its lights have the rest.
   */
  background: number;
  /** The share of the picture, 0 to 100, at 60% brightness or more: what is lit. */
  lit: number;
}

/** The share of the picture counted as its background. */
export const BACKGROUND_SHARE = 0.6;
/** A pixel this bright or brighter, of 255, is lit: a lamp, the moon, a glow. */
const LIT_FROM = 153;

const round1 = (value: number) => Math.round(value * 10) / 10;

export const darkLevel = ({ data, width, height }: IPixels): IDarkLevel => {
  const pixels = Math.min(width * height, Math.floor(data.length / 4));
  if (pixels <= 0) {
    return { background: 0, lit: 0 };
  }
  const counts = new Uint32Array(256);
  for (let at = 0; at < pixels * 4; at += 4) {
    counts[Math.max(data[at], data[at + 1], data[at + 2])] += 1;
  }
  // The darkest 60%, read off the count of each brightness from black up.
  const wanted = Math.max(1, Math.round(pixels * BACKGROUND_SHARE));
  let taken = 0;
  let sum = 0;
  for (let value = 0; value < 256 && taken < wanted; value += 1) {
    const here = Math.min(counts[value], wanted - taken);
    taken += here;
    sum += here * value;
  }
  let lit = 0;
  for (let value = LIT_FROM; value < 256; value += 1) {
    lit += counts[value];
  }
  return {
    background: round1((sum / taken / 255) * 100),
    lit: round1((lit / pixels) * 100),
  };
};

const percent = (value: number) => `${value}%`;

/**
 * What a look says of its picture's darkness: the numbers always, and at
 * Daylight 0 whether it is night. The verdict is made in silence, where
 * nothing the music lights is on: with music the same scene measures
 * lighter, rightly, and is sent to look again without it.
 */
export const darknessLines = (
  level: IDarkLevel,
  look: { daylight: number | undefined; silent: boolean },
): string[] => {
  const numbers = `How dark this picture is: its background (the darkest 60% of it) is at ${percent(level.background)} of full brightness, 0 black to 100 white, and ${percent(level.lit)} of the picture is lit (60% or brighter).`;
  if (look.daylight === undefined || look.daylight > 0) {
    return [numbers];
  }
  if (!look.silent) {
    return [
      numbers,
      'Night check: this look had music, and the night is checked in silence, where only the scene\'s own lights are on. Look again with sound "silence" and daylight 0.',
    ];
  }
  return [
    numbers,
    level.background <= NIGHT_BACKGROUND_MOST
      ? `Night check (daylight 0, silence): PASSES. The background is at or under ${percent(NIGHT_BACKGROUND_MOST)}: as dark as night.`
      : `Night check (daylight 0, silence): TOO LIGHT. The background is at ${percent(level.background)} and a night's is ${percent(NIGHT_BACKGROUND_MOST)} or under. Take the sky, the ground and the water down to near black, and leave bright only what gives off light: the moon, stars, lamps, windows, an aurora, the music's own element. Look for what is still on at 0 - an ambient light term, fog, mist or haze, a tone curve lifting the blacks, a blend that keeps some of the day's colour - fix it, save, and look again. Do not tell the member the night is done until this passes.`,
  ];
};
