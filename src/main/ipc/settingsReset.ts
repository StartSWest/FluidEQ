/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { ipcMain, type IpcMainInvokeEvent, type WebContents } from 'electron';
import { writeGpuPreference } from '../graphicsPreference';
import { writeMotionPreference } from '../motionPreference';
import { writeStartWithWindows } from '../startWithWindows';

export const SETTINGS_RESET_CHANNEL = 'settings-reset';

interface ILogger {
  error(message: string, ...details: unknown[]): void;
}

export interface ISettingsResetDeps {
  userDataDir: string;
  /** The window allowed to ask: the app's own, never a guest page. */
  ownerContents: () => WebContents | undefined;
  /** Every monitor's background stopped, and their choices as new. */
  resetDesktopBackgrounds: () => void;
  /** The desk lights' switch, brightness and devices as new. */
  resetLighting: () => void;
  /** The compact player's Always on top, off. */
  unpinWindow: () => void;
  logger: ILogger;
}

/**
 * "Reset all settings" in the main menu, for the part of them main keeps
 * (Ivan, 2026-09-28: "resets all settings for all things", "except for
 * installed engine or output", "or the graphs or eq", "just settings"). The
 * window forgets its own half (`renderer/utils/settingsReset.ts`) once this
 * answers, and reloads, which reads every one of them again.
 *
 * What main keeps that is a setting: the animations, the graphics card,
 * whether Windows starts FluidEQ, the desktop backgrounds, the desk lights
 * and the compact player's Always on top. What it keeps that is not, and so
 * is left alone: the engine and the outputs, the EQ in every profile, the
 * song EQs, the band layouts, the account, the Library and the Studio.
 *
 * Each part is its own step: one Windows refuses (the startup entry is
 * Windows' to write) is logged and does not keep the others from resetting.
 * The animations and the graphics card are launch switches, so like their
 * own rows they apply fully from the next start; the page reads the chosen
 * animations again as it reloads.
 */
export const registerSettingsResetIpc = (deps: ISettingsResetDeps) => {
  const fromOwner = (event: IpcMainInvokeEvent) =>
    event.senderFrame === event.sender.mainFrame &&
    event.sender === deps.ownerContents();

  const steps: [string, () => void][] = [
    ['animations', () => writeMotionPreference(deps.userDataDir, 'full')],
    ['graphics card', () => writeGpuPreference(deps.userDataDir, 'auto')],
    [
      'start with Windows',
      () => {
        if (writeStartWithWindows(false, deps.logger).failed) {
          throw new Error('Windows kept the startup entry');
        }
      },
    ],
    ['desktop backgrounds', deps.resetDesktopBackgrounds],
    ['desk lights', deps.resetLighting],
    ['always on top', deps.unpinWindow],
  ];

  ipcMain.handle(SETTINGS_RESET_CHANNEL, (event) => {
    if (!fromOwner(event)) {
      throw new Error('Only FluidEQ resets its settings.');
    }
    steps.forEach(([name, step]) => {
      try {
        step();
      } catch (error) {
        deps.logger.error(`Settings reset: could not reset the ${name}`, error);
      }
    });
  });

  return {
    dispose: () => ipcMain.removeHandler(SETTINGS_RESET_CHANNEL),
  };
};
