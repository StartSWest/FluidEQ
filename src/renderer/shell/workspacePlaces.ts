/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import type { TranslationKey } from 'common/i18n/en';
import type { MenuIconName } from '../icons/MenuIcon';
import type { TTitlebarPlace } from '../utils/titlebarPlaces';

export interface IWorkspacePlace {
  icon: MenuIconName;
  /** The place's full name: its tab's accessible name and its menu row. */
  label: TranslationKey;
}

/**
 * Each place's glyph and name, drawn by its tab on the bar and by its row in
 * the actions menu while the bar has no room for it — one table, so the two
 * can never show the same place two ways.
 */
export const WORKSPACE_PLACES: Record<TTitlebarPlace, IWorkspacePlace> = {
  community: { icon: 'scene', label: 'tabs.plus' },
  share: { icon: 'waveform', label: 'tabs.share' },
  // Its own glyph, since Karaoke already wears the microphone.
  mic: { icon: 'microphoneSettings', label: 'mic.tab' },
  games: { icon: 'gamepad', label: 'gaming.tab' },
  dsp: { icon: 'configure', label: 'tabs.dsp' },
  library: { icon: 'album', label: 'tabs.library' },
  karaoke: { icon: 'microphone', label: 'tabs.karaoke' },
  video: { icon: 'video', label: 'tabs.media' },
};
