/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import {
  FOOTSTEPS_PRESET_GROUPS,
  IFootstepsPreset,
  TFootstepsPresetGroup,
} from '../../common/dsp/footstepsPresets';
import {
  gamingProfileRef,
  IYoursGamingProfile,
  READY_GAMING_PROFILES,
  readyGamingProfileId,
  yoursGamingProfileId,
} from '../../common/gaming';
import type { Translate } from '../../common/i18n';
import type { TranslationKey } from '../../common/i18n/en';
import { dspPresetCatalog } from '../dsp/dspPresetCatalog';

export type TGamingProfileKind = 'title' | 'kind' | 'yours' | 'chain' | 'gone';

export interface IGamingProfileEntry {
  id: string;
  name: string;
  kind: TGamingProfileKind;
  /** Which list it files under: `yours`, `kinds`, or a group of titles. */
  group: 'yours' | TFootstepsPresetGroup;
  /** A kind's games, a title's group, or where one of yours came from. */
  hint: string;
}

/** The kind or title a ready-made profile is named for. */
export const readyName = (preset: IFootstepsPreset, t: Translate): string =>
  preset.title ?? t(preset.labelKey as TranslationKey);

/** The Game filter's own group names, written out whole for the key guard. */
export const GAMING_GROUP_LABEL_KEYS: Record<
  TFootstepsPresetGroup,
  TranslationKey
> = {
  kinds: 'dsp.footstepsPresetGroup.kinds',
  competitive: 'dsp.footstepsPresetGroup.competitive',
  battle: 'dsp.footstepsPresetGroup.battle',
  tactical: 'dsp.footstepsPresetGroup.tactical',
  moba: 'dsp.footstepsPresetGroup.moba',
  rpg: 'dsp.footstepsPresetGroup.rpg',
  story: 'dsp.footstepsPresetGroup.story',
};

const readyEntry = (
  preset: IFootstepsPreset,
  t: Translate,
): IGamingProfileEntry => ({
  id: readyGamingProfileId(preset.id),
  name: readyName(preset, t),
  kind: preset.title === undefined ? 'kind' : 'title',
  group: preset.group,
  hint:
    preset.title === undefined && preset.hintKey
      ? t(preset.hintKey as TranslationKey)
      : t(GAMING_GROUP_LABEL_KEYS[preset.group]),
});

const yoursEntry = (
  profile: IYoursGamingProfile,
  t: Translate,
): IGamingProfileEntry => ({
  id: yoursGamingProfileId(profile.id),
  name: profile.name,
  kind: 'yours',
  group: 'yours',
  hint: t('gaming.profiles.savedFrom', { game: profile.from }),
});

/** Every profile a game can start from: the listener's own first. */
export const gamingProfileEntries = (
  yours: readonly IYoursGamingProfile[],
  t: Translate,
): IGamingProfileEntry[] => [
  ...yours.map((profile) => yoursEntry(profile, t)),
  ...FOOTSTEPS_PRESET_GROUPS.flatMap((group) =>
    READY_GAMING_PROFILES.filter((preset) => preset.group === group).map(
      (preset) => readyEntry(preset, t),
    ),
  ),
];

/** One profile id, named for the screen, including ones no list offers. */
export const gamingProfileEntry = (
  id: string,
  yours: readonly IYoursGamingProfile[],
  t: Translate,
): IGamingProfileEntry => {
  const ref = gamingProfileRef(id);
  if (ref?.kind === 'ready') {
    return readyEntry(ref.preset, t);
  }
  if (ref?.kind === 'yours') {
    const own = yours.find((profile) => profile.id === ref.id);
    if (own) {
      return yoursEntry(own, t);
    }
  }
  if (ref?.kind === 'chain') {
    // A row from before the Gaming Lab, which named a DSP chain.
    const chain = dspPresetCatalog(t).find((one) => one.id === ref.chainId);
    if (chain) {
      return {
        id,
        name: chain.name,
        kind: 'chain',
        group: 'kinds',
        hint: t('gaming.profile.kind.chain'),
      };
    }
  }
  return {
    id,
    name: t('gaming.profile.gone'),
    kind: 'gone',
    group: 'kinds',
    hint: '',
  };
};

/** The chip beside a profile's name, by what kind of profile it is. */
export const GAMING_KIND_LABEL_KEYS: Record<
  TGamingProfileKind,
  TranslationKey | undefined
> = {
  title: 'gaming.profile.kind.title',
  kind: 'gaming.profile.kind.kind',
  yours: 'gaming.profile.kind.yours',
  chain: 'gaming.profile.kind.chain',
  gone: undefined,
};
