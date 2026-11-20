/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { useCallback, useEffect, useState } from 'react';
import { DSP_PRESETS, DSP_PRESET_GROUPS } from '../../common/dsp/presets';
import VoicingIcon from '../icons/VoicingIcon';
import { useTranslation } from '../utils/I18nContext';
import type { IRichPickEntry } from '../widgets/RichPick';
import {
  DSP_PRESETS_CHANGED,
  readFavouriteDspPresets,
} from './favouriteDspPresets';
import { SAVED_GROUP, eqPresetGroupLabel } from './presetPickEntries';
import { type TDspPresetScope, scopedGroups } from './presetScope';
import {
  NONE_CHAIN_ID,
  QUICK_DSP_PRESETS,
  inListOrder,
  dspPresetHint as chainHint,
  dspPresetName,
  dspPresetRowHint,
} from './dspPresetCatalog';
import { IUserDspPreset, readUserDspPresets } from './userDspPresets';

/** None's own place, first and without a heading. */
const NONE_GROUP = '';

/** Where the starred presets file: above the listener's own, under None. */
const FAVOURITE_GROUP = 'favourites';

/**
 * Where the usual chains file, straight under the starred ones: the same
 * chains in the same order, under the same heading, as the quick pick on the
 * equaliser's page (`QUICK_DSP_PRESETS`).
 */
const QUICK_GROUP = 'quick';

/**
 * The whole chain list as the DSP page's picker shows it — None, the starred
 * ones, the usual ones, the listener's own and every group — for every list
 * of chains that has to agree with it: the DSP page's bar
 * (`DspChainPresetBar`) and a sound picked in the Library
 * (`LibrarySoundMenu`). `ordered` is the order the arrows beside a pill walk.
 */
const useDspChainEntries = (scope: TDspPresetScope) => {
  const { t } = useTranslation();
  const [userPresets, setUserPresets] = useState<IUserDspPreset[]>(() =>
    readUserDspPresets(),
  );
  const [favourites, setFavourites] = useState<string[]>(() =>
    readFavouriteDspPresets(),
  );
  const refreshUserPresets = useCallback(
    () => setUserPresets(readUserDspPresets()),
    [],
  );
  useEffect(() => {
    const changed = () => {
      setUserPresets(readUserDspPresets());
      setFavourites(readFavouriteDspPresets());
    };
    window.addEventListener(DSP_PRESETS_CHANGED, changed);
    window.addEventListener('storage', changed);
    return () => {
      window.removeEventListener(DSP_PRESETS_CHANGED, changed);
      window.removeEventListener('storage', changed);
    };
  }, []);

  const filed: IRichPickEntry[] = [
    ...userPresets.map((preset) => ({
      id: preset.id,
      name: preset.name,
      hint: chainHint(preset, t),
      group: SAVED_GROUP,
      icon: <VoicingIcon className="rich-pick__glyph" />,
    })),
    // The Gaming tab's chains stay on the Gaming tab (`presetScope.tsx`).
    ...scopedGroups(DSP_PRESET_GROUPS, scope).flatMap((group) =>
      DSP_PRESETS.filter((preset) => preset.group === group).map((preset) => ({
        id: preset.id,
        name: dspPresetName(preset, t),
        hint: dspPresetRowHint(preset, t),
        group,
        icon: (
          <VoicingIcon profileId={preset.id} className="rich-pick__glyph" />
        ),
      })),
    ),
  ];
  // The starred ones first, in the list's own order (`inListOrder`), then the
  // usual ones in the order the equaliser's quick pick gives them, each under
  // a heading of its own — once each: a preset listed twice is two rows lit at
  // once and an arrow that visits it twice.
  const lifted = (ids: readonly string[], group: string): IRichPickEntry[] =>
    ids.flatMap((id) => {
      const entry = filed.find((one) => one.id === id);
      return entry ? [{ ...entry, group }] : [];
    });
  // None above all of them, the starred ones included, with no heading and no
  // star, as on the equaliser's picker: it is the absence of a choice, and
  // a star it was given before it stood here is not a second place for it.
  const starred = inListOrder(filed)
    .filter(
      (entry) => entry.id !== NONE_CHAIN_ID && favourites.includes(entry.id),
    )
    .map((entry) => entry.id);
  const usual = QUICK_DSP_PRESETS.filter((id) => !starred.includes(id));
  const entries: IRichPickEntry[] = [
    ...lifted([NONE_CHAIN_ID], NONE_GROUP),
    ...lifted(starred, FAVOURITE_GROUP),
    ...lifted(usual, QUICK_GROUP),
    ...filed.filter(
      (entry) =>
        entry.id !== NONE_CHAIN_ID &&
        !starred.includes(entry.id) &&
        !usual.includes(entry.id),
    ),
  ];
  const ordered = entries.map((entry) => entry.id);
  const groupLabel = (group: string): string => {
    if (group === NONE_GROUP) {
      return '';
    }
    if (group === FAVOURITE_GROUP) {
      return t('library.playlist.favorites');
    }
    return group === QUICK_GROUP
      ? t('dsp.quick.classics')
      : eqPresetGroupLabel(group, t);
  };

  return {
    entries,
    ordered,
    groupLabel,
    userPresets,
    refreshUserPresets,
    favourites,
    setFavourites,
  };
};

export default useDspChainEntries;
