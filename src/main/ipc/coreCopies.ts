/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import type { BrowserWindow, IpcMainEvent } from 'electron';
import { CORE_COPY_CHANNEL } from '../../common/coreCopyChannels';
import {
  parseKeptDspPresets,
  parseKeptGames,
  type IKeptGames,
} from '../../common/coreCopies';
import type { IUserDspPreset } from '../../common/dsp/userPresets';
import type { IKeptFile } from '../../core/files/keptFile';
import onWindowMessage from './windowMessages';

/**
 * The window handing the core its lists (`common/coreCopies.ts`): taken from
 * the window's own top frame only, checked as anything from a page is, and
 * kept whole in place of what was there.
 */
const registerCoreCopies = ({
  getMainWindow,
  games,
  dspPresets,
}: {
  getMainWindow: () => BrowserWindow | null;
  games: IKeptFile<IKeptGames>;
  dspPresets: IKeptFile<IUserDspPreset[]>;
}): (() => void) => {
  const fromWindow = (event: IpcMainEvent) => {
    const window = getMainWindow();
    return (
      !!window &&
      event.sender === window.webContents &&
      event.senderFrame === window.webContents.mainFrame
    );
  };
  const first = (arg: unknown): unknown =>
    Array.isArray(arg) ? arg[0] : undefined;
  const stops = [
    onWindowMessage(CORE_COPY_CHANNEL.games, (event, arg: unknown) => {
      if (fromWindow(event)) {
        games.keep(parseKeptGames(first(arg)));
      }
    }),
    onWindowMessage(CORE_COPY_CHANNEL.dspPresets, (event, arg: unknown) => {
      if (fromWindow(event)) {
        dspPresets.keep(parseKeptDspPresets(first(arg)));
      }
    }),
  ];
  return () => stops.forEach((stop) => stop());
};

export default registerCoreCopies;
