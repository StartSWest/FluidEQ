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

import type { NsisUpdater } from 'electron-updater';
import {
  IReleaseAutoUpdateOptions,
  setUpReleaseAutoUpdates,
  verifyAuthenticodePublisher,
} from '../../../main/signedAutoUpdates';

const CURRENT_EXE = 'C:\\Program Files\\FluidEQ\\FluidEQ.exe';
const OFFICIAL_PUBLISHER = 'Ivan Carmenates Garcia';
const UPDATE_URL = 'https://updates.fluideq.example/releases/';

const makeHarness = () => {
  const listeners = new Map<string, (...args: any[]) => void>();
  const updater = {
    addAuthHeader: jest.fn(),
    checkForUpdates: jest.fn().mockResolvedValue(null),
    logger: undefined,
    on: jest.fn((event: string, listener: (...args: any[]) => void) => {
      listeners.set(event, listener);
      return updater;
    }),
    quitAndInstall: jest.fn(),
    setFeedURL: jest.fn(),
    verifyUpdateCodeSignature: jest.fn(),
  } as unknown as NsisUpdater;
  const logger = { error: jest.fn(), info: jest.fn(), warn: jest.fn() };
  const loadUpdater = jest.fn(() => updater);
  const schedule = jest.fn();
  const verifyPublisher = jest.fn().mockResolvedValue({ valid: true });

  const options: IReleaseAutoUpdateOptions = {
    executablePath: CURRENT_EXE,
    isPackaged: true,
    loadUpdater,
    logger,
    platform: 'win32',
    publisherName: OFFICIAL_PUBLISHER,
    schedule: schedule as unknown as typeof setInterval,
    sendStatus: jest.fn(),
    updateUrl: UPDATE_URL,
    verifyPublisher,
  };

  return {
    listeners,
    loadUpdater,
    logger,
    options,
    schedule,
    updater,
    verifyPublisher,
  };
};

describe('current executable update authorization', () => {
  it.each([
    ['development', { isPackaged: false }],
    ['non-Windows', { platform: 'linux' as NodeJS.Platform }],
    ['missing publisher', { publisherName: '' }],
    ['missing feed', { updateUrl: '' }],
    ['non-HTTPS feed', { updateUrl: 'http://updates.example.com/' }],
  ])(
    'does not initialize or check the updater for a %s build',
    async (_, patch) => {
      const harness = makeHarness();

      await setUpReleaseAutoUpdates({ ...harness.options, ...patch });

      expect(harness.loadUpdater).not.toHaveBeenCalled();
      expect(harness.updater.checkForUpdates).not.toHaveBeenCalled();
      expect(harness.schedule).not.toHaveBeenCalled();
    },
  );

  it.each([
    ['unsigned', 'Windows reported signature status NotSigned'],
    ['wrong publisher', 'executable publisher is "Somebody Else"'],
    ['unverifiable', 'Authenticode verification could not be completed'],
  ])('fails closed when the current executable is %s', async (_, reason) => {
    const harness = makeHarness();
    harness.verifyPublisher.mockResolvedValue({ valid: false, reason });

    const result = await setUpReleaseAutoUpdates(harness.options);

    expect(result).toBeUndefined();
    expect(harness.loadUpdater).not.toHaveBeenCalled();
    expect(harness.updater.checkForUpdates).not.toHaveBeenCalled();
    expect(harness.schedule).not.toHaveBeenCalled();
    expect(harness.logger.warn).toHaveBeenCalledWith(
      expect.stringContaining(reason),
    );
  });

  it('enables only the generic HTTPS feed for the official build', async () => {
    const harness = makeHarness();

    const result = await setUpReleaseAutoUpdates(harness.options);

    // A controller, not the updater itself. Handing the raw updater back would
    // hand out `quitAndInstall` unguarded, and installing is the one thing that
    // must stay behind the verification the controller performs.
    expect(result).toEqual({ quitAndInstall: expect.any(Function) });
    expect(harness.verifyPublisher).toHaveBeenCalledWith(
      CURRENT_EXE,
      OFFICIAL_PUBLISHER,
    );
    expect(harness.updater.setFeedURL).toHaveBeenCalledWith({
      provider: 'generic',
      url: UPDATE_URL,
    });
    expect(harness.updater.checkForUpdates).toHaveBeenCalledTimes(1);
    expect(harness.schedule).toHaveBeenCalledWith(
      expect.any(Function),
      60 * 60 * 1000,
    );
  });
});

describe('downloaded installer verification', () => {
  it('returns an error for an installer signed by the wrong publisher', async () => {
    const harness = makeHarness();
    harness.verifyPublisher.mockImplementation(async (executablePath) =>
      executablePath === CURRENT_EXE
        ? { valid: true }
        : { valid: false, reason: 'wrong official publisher' },
    );
    await setUpReleaseAutoUpdates(harness.options);

    await expect(
      harness.updater.verifyUpdateCodeSignature(
        ['forged metadata publisher'],
        'C:\\Temp\\FluidEQ-Setup.exe',
      ),
    ).resolves.toBe('wrong official publisher');
    expect(harness.verifyPublisher).toHaveBeenLastCalledWith(
      'C:\\Temp\\FluidEQ-Setup.exe',
      OFFICIAL_PUBLISHER,
    );
  });

  it('accepts an installer only when the pinned publisher verifies', async () => {
    const harness = makeHarness();
    await setUpReleaseAutoUpdates(harness.options);

    await expect(
      harness.updater.verifyUpdateCodeSignature(
        [OFFICIAL_PUBLISHER],
        'C:\\Temp\\FluidEQ-Setup.exe',
      ),
    ).resolves.toBeNull();
  });
});

describe('private feed authentication boundary', () => {
  it('adds a short-lived bearer token before checking the feed', async () => {
    const harness = makeHarness();
    const getBearerToken = jest.fn().mockResolvedValue('short-lived-token');

    await setUpReleaseAutoUpdates({
      ...harness.options,
      getBearerToken,
    });
    await Promise.resolve();

    expect(getBearerToken).toHaveBeenCalledTimes(1);
    expect(harness.updater.addAuthHeader).toHaveBeenCalledWith(
      'Bearer short-lived-token',
    );
    expect(harness.updater.checkForUpdates).toHaveBeenCalledTimes(1);
  });

  it('does not fall back to an unauthenticated check when minting fails', async () => {
    const harness = makeHarness();

    await setUpReleaseAutoUpdates({
      ...harness.options,
      getBearerToken: jest.fn().mockRejectedValue(new Error('not entitled')),
    });
    await Promise.resolve();
    await Promise.resolve();

    expect(harness.updater.addAuthHeader).not.toHaveBeenCalled();
    expect(harness.updater.checkForUpdates).not.toHaveBeenCalled();
  });
});

describe('Windows Authenticode results', () => {
  const validSignature = {
    path: CURRENT_EXE,
    simpleName: OFFICIAL_PUBLISHER,
    status: 'Valid',
    subject: `CN=${OFFICIAL_PUBLISHER}`,
  };

  it('accepts an exact publisher match from a valid Windows signature', async () => {
    await expect(
      verifyAuthenticodePublisher(
        CURRENT_EXE,
        OFFICIAL_PUBLISHER,
        async () => validSignature,
      ),
    ).resolves.toEqual({ valid: true });
  });

  it('rejects an unsigned executable', async () => {
    const result = await verifyAuthenticodePublisher(
      CURRENT_EXE,
      OFFICIAL_PUBLISHER,
      async () => ({ ...validSignature, status: 'NotSigned' }),
    );
    expect(result).toEqual({
      valid: false,
      reason: expect.stringContaining('NotSigned'),
    });
  });

  it('rejects a valid signature from the wrong publisher', async () => {
    const result = await verifyAuthenticodePublisher(
      CURRENT_EXE,
      OFFICIAL_PUBLISHER,
      async () => ({ ...validSignature, simpleName: 'Somebody Else' }),
    );
    expect(result).toEqual({
      valid: false,
      reason: expect.stringContaining('Somebody Else'),
    });
  });

  it('rejects when Windows verification cannot run', async () => {
    const result = await verifyAuthenticodePublisher(
      CURRENT_EXE,
      OFFICIAL_PUBLISHER,
      async () => {
        throw new Error('PowerShell unavailable');
      },
    );
    expect(result).toEqual({
      valid: false,
      reason: expect.stringContaining('could not be completed'),
    });
  });
});
