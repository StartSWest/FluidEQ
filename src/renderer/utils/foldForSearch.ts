/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * Everything a search has to ignore to match the way a person expects.
 *
 * Case and accents both: somebody looking for "Clásica" types "clasica", and
 * somebody looking for "Lo-fi" types "lofi". Latin-1 decomposition covers every
 * language this app ships in that uses accents at all — the CJK locales do not
 * decompose and do not need to, and are kept as they are rather than dropped,
 * so a name in Chinese or Russian can still be found by typing it.
 */
import { foldSearchText } from '../../common/searchText';

export default foldSearchText;
