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
 * all that we have"). The Mic tab is a scope of its own, tuned for a voice
 * at a headset's level (Ivan, 2026-11-24: "we need to have own mic presets
 * for limiter same for all other").
 */
export type TDspPresetScope = 'music' | 'gaming' | 'mic';

/**
 * The one group name every stage's gaming presets file under. A preset in it
 * is offered only on the Gaming tab; every other group only on the DSP page.
 */
export const GAMING_PRESET_GROUP = 'gaming';

/** The Mic tab's presets: offered there alone, as the gaming ones are. */
export const MIC_PRESET_GROUP = 'mic';

/** The group a scope keeps for itself, if it has one. */
const ownGroup = (scope: TDspPresetScope): string | undefined => {
  if (scope === 'gaming') {
    return GAMING_PRESET_GROUP;
  }
  if (scope === 'mic') {
    return MIC_PRESET_GROUP;
  }
  return undefined;
};

const OWN_GROUPS: readonly string[] = [GAMING_PRESET_GROUP, MIC_PRESET_GROUP];

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
export const groupInScope = (
  group: string,
  scope: TDspPresetScope,
): boolean => {
  const own = ownGroup(scope);
  return own === undefined ? !OWN_GROUPS.includes(group) : group === own;
};

/**
 * A stage's groups as a picker in `scope` lists them. On the Gaming tab a
 * stage with no gaming presets (Denoise: a game's own wind and hiss are not
 * noise) lists the DSP page's catalogue, rather than an empty picker. The
 * Mic tab never does: a genre's limiter or EQ is tuned for a record, not a
 * voice, and offering it there was reported as the whole DSP list leaking
 * into the mic's picks (Ivan, 2026-11-24). Every stage the Mic tab shows
 * has mic presets of its own.
 */
export const scopedGroups = <G extends string>(
  groups: readonly G[],
  scope: TDspPresetScope,
): readonly G[] =>
  scope === 'gaming' &&
  !(groups as readonly string[]).includes(GAMING_PRESET_GROUP)
    ? groups.filter((group) => groupInScope(group, 'music'))
    : groups.filter((group) => groupInScope(group, scope));

export const useScopedGroups = <G extends string>(
  groups: readonly G[],
): readonly G[] => scopedGroups(groups, useDspPresetScope());
