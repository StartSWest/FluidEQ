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
  // A clock the test moves by hand. There is no timer in the module under
  // test, so ageing a check means moving this, not waiting.
  let clock = 1_000_000;
  const now = () => clock;
  const advance = (ms: number) => {
    clock += ms;
  };
  const verifyPublisher = jest.fn().mockResolvedValue({ valid: true });

  const options: IReleaseAutoUpdateOptions = {
    executablePath: CURRENT_EXE,
    isPackaged: true,
    loadUpdater,
    logger,
    platform: 'win32',
    publisherName: OFFICIAL_PUBLISHER,
    now,
    sendStatus: jest.fn(),
    updateUrl: UPDATE_URL,
    verifyPublisher,
  };

  return {
    listeners,
    loadUpdater,
    logger,
    options,
    advance,
    now,
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
    expect(result).toEqual({
      checkIfDue: expect.any(Function),
      checkNow: expect.any(Function),
      quitAndInstall: expect.any(Function),
    });
    expect(harness.verifyPublisher).toHaveBeenCalledWith(
      CURRENT_EXE,
      OFFICIAL_PUBLISHER,
    );
    expect(harness.updater.setFeedURL).toHaveBeenCalledWith({
      provider: 'generic',
      url: UPDATE_URL,
    });
    expect(harness.updater.checkForUpdates).toHaveBeenCalledTimes(1);
  });
});

describe('checking without a timer, and on demand', () => {
  const FOUR_HOURS = 4 * 60 * 60 * 1000;

  it('does not check again while the last one is still fresh', async () => {
    const harness = makeHarness();
    const controller = await setUpReleaseAutoUpdates(harness.options);
    expect(harness.updater.checkForUpdates).toHaveBeenCalledTimes(1);

    harness.advance(FOUR_HOURS - 1);

    await expect(controller?.checkIfDue()).resolves.toBe(false);
    expect(harness.updater.checkForUpdates).toHaveBeenCalledTimes(1);
  });

  it('checks once the last one has gone stale', async () => {
    const harness = makeHarness();
    const controller = await setUpReleaseAutoUpdates(harness.options);

    harness.advance(FOUR_HOURS);

    await expect(controller?.checkIfDue()).resolves.toBe(true);
    expect(harness.updater.checkForUpdates).toHaveBeenCalledTimes(2);
  });

  it('collapses a burst of wake signals into one request', async () => {
    const harness = makeHarness();
    const controller = await setUpReleaseAutoUpdates(harness.options);
    harness.advance(FOUR_HOURS);

    // A wake is followed by an unlock is followed by the window being shown,
    // all within a second or two. That must be one check, not three.
    await controller?.checkIfDue();
    await controller?.checkIfDue();
    await controller?.checkIfDue();

    expect(harness.updater.checkForUpdates).toHaveBeenCalledTimes(2);
  });

  it('counts an explicit check, so a wake right after it does nothing', async () => {
    const harness = makeHarness();
    const controller = await setUpReleaseAutoUpdates(harness.options);
    harness.advance(FOUR_HOURS);

    await controller?.checkNow();
    expect(harness.updater.checkForUpdates).toHaveBeenCalledTimes(2);

    await expect(controller?.checkIfDue()).resolves.toBe(false);
    expect(harness.updater.checkForUpdates).toHaveBeenCalledTimes(2);
  });

  it('measures elapsed time, so sleeping through the window still checks on wake', async () => {
    const harness = makeHarness();
    const controller = await setUpReleaseAutoUpdates(harness.options);

    // A timer would not have fired at all across a suspend; a clock
    // comparison sees the whole three days the lid was shut.
    harness.advance(3 * 24 * 60 * 60 * 1000);

    await expect(controller?.checkIfDue()).resolves.toBe(true);
    expect(harness.updater.checkForUpdates).toHaveBeenCalledTimes(2);
  });

  it('checkNow runs an extra update check on demand', async () => {
    const harness = makeHarness();

    const result = await setUpReleaseAutoUpdates(harness.options);
    // The startup check has already fired.
    expect(harness.updater.checkForUpdates).toHaveBeenCalledTimes(1);

    await result?.checkNow();

    expect(harness.updater.checkForUpdates).toHaveBeenCalledTimes(2);
  });

  it('arms beforeQuit before handing off to electron-updater', async () => {
    const harness = makeHarness();
    const beforeQuit = jest.fn();
    const controller = await setUpReleaseAutoUpdates({
      ...harness.options,
      beforeQuit,
    });
    if (!controller) {
      throw new Error('setUpReleaseAutoUpdates returned no controller');
    }

    // Simulate the download reaching authorized state so quitAndInstall does
    // not throw the verification error.
    harness.listeners.get('update-downloaded')?.({
      downloadedFile: 'C:\\Temp\\FluidEQ-Setup.exe',
      version: '1.3.2',
    });
    await Promise.resolve();
    await Promise.resolve();

    controller.quitAndInstall(false, true);

    expect(beforeQuit).toHaveBeenCalledTimes(1);
    expect(harness.updater.quitAndInstall).toHaveBeenCalledTimes(1);
    // Ordering: beforeQuit must fire strictly before the underlying updater is
    // told to quit — otherwise the tray flag is not set when the close handler
    // runs, and the exit is cancelled.
    const beforeOrder = beforeQuit.mock.invocationCallOrder[0];
    const quitOrder = (harness.updater.quitAndInstall as jest.Mock).mock
      .invocationCallOrder[0];
    expect(beforeOrder).toBeLessThan(quitOrder);
  });

  it('tells the caller when a manual check finds nothing', async () => {
    const harness = makeHarness();
    const onManualCheckResult = jest.fn();
    const controller = await setUpReleaseAutoUpdates({
      ...harness.options,
      onManualCheckResult,
    });

    await controller?.checkNow();
    harness.listeners.get('update-not-available')?.({ version: '1.3.1' });

    expect(onManualCheckResult).toHaveBeenCalledWith('up-to-date', undefined);
  });

  // THE NEGATIVE CONTROL FOR THE TEST ABOVE. Without it, an implementation
  // that reported every 'update-not-available' — including the four-hourly
  // ones nobody asked about — would pass the positive test and toast the user
  // six times a day.
  it('stays silent when a periodic check finds nothing', async () => {
    const harness = makeHarness();
    const onManualCheckResult = jest.fn();
    await setUpReleaseAutoUpdates({
      ...harness.options,
      onManualCheckResult,
    });

    // No checkNow: this is the startup check and the scheduled ones.
    harness.listeners.get('update-not-available')?.({ version: '1.3.1' });

    expect(onManualCheckResult).not.toHaveBeenCalled();
  });

  it('reports the version when a manual check starts a download', async () => {
    const harness = makeHarness();
    const onManualCheckResult = jest.fn();
    const controller = await setUpReleaseAutoUpdates({
      ...harness.options,
      onManualCheckResult,
    });

    await controller?.checkNow();
    harness.listeners.get('update-available')?.({ version: '1.3.3' });

    expect(onManualCheckResult).toHaveBeenCalledWith('downloading', '1.3.3');
  });

  it('reports a manual check that errors', async () => {
    const harness = makeHarness();
    const onManualCheckResult = jest.fn();
    const controller = await setUpReleaseAutoUpdates({
      ...harness.options,
      onManualCheckResult,
    });

    await controller?.checkNow();
    harness.listeners.get('error')?.(new Error('feed unreachable'));

    expect(onManualCheckResult).toHaveBeenCalledWith('failed', undefined);
  });

  it('reports a manual check whose request rejects outright', async () => {
    const harness = makeHarness();
    const onManualCheckResult = jest.fn();
    const controller = await setUpReleaseAutoUpdates({
      ...harness.options,
      onManualCheckResult,
    });
    // AFTER setup, or the startup check consumes the rejection and this test
    // silently exercises nothing — which is exactly what it did at first.
    (harness.updater.checkForUpdates as jest.Mock).mockRejectedValueOnce(
      new Error('DNS failure'),
    );

    await expect(controller?.checkNow()).rejects.toThrow('DNS failure');

    expect(onManualCheckResult).toHaveBeenCalledWith('failed', undefined);
  });

  it('answers each manual check once, not once per later event', async () => {
    const harness = makeHarness();
    const onManualCheckResult = jest.fn();
    const controller = await setUpReleaseAutoUpdates({
      ...harness.options,
      onManualCheckResult,
    });

    await controller?.checkNow();
    harness.listeners.get('update-not-available')?.({ version: '1.3.1' });
    // A later periodic cycle must not re-answer a question already answered.
    harness.listeners.get('update-not-available')?.({ version: '1.3.1' });
    harness.listeners.get('error')?.(new Error('unrelated later failure'));

    expect(onManualCheckResult).toHaveBeenCalledTimes(1);
  });

  it('does not call beforeQuit when the installer is unauthorized', async () => {
    const harness = makeHarness();
    const beforeQuit = jest.fn();
    const controller = await setUpReleaseAutoUpdates({
      ...harness.options,
      beforeQuit,
    });
    if (!controller) {
      throw new Error('setUpReleaseAutoUpdates returned no controller');
    }

    expect(() => controller.quitAndInstall(false, true)).toThrow(
      /release-channel verification/,
    );
    expect(beforeQuit).not.toHaveBeenCalled();
    expect(harness.updater.quitAndInstall).not.toHaveBeenCalled();
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
