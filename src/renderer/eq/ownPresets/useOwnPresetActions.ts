/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import type { ErrorDescription } from '../../../common/errors';
import {
  applyDspSettings,
  persistDspSettings,
  useDspSettings,
} from '../../dsp/store';
import { useDspPresetSelection } from '../../dsp/useDspPresetSelection';
import {
  duplicateUserDspPreset,
  renameUserDspPreset,
} from '../../dsp/userDspPresets';
import { useFluidEqLayers } from '../../utils/FluidEqContext';
import { useTranslation } from '../../utils/I18nContext';
import { showEqPreset } from '../eqLayerTab';
import addFactoryPresetCopy from './factoryPresetCopy';
import { isOwnPresetPlaying, removeOwnPreset } from './ownPresetRemoval';
import usePresetEditActions from './usePresetEditActions';

/**
 * What a preset of the listener's own offers on the Preset tab — its menu and
 * its notes — each kept by main, and a change main could not keep taken back
 * by the store and said as the window says every failure.
 */
const useOwnPresetActions = () => {
  const settings = useDspSettings();
  const { voicing, setGlobalError } = useFluidEqLayers();
  const { apply } = useDspPresetSelection(
    settings,
    applyDspSettings,
    persistDspSettings,
    true,
  );
  const { beginExisting } = usePresetEditActions();
  const { t } = useTranslation();

  const report = (pending: Promise<unknown>) => {
    pending.catch((error) => setGlobalError(error as ErrorDescription));
  };

  return {
    edit: beginExisting,
    /**
     * A factory preset copied into Yours and opened to edit, as Edit opens
     * one of theirs: the copy is kept before the editor opens, so it is
     * theirs whether its edits are saved or discarded.
     */
    editCopy: (presetId: string) =>
      report(
        addFactoryPresetCopy(presetId, t).then((copy) => {
          if (copy) {
            // In Yours, where it now is, when the Preset tab is seen next.
            showEqPreset(copy.id);
            beginExisting(copy.id);
          }
          return copy;
        }),
      ),
    rename: (id: string, name: string) => report(renameUserDspPreset(id, name)),
    duplicate: (id: string) => report(duplicateUserDspPreset(id)),
    remove: (id: string) =>
      report(
        removeOwnPreset(
          id,
          isOwnPresetPlaying(id, settings, voicing)
            ? () => apply('none')
            : undefined,
        ),
      ),
  };
};

export default useOwnPresetActions;
