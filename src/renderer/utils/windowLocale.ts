/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { DEFAULT_LOCALE, LocaleCode, resolveLocale } from 'common/i18n';

/**
 * The window's language for code outside React, apart from the context that
 * holds it for components (`I18nContext.tsx`): the graph's look store reads
 * it to put the scenes in their names' order (`lookOrder.ts`), and that
 * store is loaded where React is not, so it cannot reach the context's
 * module, which builds a React context as it loads.
 */

export const LOCALE_STORAGE_KEY = 'fluideq.locale';

/**
 * First run picks the language from the machine, not from a menu.
 *
 * Someone whose Windows is in Portuguese should not have to find a language
 * setting written in English before the app makes sense. Once they choose one
 * explicitly, that choice wins forever after — the stored value is only ever
 * written by the picker.
 */
export const readInitialLocale = (): LocaleCode => {
  try {
    const stored = window.localStorage.getItem(LOCALE_STORAGE_KEY);
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

/** The language picked in this window, once a pick has been made here. */
let pickedLocale: LocaleCode | undefined;

/** Told by the provider the moment a pick switches the window's language. */
export const noteLocalePicked = (locale: LocaleCode) => {
  pickedLocale = locale;
};

/**
 * The language the window speaks: what was picked here, or until then what
 * the provider started from. The picker sorts by the context's language and
 * the arrows' walk by this one, and the two have to agree.
 */
export const getWindowLocale = (): LocaleCode =>
  pickedLocale ?? readInitialLocale();
