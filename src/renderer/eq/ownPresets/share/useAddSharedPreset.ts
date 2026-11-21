/* Copyright (C) 2026 Ivan Carmenates Garcia. SPDX-License-Identifier: GPL-3.0-or-later */

import type { IPortableDspChain } from '../../../../common/dsp/dspChainPresetFile';
import {
  applyDspSettings,
  persistDspSettings,
  useDspSettings,
} from '../../../dsp/store';
import { useDspPresetSelection } from '../../../dsp/useDspPresetSelection';
import {
  addUserDspPreset,
  type IUserDspPreset,
} from '../../../dsp/userDspPresets';

/**
 * A shared preset taken in: kept in Yours and put on, the one press a post's
 * card, the import and a link's question each offer.
 *
 * Added, never saved over: a name one of the listener's presets already has
 * is numbered ("Night Drive (2)"), because a stranger's preset that replaced
 * one of the listener's own by sharing its name would be a preset lost to a
 * paste. The DSP page's own Import keeps its rule of replacing.
 */
const useAddSharedPreset = () => {
  const settings = useDspSettings();
  const { apply } = useDspPresetSelection(
    settings,
    applyDspSettings,
    persistDspSettings,
    true,
  );
  return async (preset: IPortableDspChain): Promise<IUserDspPreset> => {
    const saved = await addUserDspPreset(
      preset.name,
      preset.settings,
      preset.curve,
    );
    await apply(saved.id);
    return saved;
  };
};

export default useAddSharedPreset;
