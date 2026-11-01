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

import type { BrowserWindow, IpcMainEvent } from 'electron';
import { SONG_EQ_CHANNEL, type TSongEqAction } from '../../common/songEqStatus';
import type { TSongEqMemory } from '../songEqMemory';
import onWindowMessage from './windowMessages';

/** A button's ask, or nothing that is not one. */
const toAction = (value: unknown): TSongEqAction | undefined => {
  if (typeof value !== 'object' || value === null) {
    return undefined;
  }
  const asked = value as Record<string, unknown>;
  switch (asked.kind) {
    case 'undo':
    case 'forget':
      return { kind: asked.kind };
    case 'endNotice':
      return Number.isSafeInteger(asked.id)
        ? { kind: 'endNotice', id: asked.id as number }
        : undefined;
    case 'setSaveOn':
      return typeof asked.isSaveOn === 'boolean'
        ? { kind: 'setSaveOn', isSaveOn: asked.isSaveOn }
        : undefined;
    default:
      return undefined;
  }
};

/**
 * The window's side of the Smart EQ song memory, which runs in the core
 * (`songEqMemory.ts`): the status now, time passing for the window's players
 * while the core cannot hear them, and the badge's, switch's and card's
 * buttons — taken from the window's own top frame only, and checked as
 * anything from a page is.
 */
const registerSongEqIpc = ({
  getMainWindow,
  memory,
}: {
  getMainWindow: () => BrowserWindow | null;
  memory: Pick<TSongEqMemory, 'status' | 'tick' | 'act'>;
}): (() => void) => {
  const fromWindow = (event: IpcMainEvent) => {
    const window = getMainWindow();
    return (
      !!window &&
      event.sender === window.webContents &&
      event.senderFrame === window.webContents.mainFrame
    );
  };
  const stops = [
    onWindowMessage(SONG_EQ_CHANNEL.ask, (event) => {
      if (fromWindow(event)) {
        event.sender.send(SONG_EQ_CHANNEL.status, memory.status());
      }
    }),
    onWindowMessage(SONG_EQ_CHANNEL.tick, (event) => {
      if (fromWindow(event)) {
        memory.tick();
      }
    }),
    onWindowMessage(SONG_EQ_CHANNEL.action, (event, arg: unknown) => {
      const action = toAction(Array.isArray(arg) ? arg[0] : undefined);
      if (fromWindow(event) && action) {
        memory.act(action);
      }
    }),
  ];
  return () => stops.forEach((stop) => stop());
};

export default registerSongEqIpc;
