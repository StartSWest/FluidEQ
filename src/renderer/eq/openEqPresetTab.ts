/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { setEqLayerTab } from './eqLayerTab';
import { openPresetEditPage } from './ownPresets/presetEditPages';

/**
 * The EQ page, on its Preset tab: where every preset the quick picks offer
 * is laid out with what it does. The tab is chosen first, so the page opens
 * on it rather than on the tab it was left on; the shell owns which page is
 * open and is asked the way a preset being edited asks it.
 */
const openEqPresetTab = (): void => {
  setEqLayerTab('preset');
  openPresetEditPage('eq');
};

export default openEqPresetTab;
