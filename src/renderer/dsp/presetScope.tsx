/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { createContext, ReactNode, useContext } from 'react';

/**
 * Which presets a rack's pickers offer: the DSP page's (music, film, speech,
 * repair, and the global Gaming chains) or the Gaming tab's, which are tuned
 * for games alone (Ivan, 2026-11-03: "the rack that we show on gaming lab
 * only show gaming tuned presets and the standard dsp shows only music and
 * all that we have").
 */
export type TDspPresetScope = 'music' | 'gaming';

/**
 * The one group name every stage's gaming presets file under. A preset in it
 * is offered only on the Gaming tab; every other group only on the DSP page.
 */
export const GAMING_PRESET_GROUP = 'gaming';

const DspPresetScopeContext = createContext<TDspPresetScope>('music');

/** The Gaming tab wraps its rack in `scope="gaming"`; nothing else needs to. */
export const DspPresetScopeProvider = ({
  scope,
  children,
}: {
  scope: TDspPresetScope;
  children: ReactNode;
}) => (
  <DspPresetScopeContext.Provider value={scope}>
    {children}
  </DspPresetScopeContext.Provider>
);

export const useDspPresetScope = (): TDspPresetScope =>
  useContext(DspPresetScopeContext);

/** Whether a factory group belongs to the scope the picker is in. */
export const groupInScope = (group: string, scope: TDspPresetScope): boolean =>
  (group === GAMING_PRESET_GROUP) === (scope === 'gaming');

/**
 * A stage's groups as a picker in `scope` lists them. A stage with no gaming
 * presets (Denoise: a game's own wind and hiss are not noise) lists its
 * whole catalogue in both places, rather than an empty picker on the Gaming
 * tab.
 */
export const scopedGroups = <G extends string>(
  groups: readonly G[],
  scope: TDspPresetScope,
): readonly G[] =>
  scope === 'gaming' &&
  !(groups as readonly string[]).includes(GAMING_PRESET_GROUP)
    ? groups
    : groups.filter((group) => groupInScope(group, scope));

export const useScopedGroups = <G extends string>(
  groups: readonly G[],
): readonly G[] => scopedGroups(groups, useDspPresetScope());
