/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { isMemberLookId } from 'common/memberScenes';
import { isPremiumLookId } from 'common/scenePacks';
import { useSelectedLookId } from './graphStyle';

/**
 * Whether the look chosen is a Plus visualizer, which lends the window its
 * own colours, rather than a standard one, which the window's Tint colours
 * (`windowTint.ts`).
 */
const useIsSceneLook = () => {
  const lookId = useSelectedLookId();
  return isPremiumLookId(lookId) || isMemberLookId(lookId);
};

export default useIsSceneLook;
