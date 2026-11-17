/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU General Public License as published by
the Free Software Foundation, either version 3 of the License, or
(at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
GNU General Public License for more details.

You should have received a copy of the GNU General Public License
along with this program.  If not, see <https://www.gnu.org/licenses/>.
*/

import { useState } from 'react';
import type { TWorkspaceTab } from '../workspaceTabs';
import { isEqGroupTab } from './workspaceGroups';

/**
 * Where the equaliser's pills stand: in the head above the graph, which
 * draws no rule under them, inside the page, which does, or nowhere.
 */
type TPillsPlace = 'head' | 'page' | 'none';

const pillsPlaceOf = (
  tab: TWorkspaceTab,
  isGraphFirst: boolean,
): TPillsPlace => {
  if (!isEqGroupTab(tab)) {
    return 'none';
  }
  return isGraphFirst ? 'head' : 'page';
};

/**
 * Whether the rule under the equaliser's pills has to fade out or in, because
 * the pills were on screen a moment ago with it or without it (Ivan,
 * 2026-11-17: "when I jump from Bands, which doesn't have it, to Preset, it
 * should appear animated").
 *
 * The two places are two elements — the pills move from the head into the
 * page — so the new one is mounted and there is no colour to transition
 * from: the stylesheet plays the fade as an animation on mount, and this says
 * which mount gets it. Arriving from another place altogether, the pills
 * appear with the rule as it is and nothing fades: a rule fading out under
 * Bands at launch was a line that should never have been seen.
 *
 * Both answers hold for as long as the pills stay where they arrived. The
 * animation runs once, when its element appears; nothing restarts it.
 */
const useSectionRuleFade = (
  tab: TWorkspaceTab,
  isGraphFirst: boolean,
): { isRuleLeaving: boolean; isRuleArriving: boolean } => {
  const place = pillsPlaceOf(tab, isGraphFirst);
  const [places, setPlaces] = useState<{
    now: TPillsPlace;
    before: TPillsPlace;
  }>({ now: place, before: 'none' });
  const before = places.now === place ? places.before : places.now;
  if (places.now !== place) {
    // React's own pattern for a value that depends on the previous render:
    // set during render, re-rendered before anything is committed.
    setPlaces({ now: place, before });
  }
  return {
    isRuleLeaving: place === 'head' && before === 'page',
    isRuleArriving: place === 'page' && before === 'head',
  };
};

export default useSectionRuleFade;
