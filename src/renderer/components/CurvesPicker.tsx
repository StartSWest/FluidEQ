/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { useTranslation } from '../utils/I18nContext';
import ActiveLayersPicker from './ActiveLayersPicker';
import useActiveLayers from './useActiveLayers';

/**
 * The Bands page's applied layers as "Curves", among its tools (Ivan,
 * 2026-09-27: "make applied filters always on curves dropdown", then
 * "switch curves with game engine"): every line the graph draws, a dot of
 * each one's colour, the chips in its menu as rows. Nothing while nothing is
 * applied, rather than a dropdown with an empty menu.
 */
const CurvesPicker = () => {
  const { t } = useTranslation();
  const active = useActiveLayers();
  return active.layers.length === 0 ? null : (
    <ActiveLayersPicker active={active} label={t('graph.curves')} />
  );
};

export default CurvesPicker;
