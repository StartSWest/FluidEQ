/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import '../styles/TitleRate.scss';

/** "48 kHz", "44.1 kHz", "192 kHz": a whole number of kilohertz has no ".0". */
export const formatRateKhz = (rate: number): string =>
  `${(rate / 1_000).toFixed(1).replace(/\.0$/, '')} kHz`;

/**
 * A sample rate beside a page's title — the DSP page's and the equaliser's,
 * in one face and one format, so the same output reads the same on both.
 */
const TitleRate = ({ rate }: { rate: number }) => (
  <span className="title-rate">{formatRateKhz(rate)}</span>
);

export default TitleRate;
