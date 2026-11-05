/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * The five colours a desktop card is painted with, as this window wears them
 * now (`gameToast.ts` in main draws it).
 *
 * Read rather than remembered: a listener switches theme, and a scene tints
 * the whole window with its own accent over whichever theme that is. The card
 * is drawn by a file on disk that has none of this app's stylesheets, so the
 * answer has to travel with the card, and it has to be the answer at the
 * moment the card is asked for.
 */
const toastColours = (): Record<string, string> => {
  const style = getComputedStyle(document.documentElement);
  const found: Record<string, string> = {};
  const take = (name: string, token: string) => {
    const value = style.getPropertyValue(token).trim();
    if (value !== '') {
      found[name] = value;
    }
  };
  take('accent', '--accent');
  take('panel', '--surface-panel');
  take('base', '--surface-base');
  take('text', '--text-primary');
  take('muted', '--text-muted');
  return found;
};

export default toastColours;
