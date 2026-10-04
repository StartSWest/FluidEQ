/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

const hundredths = (value: number) => String(Math.round(value * 100) / 100);

/**
 * A band's frequency as words read it: "250 Hz", "1.6 kHz", "12.5 kHz". The
 * graph's band readouts, its handles and the band sliders' names all say it
 * this way, so a screen reader and the eye are told the same thing.
 */
const frequencyText = (hz: number): string =>
  hz >= 1000 ? `${hundredths(hz / 1000)} kHz` : `${hundredths(hz)} Hz`;

export default frequencyText;
