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

import {
  createContext,
  ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import {
  DEFAULT_LOCALE,
  LocaleCode,
  resolveLocale,
  Translate,
  translate,
  TranslateVars,
  TranslationKey,
} from 'common/i18n';

const STORAGE_KEY = 'fluideq.locale';

interface II18nContext {
  locale: LocaleCode;
  setLocale: (next: LocaleCode) => void;
  t: Translate;
}

const I18nContext = createContext<II18nContext | undefined>(undefined);

/**
 * First run picks the language from the machine, not from a menu.
 *
 * Someone whose Windows is in Portuguese should not have to find a language
 * setting written in English before the app makes sense. Once they choose one
 * explicitly, that choice wins forever after — the stored value is only ever
 * written by the picker.
 */
const readInitialLocale = (): LocaleCode => {
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (stored) {
      return resolveLocale(stored);
    }
  } catch {
    // Private mode, a locked-down profile, a test environment without storage.
    // Falling through to the browser language is the right answer for all of
    // them, and none of them is worth an error on screen.
  }
  return resolveLocale(
    typeof navigator === 'undefined' ? DEFAULT_LOCALE : navigator.language,
  );
};

export const I18nProvider = ({ children }: { children: ReactNode }) => {
  const [locale, setLocaleState] = useState<LocaleCode>(readInitialLocale);

  // Assistive tech and the browser's own hyphenation both read this, and CJK
  // font fallback depends on it.
  useEffect(() => {
    document.documentElement.lang = locale;
  }, [locale]);

  const setLocale = useCallback((next: LocaleCode) => {
    setLocaleState(next);
    try {
      window.localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // The language still changes for this session; it just will not be
      // remembered. Better than refusing to switch at all.
    }
  }, []);

  const value = useMemo<II18nContext>(
    () => ({
      locale,
      setLocale,
      t: (key: TranslationKey, vars?: TranslateVars) =>
        translate(locale, key, vars),
    }),
    [locale, setLocale],
  );

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
};

/**
 * The hook every component uses.
 *
 * Falls back to English rather than throwing when there is no provider above
 * it. A missing provider is a wiring mistake that should be fixed, but it must
 * not be the reason a unit test of a button cannot render, and it must not
 * turn a translated label into a blank screen in production.
 */
export const useTranslation = (): II18nContext => {
  const context = useContext(I18nContext);
  return (
    context ?? {
      locale: DEFAULT_LOCALE,
      setLocale: () => undefined,
      t: (key: TranslationKey, vars?: TranslateVars) =>
        translate(DEFAULT_LOCALE, key, vars),
    }
  );
};
