/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { ipcRenderer } from 'electron';
import {
  RECOVERED_PROFILES_CHANNEL,
  RECOVERED_PROFILES_SEEN_CHANNEL,
  type IRecoveredProfile,
} from '../common/recoveredProfiles';

/**
 * The renderer's side of the outputs whose lost profile the launch replaced:
 * what to say, and that it was said. Its own module, like
 * `plusTermsNoticeBridge`, so `api.ts` gains one line.
 */
export const recoveredProfilesBridge = {
  getRecoveredProfiles: (): Promise<IRecoveredProfile[]> =>
    ipcRenderer.invoke(RECOVERED_PROFILES_CHANNEL),
  recoveredProfilesSeen: (): Promise<void> =>
    ipcRenderer.invoke(RECOVERED_PROFILES_SEEN_CHANNEL),
};
