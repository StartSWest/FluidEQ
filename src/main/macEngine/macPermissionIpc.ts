/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { execFile } from 'child_process';
import { ipcMain, shell, systemPreferences } from 'electron';
import log from 'electron-log';
import { promisify } from 'util';
import type { TMacAudioPermission } from '../../common/macAudioPermission';
import { findMacEngineExecutable } from './enginePath';

const execFileAsync = promisify(execFile);

const isPermission = (word: string): word is TMacAudioPermission =>
  word === 'granted' || word === 'denied' || word === 'unknown';

/**
 * The engine's own answer (`FluidEQ-Engine --audio-permission`): macOS
 * answers for the app responsible for the engine's process, and that is the
 * process that taps.
 */
export const readMacAudioPermission =
  async (): Promise<TMacAudioPermission> => {
    if (process.platform !== 'darwin') {
      return 'unknown';
    }
    const executable = findMacEngineExecutable();
    if (!executable) {
      return 'unknown';
    }
    try {
      const { stdout } = await execFileAsync(executable, [
        '--audio-permission',
      ]);
      const word = stdout.trim();
      return isPermission(word) ? word : 'unknown';
    } catch (error) {
      log.warn(`macOS sound permission could not be read: ${String(error)}`);
      return 'unknown';
    }
  };

/**
 * Privacy & Security › Screen & System Audio Recording, the page with both
 * lists that allow the engine: the screen and its sound, or the sound alone.
 */
const AUDIO_PRIVACY_PAGE =
  'x-apple.systempreferences:com.apple.preference.security?Privacy_ScreenCapture';

/**
 * Whether macOS lets FluidEQ record the screen: the upper list on the same
 * page. The live curve's capture needs it and the engine does not — that
 * capture brings a window's picture with its sound, and the list for sound
 * alone does not cover a picture. Public, unlike the sound's question, and
 * answered for the app responsible for this process, as the capture is.
 */
export const readMacScreenPermission = (): TMacAudioPermission => {
  if (process.platform !== 'darwin') {
    return 'unknown';
  }
  const status = systemPreferences.getMediaAccessStatus('screen');
  if (status === 'granted') {
    return 'granted';
  }
  return status === 'denied' || status === 'restricted' ? 'denied' : 'unknown';
};

/** The window's questions, and the button that answers them. */
const registerMacPermissionIpc = () => {
  ipcMain.handle('mac-audio-permission', () => readMacAudioPermission());
  ipcMain.handle('mac-screen-permission', () => readMacScreenPermission());
  ipcMain.handle('open-mac-audio-privacy', async () => {
    if (process.platform === 'darwin') {
      await shell.openExternal(AUDIO_PRIVACY_PAGE);
    }
  });
};

export default registerMacPermissionIpc;
