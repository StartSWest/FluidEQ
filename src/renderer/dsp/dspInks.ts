/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU General Public License version 3 or later.
*/

import { readSurface, type TSurfaceName } from '../utils/theme';

/**
 * The DSP graphs' own drawing colours that follow a Plus scene, as `r, g, b`
 * for the canvas to add its alpha to. Each is a token on the root (App.scss):
 * the colour these were always drawn in, and under a scene's tint one of the
 * scene's colours, so a tinted DSP page draws in two of them instead of one.
 * The series that mean something of their own — the noise floor's amber,
 * hum's sky blue, the clicks' green — keep their colours, because the
 * legends name them by colour.
 */

const HEX = /^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i;

const channelsOf = (name: TSurfaceName, fallback: string) => {
  const match = HEX.exec(readSurface(name, ''));
  if (!match) {
    return fallback;
  }
  const [, red, green, blue] = match;
  return `${parseInt(red, 16)}, ${parseInt(green, 16)}, ${parseInt(blue, 16)}`;
};

/**
 * What a stage outputs — the forged bass, the punch's sustain, the
 * maximizer's wave, the master's short-term loudness: teal, or the scene's
 * "on" colour.
 */
export const baseCurveInk = () =>
  channelsOf('--dsp-base-curve', '64, 214, 200');

/** The spectrum a stage passes on, under its curves: white, or the scene's "on" colour. */
export const outputInk = () => channelsOf('--dsp-output', '255, 255, 255');

/** What a stage actually did to the sound — the hiss taken off: violet, or the scene's accent. */
export const appliedInk = () => channelsOf('--dsp-applied', '197, 138, 249');

/**
 * The second series beside a stage's output — the bass forge's low side,
 * the punch's ducking, the exciter's low band: sky blue, or the scene's
 * light accent.
 */
export const skyInk = () => channelsOf('--dsp-sky', '84, 200, 255');

/** The stereo field and the width drawn from it: pale blue, or the scene's "on" colour. */
export const fieldInk = () => channelsOf('--dsp-field', '150, 205, 255');

/**
 * The EQ page's live spectrum under the curve: the accent, or the scene's
 * "on" colour, so the curve and what it shapes are two colours.
 */
export const spectrumInk = () => channelsOf('--dsp-spectrum', '0, 229, 207');

/** The same colours for the legends, which the stylesheet can mix. */
export const BASE_CURVE_CSS = 'var(--dsp-base-curve)';
export const SKY_CSS = 'var(--dsp-sky)';
export const SPECTRUM_CSS = 'var(--dsp-spectrum)';
