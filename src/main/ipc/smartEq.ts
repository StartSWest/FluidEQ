/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import type { BrowserWindow, IpcMainEvent } from 'electron';
import {
  type ISmartEqCoreSettings,
  SMART_EQ_CHANNEL,
  parseSmartEqCoreSettings,
} from '../../common/smartEqCore';
import type { IKeptFile } from '../../core/files/keptFile';
import type { TSmartEqRunner } from '../smartEq/smartEqRunner';
import onWindowMessage from './windowMessages';

/**
 * The window's side of Smart EQ, which runs in the core
 * (`smartEq/smartEqRunner.ts`): the button, the settings the window keeps,
 * and asking what is running now — taken from the window's own top frame
 * only, and checked as anything from a page is.
 */
const registerSmartEqIpc = ({
  getMainWindow,
  runner,
  settings,
}: {
  getMainWindow: () => BrowserWindow | null;
  runner: Pick<TSmartEqRunner, 'run' | 'cancel' | 'state'>;
  settings: IKeptFile<ISmartEqCoreSettings>;
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
    onWindowMessage(SMART_EQ_CHANNEL.run, (event) => {
      if (fromWindow(event)) {
        runner.run();
      }
    }),
    onWindowMessage(SMART_EQ_CHANNEL.cancel, (event) => {
      if (fromWindow(event)) {
        runner.cancel();
      }
    }),
    onWindowMessage(SMART_EQ_CHANNEL.ask, (event) => {
      if (fromWindow(event)) {
        event.sender.send(SMART_EQ_CHANNEL.state, runner.state());
      }
    }),
    onWindowMessage(SMART_EQ_CHANNEL.settings, (event, arg: unknown) => {
      if (fromWindow(event)) {
        settings.keep(parseSmartEqCoreSettings(first(arg)));
      }
    }),
  ];
  return () => stops.forEach((stop) => stop());
};

export default registerSmartEqIpc;
