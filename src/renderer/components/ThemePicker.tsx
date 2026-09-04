/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU General Public License version 3 or later.
*/

import { useMemo } from 'react';
import MenuIcon from '../icons/MenuIcon';
import { useTranslation } from '../utils/I18nContext';
import { THEMES, TTheme, setTheme, useTheme } from '../utils/theme';
import Dropdown from '../widgets/Dropdown';

/**
 * The theme, chosen from the tools menu the same way the language is: an
 * icon and a select on one row, above the language row it mirrors.
 */
const ThemePicker = () => {
  const { t } = useTranslation();
  const theme = useTheme();

  const options = useMemo(
    () =>
      THEMES.map((entry) => {
        const label = t(`theme.${entry}`);
        return { value: entry, label, display: label };
      }),
    [t],
  );

  return (
    <div className="language-picker theme-picker">
      <MenuIcon name="theme" />
      <Dropdown
        name={t('theme.aria')}
        menuClassName="language-picker-menu"
        options={options}
        value={theme}
        handleChange={(next) => setTheme(next as TTheme)}
        isDisabled={false}
        placement="down"
      />
    </div>
  );
};

export default ThemePicker;
