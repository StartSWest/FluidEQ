/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU General Public License as published by
the Free Software Foundation, either version 3 of the License, or
(at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
GNU General Public License for more details.

You should have received a copy of the GNU General Public License
along with this program.  If not, see <https://www.gnu.org/licenses/>.
*/

import { useMemo } from 'react';
import { LOCALES, LocaleCode } from 'common/i18n';
import { useTranslation } from '../utils/I18nContext';
import MenuIcon from '../icons/MenuIcon';
import Dropdown from '../widgets/Dropdown';
import '../styles/LanguagePicker.scss';

/**
 * Language chooser, living at the bottom of the actions menu.
 *
 * The app's own Dropdown, not a native select. A select was used here for a
 * while on the theory that the platform's own font fallback was needed to draw
 * ten scripts, but Chromium falls back per character on its own — the shell
 * font stack ends in a generic `sans-serif` and the missing glyphs resolve
 * through it either way. What the native control did do was refuse to look
 * like anything else in the app.
 *
 * Each language names itself. "Deutsch", not "German" — someone looking for
 * their own language scans for the word they know, and by definition cannot
 * read the language the app is currently in.
 */
const LanguagePicker = () => {
  const { locale, setLocale, t } = useTranslation();

  const options = useMemo(
    () =>
      LOCALES.map((entry) => ({
        value: entry.code,
        label: entry.name,
        // `lang` so the renderer picks the right face for the script rather
        // than whichever one the surrounding English left it in — it is the
        // difference between the Han characters being drawn Chinese or
        // Japanese, and they are not the same shapes.
        display: <span lang={entry.code}>{entry.name}</span>,
      })),
    [],
  );

  return (
    <div className="language-picker">
      <MenuIcon name="language" />
      <Dropdown
        name={t('language.aria')}
        menuClassName="language-picker-menu"
        options={options}
        value={locale}
        handleChange={(newValue) => setLocale(newValue as LocaleCode)}
        isDisabled={false}
        // Downward. The menu hangs off the titlebar at the top of the window,
        // so there is a whole screen below and almost nothing above — opening
        // up put the list over the menu it belongs to.
        placement="down"
      />
    </div>
  );
};

export default LanguagePicker;
