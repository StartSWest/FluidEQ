/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { DSP_PLAYBACK_SECTIONS, DSP_SECTIONS, TDspSection } from './sections';

/** Exported so a test can forget the choice without spelling it out again. */
export const DSP_OPEN_SECTION_KEY = 'fluideq.dsp.openSection';

/**
 * Which processor the DSP page was last left on.
 *
 * The page opened on the Normalizer every time — after a reload, after the
 * renderer refreshed itself, after coming back from another tab — so anyone
 * working on one stage paid two clicks for every visit to it. Remembering the
 * choice costs one string and is what every other panel in this app does with
 * the state its user set.
 *
 * Stored per machine rather than in the rack: which page is open is not part
 * of the sound, so it must never travel in an exported preset or come back
 * with an imported one.
 */
const KNOWN: readonly TDspSection[] = [
  ...DSP_SECTIONS.map((section) => section.id),
  ...DSP_PLAYBACK_SECTIONS.map((section) => section.id),
];

export const readOpenDspSection = (fallback: TDspSection): TDspSection => {
  try {
    const stored = window.localStorage.getItem(DSP_OPEN_SECTION_KEY);
    return KNOWN.find((section) => section === stored) ?? fallback;
  } catch {
    // Storage a browser refuses to read is the same answer as no storage:
    // the page opens where it always did rather than failing to open.
    return fallback;
  }
};

export const writeOpenDspSection = (section: TDspSection): void => {
  try {
    window.localStorage.setItem(DSP_OPEN_SECTION_KEY, section);
  } catch {
    // Nothing to do and nothing to say: the page still works, it only
    // forgets, which is where it started.
  }
};
