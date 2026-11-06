/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import type { NsisUpdater } from 'electron-updater';
import { setUpReleaseAutoUpdates } from '../../../main/signedAutoUpdates';
import * as updateFeed from '../../../main/updateFeedSignature';

const harnessFor = async (channel: 'signed' | 'unsigned') => {
  const listeners = new Map<
    string,
    (info: Record<string, unknown>) => unknown
  >();
  const updater = {
    on: jest.fn(
      (event: string, listener: (info: Record<string, unknown>) => unknown) => {
        listeners.set(event, listener);
        return updater;
      },
    ),
    checkForUpdates: jest.fn().mockResolvedValue(null),
    setFeedURL: jest.fn(),
    quitAndInstall: jest.fn(),
  } as unknown as NsisUpdater;
  const verifyPublisher = jest.fn().mockResolvedValue({ valid: true });
  const verifyUnsigned = jest.fn().mockResolvedValue({ valid: true });
  const sendStatus = jest.fn();
  const controller = await setUpReleaseAutoUpdates({
    executablePath: 'C:/Program Files/FluidEQ/FluidEQ.exe',
    isPackaged: true,
    loadUpdater: () => updater,
    logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn() },
    platform: 'win32',
    publisherName: channel === 'signed' ? 'Ivan Carmenates Garcia' : '',
    updateUrl: channel === 'signed' ? 'https://updates.example.com/' : '',
    verifyPublisher,
    verifyUnsigned,
    sendStatus,
  });
  if (!controller) {
    throw new Error('No update controller');
  }
  return {
    listeners,
    updater,
    controller,
    verifyPublisher,
    verifyUnsigned,
    sendStatus,
  };
};

const downloaded = {
  version: '2.4.0',
  downloadedFile: 'C:/Temp/FluidEQ-Setup.exe',
};

describe('download authorization and ordinary installation', () => {
  afterEach(() => jest.restoreAllMocks());

  it.each(['signed', 'unsigned'] as const)(
    'keeps the %s channel and unattended installation working for verified downloads',
    async (channel) => {
      const verifyFeed = jest
        .spyOn(updateFeed, 'verifyDownloadedUpdateFeed')
        .mockResolvedValue({ valid: true });
      const harness = await harnessFor(channel);
      await harness.listeners.get('update-downloaded')?.(downloaded);

      expect(verifyFeed).toHaveBeenCalledWith(
        downloaded,
        downloaded.downloadedFile,
      );
      expect(harness.controller.isReadyToInstall()).toBe(true);
      expect(harness.updater.autoInstallOnAppQuit).toBe(false);
      harness.controller.quitAndInstall(true, true);
      expect(harness.updater.quitAndInstall).toHaveBeenCalledWith(true, true);
      expect(harness.sendStatus).toHaveBeenCalledWith({
        phase: 'ready',
        version: '2.4.0',
      });
      const verifyInstaller =
        channel === 'signed' ? harness.verifyPublisher : harness.verifyUnsigned;
      expect(verifyInstaller).toHaveBeenLastCalledWith(
        downloaded.downloadedFile,
        ...(channel === 'signed' ? ['Ivan Carmenates Garcia'] : []),
      );
    },
  );

  it('immediately revokes a previously ready installer while a replacement is checked', async () => {
    jest
      .spyOn(updateFeed, 'verifyDownloadedUpdateFeed')
      .mockResolvedValueOnce({ valid: true })
      .mockResolvedValue({ valid: false, reason: 'installer bytes changed' });
    const harness = await harnessFor('unsigned');
    await harness.listeners.get('update-downloaded')?.(downloaded);
    expect(harness.controller.isReadyToInstall()).toBe(true);

    const replacement = harness.listeners.get('update-downloaded')?.({
      ...downloaded,
      version: '2.4.1',
    });

    expect(harness.controller.isReadyToInstall()).toBe(false);
    expect(() => harness.controller.quitAndInstall(true, true)).toThrow(
      /verification/,
    );
    await replacement;
    expect(harness.controller.isReadyToInstall()).toBe(false);
    expect(harness.updater.quitAndInstall).not.toHaveBeenCalled();
  });

  it.each(['update-available', 'update-downloaded'])(
    'does not authorize a newer candidate when an old hash completes after %s',
    async (newEvent) => {
      let finish = (_value: updateFeed.IFeedVerification) => {};
      const olderHash = new Promise<updateFeed.IFeedVerification>((resolve) => {
        finish = resolve;
      });
      let start = () => {};
      const started = new Promise<void>((resolve) => {
        start = resolve;
      });
      jest
        .spyOn(updateFeed, 'verifyDownloadedUpdateFeed')
        .mockImplementationOnce(() => {
          start();
          return olderHash;
        })
        .mockResolvedValue({ valid: false, reason: 'new candidate rejected' });
      const harness = await harnessFor('unsigned');
      const older = harness.listeners.get('update-downloaded')?.(downloaded);
      await started;
      await harness.listeners.get(newEvent)?.({
        ...downloaded,
        version: '2.4.1',
      });

      finish({ valid: true });
      await older;

      expect(harness.controller.isReadyToInstall()).toBe(false);
      expect(() => harness.controller.quitAndInstall(true, true)).toThrow(
        /verification/,
      );
      expect(harness.sendStatus).not.toHaveBeenCalledWith(
        expect.objectContaining({ phase: 'ready' }),
      );
      expect(harness.updater.quitAndInstall).not.toHaveBeenCalled();
    },
  );
});
