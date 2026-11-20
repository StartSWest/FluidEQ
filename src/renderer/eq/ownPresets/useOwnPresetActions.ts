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

  const report = (pending: Promise<unknown>) => {
    pending.catch((error) => setGlobalError(error as ErrorDescription));
  };

  return {
    edit: beginExisting,
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
