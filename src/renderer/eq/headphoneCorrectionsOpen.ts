/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * Asked of the shell by a control that is not on the Headphone corrections
 * page - the Curves menu on the Bands page - to open it: the shell owns which
 * page is open, and the control has no other way to reach it.
 */
export const OPEN_HEADPHONE_CORRECTIONS_EVENT =
  'fluideq-open-headphone-corrections';

/** Which of the page's two lists to show, when the asker cares. */
export type TCorrectionLibrary = 'opra' | 'mine';

export const openHeadphoneCorrections = (
  library?: TCorrectionLibrary,
): void => {
  window.dispatchEvent(
    new CustomEvent<TCorrectionLibrary | undefined>(
      OPEN_HEADPHONE_CORRECTIONS_EVENT,
      { detail: library },
    ),
  );
};

/** The list an open asked for, read from its event. */
export const libraryAskedFor = (
  event: Event,
): TCorrectionLibrary | undefined => {
  if (!(event instanceof CustomEvent)) {
    return undefined;
  }
  const { detail } = event as CustomEvent<unknown>;
  return detail === 'opra' || detail === 'mine' ? detail : undefined;
};
