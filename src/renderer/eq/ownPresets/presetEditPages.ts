/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * Asked of the shell by a preset being edited: the strip's Curve and Rack
 * lead to the EQ page and the DSP page, and Save and Discard back to the EQ
 * page's Preset tab. The shell owns which page is open, and the strip has no
 * other way to reach it (`gamingLabEvents.ts` is the same ask).
 */
export const OPEN_PRESET_EDIT_PAGE_EVENT = 'fluideq-open-preset-edit-page';

export type TPresetEditPage = 'eq' | 'dsp';

export const openPresetEditPage = (page: TPresetEditPage): void => {
  window.dispatchEvent(
    new CustomEvent<TPresetEditPage>(OPEN_PRESET_EDIT_PAGE_EVENT, {
      detail: page,
    }),
  );
};

export const presetEditPageOf = (event: Event): TPresetEditPage | undefined => {
  const { detail } = event as CustomEvent<unknown>;
  return detail === 'eq' || detail === 'dsp' ? detail : undefined;
};
