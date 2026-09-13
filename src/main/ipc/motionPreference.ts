/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU General Public License version 3 or later.
*/

import { ipcMain } from 'electron';
import {
  isMotionPreference,
  readMotionPreference,
  writeMotionPreference,
  type TMotionPreference,
} from '../motionPreference';

/** What the tools menu shows: the saved choice, and the one this launch runs. */
export interface IMotionPreferenceState {
  chosen: TMotionPreference;
  atLaunch: TMotionPreference;
}

const CHANNELS = ['motion-preference-get', 'motion-preference-set'] as const;

export const registerMotionPreferenceIpc = ({
  userDataDir,
  atLaunch,
  logger,
}: {
  userDataDir: string;
  atLaunch: TMotionPreference;
  logger?: { error(message: string, ...details: unknown[]): void };
}) => {
  ipcMain.handle('motion-preference-get', (): IMotionPreferenceState => ({
    chosen: readMotionPreference(userDataDir),
    atLaunch,
  }));

  ipcMain.handle(
    'motion-preference-set',
    (_event, motion: unknown): IMotionPreferenceState => {
      if (isMotionPreference(motion)) {
        try {
          writeMotionPreference(userDataDir, motion);
        } catch (error) {
          logger?.error('Could not save the motion preference', error);
        }
      }
      return { chosen: readMotionPreference(userDataDir), atLaunch };
    },
  );

  return {
    dispose: () =>
      CHANNELS.forEach((channel) => ipcMain.removeHandler(channel)),
  };
};
