/* Copyright (C) 2026 Ivan Carmenates Garcia. SPDX-License-Identifier: GPL-3.0-or-later */

import fs from 'fs';
import path from 'path';
import { BrowserWindow, dialog } from 'electron';
import ChannelEnum from '../../common/channels';
import { ErrorCode } from '../../common/errors';
import {
  CURVE_LIST_EXTENSION,
  CURVE_LIST_FILE_MAX,
  CURVE_LIST_MAX,
  fromCurveListFile,
  readCurveText,
} from '../../common/myCurves';
import type { TSuccess } from '../../renderer/utils/equalizerApi';
import mainText from '../mainText';
import { userMessageOf } from '../refusal';
import onWindowMessage from './windowMessages';

export interface ICurveExportIpcDeps {
  getMainWindow: () => BrowserWindow | null;
  handleError: (
    event: Electron.IpcMainEvent,
    channel: ChannelEnum | string,
    errorCode: ErrorCode,
    message?: string,
  ) => void;
}

/** A name the folder export may write: one plain file name, nothing more. */
const isPlainTxtName = (name: unknown): name is string =>
  typeof name === 'string' &&
  name.length > 4 &&
  name.length <= 100 &&
  name.endsWith('.txt') &&
  path.basename(name) === name &&
  !name.includes('..') &&
  !/[<>:"/\\|?*]/.test(name);

/** `name.txt`, or `name (2).txt`… when the folder already holds it. */
const freePath = (folder: string, name: string): string => {
  const stem = name.slice(0, -'.txt'.length);
  let candidate = path.join(folder, name);
  for (let count = 2; fs.existsSync(candidate); count += 1) {
    candidate = path.join(folder, `${stem} (${count}).txt`);
  }
  return candidate;
};

/**
 * My curves out of FluidEQ, written by the main process alone: the window
 * hands over what to write and main owns where. Both are refused before a
 * byte is written unless they are what they claim — a curve list that reads
 * back whole, or curve texts under plain file names — so a page that went
 * wrong cannot use this to write anything else anywhere.
 */
export const registerCurveExportIpc = ({
  getMainWindow,
  handleError,
}: ICurveExportIpcDeps) => {
  onWindowMessage(ChannelEnum.EXPORT_CURVE_LIST, async (event, arg) => {
    const channel = ChannelEnum.EXPORT_CURVE_LIST;
    try {
      const suggestedName = arg?.[0];
      const contents = arg?.[1];
      if (
        typeof suggestedName !== 'string' ||
        typeof contents !== 'string' ||
        suggestedName.length > 200 ||
        contents.length > CURVE_LIST_FILE_MAX ||
        !fromCurveListFile(contents)
      ) {
        handleError(event, channel, ErrorCode.INVALID_PARAMETER);
        return;
      }
      const baseName =
        suggestedName.replace(/[^\w\- ]+/g, '').trim() || 'My curves';
      const options: Electron.SaveDialogOptions = {
        title: mainText('files.title.exportCurves'),
        defaultPath: `${baseName}.${CURVE_LIST_EXTENSION}`,
        filters: [
          {
            name: mainText('files.type.curveList'),
            extensions: [CURVE_LIST_EXTENSION],
          },
        ],
      };
      const parent = getMainWindow();
      const target = parent
        ? await dialog.showSaveDialog(parent, options)
        : await dialog.showSaveDialog(options);
      if (target.canceled || !target.filePath) {
        const reply: TSuccess<boolean> = { result: false };
        event.reply(channel, reply);
        return;
      }
      fs.writeFileSync(target.filePath, contents, 'utf8');
      const reply: TSuccess<boolean> = { result: true };
      event.reply(channel, reply);
    } catch (error) {
      handleError(event, channel, ErrorCode.FAILURE, userMessageOf(error));
    }
  });

  onWindowMessage(ChannelEnum.EXPORT_CURVE_FOLDER, async (event, arg) => {
    const channel = ChannelEnum.EXPORT_CURVE_FOLDER;
    try {
      const files: unknown = arg?.[0];
      if (
        !Array.isArray(files) ||
        files.length === 0 ||
        files.length > CURVE_LIST_MAX ||
        !files.every(
          (file: unknown) =>
            typeof file === 'object' &&
            file !== null &&
            isPlainTxtName((file as { name?: unknown }).name) &&
            typeof (file as { text?: unknown }).text === 'string' &&
            readCurveText((file as { text: string }).text) !== undefined,
        )
      ) {
        handleError(event, channel, ErrorCode.INVALID_PARAMETER);
        return;
      }
      const options: Electron.OpenDialogOptions = {
        title: mainText('files.title.exportCurveFolder'),
        properties: ['openDirectory', 'createDirectory'],
      };
      const parent = getMainWindow();
      const target = parent
        ? await dialog.showOpenDialog(parent, options)
        : await dialog.showOpenDialog(options);
      const folder = target.filePaths[0];
      if (target.canceled || !folder) {
        const reply: TSuccess<boolean> = { result: false };
        event.reply(channel, reply);
        return;
      }
      (files as Array<{ name: string; text: string }>).forEach((file) => {
        // Never over a file already there: a folder somebody keeps their
        // curves in may hold one by the same name from before.
        fs.writeFileSync(freePath(folder, file.name), file.text, {
          encoding: 'utf8',
          flag: 'wx',
        });
      });
      const reply: TSuccess<boolean> = { result: true };
      event.reply(channel, reply);
    } catch (error) {
      handleError(event, channel, ErrorCode.FAILURE, userMessageOf(error));
    }
  });
};
