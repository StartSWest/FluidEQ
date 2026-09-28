/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { isMemberLookId } from 'common/memberScenes';
import { isPremiumLookId } from 'common/scenePacks';
import { useSelectedLookId } from './graphStyle';
import { useSceneTintMode } from './sceneTintStore';

/**
 * Whether the window wears the Backdrop: the mode chosen AND a Plus
 * visualizer to draw in it. The mode alone is remembered across looks, so
 * with a standard look on it the window has nothing behind its panes (Ivan,
 * 2026-09-26: "the transparency slider is enabled which is not right").
 *
 * The one answer to "are the panes floating over a picture": the
 * Transparency slider stands live by it, and the amp is the Stage by it and
 * the 2.0 amp otherwise (`MiniPlayer`). Asked of what is chosen, never of
 * whether the picture has loaded yet, or the amp would change shape while a
 * scene compiles.
 */
const useIsBackdrop = () => {
  const lookId = useSelectedLookId();
  const mode = useSceneTintMode();
  return (
    mode === 'cover' && (isPremiumLookId(lookId) || isMemberLookId(lookId))
  );
};

export default useIsBackdrop;
