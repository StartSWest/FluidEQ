/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import type { BrowserWindow, IpcMainEvent } from 'electron';
import { SONG_MEMORY_CHANNEL } from '../../common/songMemoryStatus';
import type { TSongMemory } from '../songMemory';
import onWindowMessage from './windowMessages';

/**
 * The window's side of the song memory, which runs in the core
 * (`songMemory.ts`): when time passes for the window's players, the cards'
 * buttons and the switch — taken from the window's own top frame only, and
 * checked as anything from a page is. What the players play arrives on its
 * own channel (`nowPlaying.ts`), which Smart EQ hears too.
 */
const registerSongMemoryIpc = ({
  getMainWindow,
  memory,
}: {
  getMainWindow: () => BrowserWindow | null;
  memory: Pick<
    TSongMemory,
    | 'status'
    | 'tick'
    | 'undo'
    | 'dontSave'
    | 'forgetNoticed'
    | 'endNotice'
    | 'setOn'
    | 'handOver'
  >;
}): (() => void) => {
  const fromWindow = (event: IpcMainEvent) => {
    const window = getMainWindow();
    return (
      !!window &&
      event.sender === window.webContents &&
      event.senderFrame === window.webContents.mainFrame
    );
  };
  const args = (arg: unknown): unknown[] => (Array.isArray(arg) ? arg : []);
  const stops = [
    onWindowMessage(SONG_MEMORY_CHANNEL.ask, (event) => {
      if (fromWindow(event)) {
        event.sender.send(SONG_MEMORY_CHANNEL.status, memory.status());
      }
    }),
    onWindowMessage(SONG_MEMORY_CHANNEL.tick, (event) => {
      if (fromWindow(event)) {
        memory.tick();
      }
    }),
    onWindowMessage(SONG_MEMORY_CHANNEL.action, (event, arg: unknown) => {
      const [action] = args(arg);
      if (!fromWindow(event) || typeof action !== 'object' || !action) {
        return;
      }
      const asked = action as Record<string, unknown>;
      if (asked.kind === 'undo') {
        memory.undo();
      } else if (asked.kind === 'dontSave') {
        memory.dontSave();
      } else if (asked.kind === 'forget') {
        memory.forgetNoticed();
      } else if (asked.kind === 'endNotice' && Number.isSafeInteger(asked.id)) {
        memory.endNotice(asked.id as number);
      } else if (asked.kind === 'setOn' && typeof asked.isOn === 'boolean') {
        memory.setOn(asked.isOn);
      }
    }),
    onWindowMessage(SONG_MEMORY_CHANNEL.handOver, (event, arg: unknown) => {
      const [wasOn] = args(arg);
      if (fromWindow(event) && typeof wasOn === 'boolean') {
        memory.handOver(wasOn);
      }
    }),
  ];
  return () => stops.forEach((stop) => stop());
};

export default registerSongMemoryIpc;
