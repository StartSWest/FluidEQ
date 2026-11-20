/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import MenuIcon from '../../icons/MenuIcon';
import { useTranslation } from '../../utils/I18nContext';
import { openNewPresetDialog } from './newPresetDialogState';

/**
 * The first tile of Yours, there even when Yours is empty: the way to a
 * preset of the listener's own, drawn as a place for one rather than as
 * one — a dashed edge and the accent's word.
 */
const NewPresetTile = ({ isDisabled }: { isDisabled: boolean }) => {
  const { t } = useTranslation();
  return (
    <button
      type="button"
      className="eq-preset-tab__tile own-preset-new-tile"
      disabled={isDisabled}
      onClick={openNewPresetDialog}
    >
      <MenuIcon name="plus" className="eq-preset-tab__glyph" />
      <span className="eq-preset-tab__words">
        <strong>{t('eq.own.new')}</strong>
        <span>{t('eq.own.newHint')}</span>
      </span>
    </button>
  );
};

export default NewPresetTile;
