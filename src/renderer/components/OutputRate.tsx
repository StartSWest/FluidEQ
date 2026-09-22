/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import useOutputRate from '../utils/useOutputRate';
import TitleRate from './TitleRate';

/**
 * The rate of the output being listened to, beside the equaliser's name, as
 * the DSP page has its own beside its title. Its own component, so the page
 * around it is not redrawn when the output changes rate.
 */
const OutputRate = () => {
  const rate = useOutputRate();
  return rate === undefined ? null : <TitleRate rate={rate} />;
};

export default OutputRate;
