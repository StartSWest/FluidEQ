/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * Each language names itself — "Español", not "Spanish".
 *
 * Same reason as the app's own LanguagePicker: someone looking for their
 * language scans for the word they know, and by definition may not read the
 * language the app is currently in. `Intl.DisplayNames` asked in the target
 * locale returns the endonym, which is why there is no name table here to keep
 * in step across ten locale files.
 */
export const karaokeLanguageName = (code: string): string => {
  try {
    return new Intl.DisplayNames([code], { type: 'language' }).of(code) ?? code;
  } catch {
    // An invalid or unknown tag: show the tag. Never throw out of a label.
    return code;
  }
};
