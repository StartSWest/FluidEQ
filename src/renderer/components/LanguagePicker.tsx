/*
<AQUA: System-wide parametric audio equalizer interface>
Copyright (C) <2023>  <AQUA Dev Team>

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

import { LOCALES, LocaleCode } from 'common/i18n';
import { useTranslation } from '../utils/I18nContext';
import MenuIcon from '../icons/MenuIcon';
import '../styles/LanguagePicker.scss';

/**
 * Language chooser, living at the bottom of the actions menu.
 *
 * A native select rather than the app's own Dropdown for one reason: this
 * control has to be usable by someone who cannot read the current language.
 * The OS select renders every option in its own script with the platform's
 * font fallback, and it needs no explanation.
 *
 * Each language names itself. "Deutsch", not "German" — someone looking for
 * their own language scans for the word they know.
 */
const LanguagePicker = () => {
  const { locale, setLocale, t } = useTranslation();

  return (
    <div className="language-picker">
      <MenuIcon name="language" />
      <select
        aria-label={t('language.aria')}
        value={locale}
        onChange={(event) => setLocale(event.target.value as LocaleCode)}
      >
        {LOCALES.map((entry) => (
          <option key={entry.code} value={entry.code}>
            {entry.name}
          </option>
        ))}
      </select>
    </div>
  );
};

export default LanguagePicker;
