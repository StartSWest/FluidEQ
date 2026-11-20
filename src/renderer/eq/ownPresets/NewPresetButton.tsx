/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import MenuIcon from '../../icons/MenuIcon';
import { useFluidEqLayers } from '../../utils/FluidEqContext';
import { useTranslation } from '../../utils/I18nContext';
import Button from '../../widgets/Button';
import { openNewPresetDialog } from './newPresetDialogState';

/**
 * New preset, among the Preset tab's tools beside Search: the same word as
 * the tile at the head of Yours, for a listener who is in another group.
 * Its word in the accent, as the one tool here that makes something.
 */
const NewPresetButton = () => {
  const { t } = useTranslation();
  const { isEnabled, isBlockingError } = useFluidEqLayers();
  return (
    <Button
      ariaLabel={t('eq.own.new')}
      title={t('eq.own.newHint')}
      isDisabled={isBlockingError || !isEnabled}
      className="small subtle own-preset-new-tool"
      handleChange={openNewPresetDialog}
    >
      <MenuIcon name="plus" className="eq-toolbar__icon" />
      <span className="eq-toolbar__word">{t('eq.own.new')}</span>
    </Button>
  );
};

export default NewPresetButton;
