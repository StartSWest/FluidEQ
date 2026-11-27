/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { parseCssColour } from '../utils/oklab';
import { getRainbowStops } from '../utils/rainbowPalette';
import { readAccent, readAccentLight, readSurface } from '../utils/theme';

/**
 * The share card's colours, read from the window as the header paints them.
 *
 * The header's logo and name run from the accent's greener end through the
 * accent to the window's second colour (`SignalBrand.scss`), and those ends
 * are relative colours (`oklch(from var(--accent) ...)`) that a canvas cannot
 * be handed as written. So each is named on a probe inside a hidden header
 * logo, as the taskbar icon reads them (`taskbarIconArt.ts`), and painted on
 * the card's own first pixel to be read back as channels, before the card is
 * painted over it.
 *
 * Every one is lifted to a light step of its own hue first (`lifted`). The
 * card is always dark, and the white window's accent is a deep one chosen to
 * stand on white (`filledFace` in `windowFill.ts`): read as it is, the name,
 * the logo and the site went murky on the card. It is the rule the pet's fur
 * already follows on a light window (`--pet-tone`, `App.scss`), and a dark
 * window's colours, already that light, pass through unchanged.
 *
 * Where nothing can be resolved — a test DOM has neither a
 * stylesheet nor pixels — the accent stands in.
 */

export type TChannels = readonly [number, number, number];

export interface IShareCardInks {
  /** The run's three stops: the greener end, the accent, the second colour. */
  start: TChannels;
  accent: TChannels;
  active: TChannels;
  /** The accent's light: the score's foot, the site, the pet's speakers. */
  light: TChannels;
  /** The logo's wave, `--logo-1` to `--logo-5`. */
  logo: readonly TChannels[];
  /** The pet's fur (`--pet-tone`), as the titlebar paints her. */
  petTone: TChannels;
  /**
   * The colours of the light around her: Colourful mode's palette while it
   * is on, otherwise the run.
   */
  sparkle: readonly TChannels[];
}

const channelsOf = (colour: string): TChannels | undefined => {
  const parsed = parseCssColour(colour);
  return parsed
    ? [parsed.rgb[0] * 255, parsed.rgb[1] * 255, parsed.rgb[2] * 255]
    : undefined;
};

/** `#rrggbb` for a run of channels. */
export const hexOf = (channels: TChannels): string =>
  `#${channels
    .map((channel) =>
      Math.round(Math.min(255, Math.max(0, channel)))
        .toString(16)
        .padStart(2, '0'),
    )
    .join('')}`;

export const alphaOf = (channels: TChannels, alpha: number): string =>
  `rgba(${channels.map((channel) => Math.round(channel)).join(', ')}, ${alpha})`;

const LOGO_SHARES = [0, 11, 22, 33, 44] as const;

/**
 * `css` at OKLCH lightness `floor` or above, its chroma and hue kept: 0.74 is
 * the light end of the accents a dark window carries (Ocean's cyan is
 * 0.82), so a deep accent comes up to where those already are.
 */
const lifted = (css: string, floor = 0.74) =>
  `oklch(from ${css} max(l, ${floor}) c h)`;

export const readShareCardInks = (
  pixel: CanvasRenderingContext2D,
  euphoric: boolean,
  doc: Document = document,
): IShareCardInks => {
  // What the window says, for a context with no pixels to resolve on.
  const accentText = readAccent(1, '#32e1eb');
  const accentSaid = channelsOf(accentText) ?? [50, 225, 235];
  const lightSaid = channelsOf(readAccentLight(1, '#a9faff')) ?? [
    169, 250, 255,
  ];
  const activeSaid =
    channelsOf(readSurface('--active', accentText)) ?? accentSaid;

  const mark = doc.createElement('div');
  mark.className = 'brand-mark brand-mark--signal';
  mark.style.display = 'none';
  doc.body.append(mark);
  const resolve = (css: string, fallback: TChannels): TChannels => {
    const probe = doc.createElement('i');
    probe.style.color = css;
    mark.append(probe);
    const computed = getComputedStyle(probe).color;
    probe.remove();
    if (!computed) {
      return fallback;
    }
    pixel.save();
    pixel.setTransform(1, 0, 0, 1, 0, 0);
    pixel.globalAlpha = 1;
    pixel.globalCompositeOperation = 'copy';
    pixel.fillStyle = '#000';
    pixel.fillStyle = computed;
    pixel.fillRect(0, 0, 1, 1);
    // A context that keeps no pixels (a recording one in the tests) answers
    // nothing here.
    const image: ImageData | undefined = pixel.getImageData(0, 0, 1, 1);
    pixel.restore();
    return image ? [image.data[0], image.data[1], image.data[2]] : fallback;
  };
  try {
    const accent = resolve(lifted('var(--accent)'), accentSaid);
    const start = resolve(lifted('var(--accent-start)'), accent);
    const logo = LOGO_SHARES.map((share) =>
      resolve(
        lifted(
          `color-mix(in oklab, var(--accent-start), var(--accent) ${share}%)`,
        ),
        accent,
      ),
    );
    const light = resolve(lifted('var(--accent-light)', 0.9), lightSaid);
    const active = resolve(lifted('var(--active)'), activeSaid);
    const petTone = resolve('var(--pet-tone, #4ad3dc)', [74, 211, 220]);
    const stops = getRainbowStops();
    // A light window wears the palette's deep side (`paletteForSide`); on
    // the dark card it is lifted like every other colour.
    const palette = euphoric
      ? [stops[0], stops[2], stops[4], stops[6]].flatMap((stop) => {
          const said = channelsOf(stop);
          return said ? [resolve(lifted(stop), said)] : [];
        })
      : [];
    return {
      start,
      accent,
      active,
      light,
      logo,
      petTone,
      sparkle: palette.length > 0 ? palette : [start, light, active],
    };
  } finally {
    mark.remove();
  }
};
