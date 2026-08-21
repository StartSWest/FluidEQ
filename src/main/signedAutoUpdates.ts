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

import { execFile } from 'child_process';
import path from 'path';
import type { NsisUpdater } from 'electron-updater';
import type { IAppUpdateStatus } from '../common/constants';
import { isMandatoryUpdate } from '../common/mandatoryUpdate';
import { POWERSHELL_PATH } from './powershell';

/**
 * How stale a check has to be before another one is worth making.
 *
 * NOT AN INTERVAL, AND NOTHING COUNTS IT DOWN. There is no timer in this
 * module: callers announce that something happened — the machine woke, the
 * screen unlocked, the window came back, the tray was clicked — and
 * `checkIfDue` compares the clock against the last check it made. A four-hour
 * gap picks up a release the same day without hammering a feed that moves a
 * few times a month.
 *
 * A `setInterval` was the obvious way to do this and it is the wrong one for
 * an app that lives in the notification area for weeks. Timers do not run
 * while the machine is asleep, so on a laptop the schedule silently stops and
 * then drifts by however long the lid was shut; the check would land at some
 * arbitrary hour with nobody at the keyboard to see the toast. Waking on a
 * real event instead means the check happens exactly when a person is coming
 * back to the machine, which is the only moment the notification is any use.
 */
const UPDATE_CHECK_STALE_AFTER_MS = 4 * 60 * 60 * 1000;

interface IAuthenticodeSignature {
  path: string;
  simpleName: string;
  status: string;
  subject: string;
}

export interface ISignatureVerification {
  valid: boolean;
  reason?: string;
}

type SignatureInspector = (
  executablePath: string,
) => Promise<IAuthenticodeSignature>;

export type PublisherVerifier = (
  executablePath: string,
  publisherName: string,
) => Promise<ISignatureVerification>;

export type UnsignedVerifier = (
  executablePath: string,
) => Promise<ISignatureVerification>;

interface IUpdateLogger {
  error(message?: unknown): void;
  info(message: string, ...args: unknown[]): void;
  warn(message: string, ...args: unknown[]): void;
}

/**
 * Optional boundary for a private feed.
 *
 * The implementation belongs to the website/API integration: it must exchange
 * an app/device credential for a short-lived, read-only token. It must never
 * return a Vercel Blob read-write token or another server credential. When a
 * provider is supplied, failure to mint a token cancels that update check;
 * there is deliberately no unauthenticated fallback.
 */
export type UpdateBearerTokenProvider = () => Promise<string>;

export interface IReleaseAutoUpdateOptions {
  executablePath: string;
  isPackaged: boolean;
  loadUpdater: () => NsisUpdater;
  logger: IUpdateLogger;
  platform: NodeJS.Platform;
  publisherName: string;
  sendStatus: (status: IAppUpdateStatus) => void;
  updateUrl: string;
  /**
   * Arm the "a real quit is happening" flag before app.quit() runs.
   *
   * Without this, the tray's `close` handler on the main window cancels the
   * exit — the same handler that stops the close button from ending the
   * process — and electron-updater's installer, which spawned detached, then
   * fails to replace a still-open executable. See tray.ts for the flag itself.
   * Passed as a hook rather than imported so this module stays free of the
   * tray it does not otherwise know about, and so a test can observe the
   * ordering without touching real Electron.
   */
  beforeQuit?: () => void;
  /**
   * Report the outcome of a check the user asked for by hand.
   *
   * Deliberately separate from `sendStatus`. `IAppUpdateStatus` describes an
   * update in flight and has no "nothing to do" phase on purpose — a periodic
   * check finding nothing happens several times a day and is not news. A
   * person who clicked "Check for updates" is owed an answer either way, and
   * this is the only channel that carries one.
   */
  onManualCheckResult?: (result: ManualCheckResult, version?: string) => void;
  getBearerToken?: UpdateBearerTokenProvider;
  /**
   * The clock `checkIfDue` reads. Injectable so a test can age a check
   * without waiting four hours, and so nothing here owns a timer.
   */
  now?: () => number;
  verifyPublisher?: PublisherVerifier;
  verifyUnsigned?: UnsignedVerifier;
}

export interface IAuthorizedAutoUpdater {
  quitAndInstall(isSilent?: boolean, isForceRunAfter?: boolean): void;
  /**
   * Run one update check now, whatever the clock says.
   *
   * The tray's "Check for updates" item calls this — somebody who asked is
   * not made to wait for the staleness window. Rejections are the caller's
   * to log.
   *
   * Whatever it finds is reported through `onManualCheckResult`, never
   * through the return value: the answer arrives on an updater event well
   * after the promise for the HTTP request has settled.
   */
  checkNow(): Promise<void>;
  /**
   * Check only if the last one has gone stale. Resolves to whether it ran.
   *
   * This is the background path, and it replaces what would otherwise be an
   * interval. Call it from anything that means a person has come back to the
   * machine — a wake, an unlock, the window being shown, the tray being
   * clicked. Firing it often is free; the staleness test does the deciding.
   */
  checkIfDue(): Promise<boolean>;
}

/**
 * How a check the user personally asked for turned out.
 *
 * Only exists for checks started from `checkNow`. A periodic check that finds
 * nothing must stay silent — that is the normal case, several times a day —
 * whereas somebody who clicked "Check for updates" asked a question and is
 * owed an answer even when the answer is "nothing to do".
 */
export type ManualCheckResult = 'up-to-date' | 'downloading' | 'failed';

export const UNSIGNED_GITHUB_UPDATE_FEED = {
  provider: 'github' as const,
  owner: 'StartSWest',
  repo: 'FluidEQ',
};

const buildPowershellScript = (executablePath: string) => {
  // A single-quoted PowerShell literal escapes an apostrophe by doubling it.
  // Keep the file name data, never syntax, even for an account name containing
  // an apostrophe. `-LiteralPath` then prevents wildcard interpretation.
  const literalPath = `'${executablePath.replace(/'/g, "''")}'`;
  return [
    `$signature = Get-AuthenticodeSignature -LiteralPath ${literalPath}`,
    '$certificate = $signature.SignerCertificate',
    '[pscustomobject]@{',
    '  path = [string]$signature.Path',
    '  status = [string]$signature.Status',
    "  subject = if ($null -eq $certificate) { '' } else { [string]$certificate.Subject }",
    "  simpleName = if ($null -eq $certificate) { '' } else { [string]$certificate.GetNameInfo([System.Security.Cryptography.X509Certificates.X509NameType]::SimpleName, $false) }",
    '} | ConvertTo-Json -Compress',
  ].join('\n');
};

/** Ask Windows, not the application, whether an executable is trusted. */
const inspectAuthenticodeSignature: SignatureInspector = (executablePath) =>
  new Promise((resolve, reject) => {
    execFile(
      POWERSHELL_PATH,
      [
        '-NoProfile',
        '-NonInteractive',
        '-InputFormat',
        'None',
        '-Command',
        buildPowershellScript(executablePath),
      ],
      { encoding: 'utf8', timeout: 20_000, windowsHide: true },
      (error, stdout, stderr) => {
        if (error) {
          reject(error);
          return;
        }
        if (stderr.trim()) {
          reject(
            new Error(
              `Authenticode verification wrote to stderr: ${stderr.trim()}`,
            ),
          );
          return;
        }
        try {
          const parsed = JSON.parse(stdout) as Partial<IAuthenticodeSignature>;
          if (
            typeof parsed.path !== 'string' ||
            typeof parsed.status !== 'string' ||
            typeof parsed.subject !== 'string' ||
            typeof parsed.simpleName !== 'string'
          ) {
            throw new Error('PowerShell returned incomplete signature data');
          }
          resolve(parsed as IAuthenticodeSignature);
        } catch (parseError) {
          reject(
            new Error(
              `Could not read Authenticode verification result: ${
                (parseError as Error).message
              }`,
            ),
          );
        }
      },
    );
  });

const isDistinguishedName = (publisherName: string) =>
  /(?:^|,)\s*[A-Za-z][A-Za-z0-9.]*=/.test(publisherName);

/**
 * Verify both Windows' trust decision and the exact publisher pinned at build
 * time. Any missing field, command failure, invalid signature, or mismatch is
 * a rejection. The same verifier protects the running executable and every
 * downloaded installer.
 */
export const verifyAuthenticodePublisher = async (
  executablePath: string,
  publisherName: string,
  inspect: SignatureInspector = inspectAuthenticodeSignature,
): Promise<ISignatureVerification> => {
  const expected = publisherName.trim();
  if (!expected) {
    return {
      valid: false,
      reason: 'no official update publisher is configured',
    };
  }

  let signature: IAuthenticodeSignature;
  try {
    signature = await inspect(executablePath);
  } catch (error) {
    return {
      valid: false,
      reason: `Authenticode verification could not be completed: ${
        (error as Error).message
      }`,
    };
  }

  if (signature.status !== 'Valid') {
    return {
      valid: false,
      reason: `Windows reported signature status ${signature.status || 'unknown'}`,
    };
  }

  const actualPublisher = isDistinguishedName(expected)
    ? signature.subject
    : signature.simpleName;
  if (actualPublisher !== expected) {
    return {
      valid: false,
      reason: `executable publisher is "${actualPublisher || 'missing'}", expected "${expected}"`,
    };
  }

  if (
    path.resolve(signature.path).toLowerCase() !==
    path.resolve(executablePath).toLowerCase()
  ) {
    return {
      valid: false,
      reason: 'Windows verified a different executable path',
    };
  }

  return { valid: true };
};

/**
 * Prove that Windows considers an executable genuinely unsigned. A valid
 * signature from any publisher is not an "unsigned build" and cannot enter the
 * GitHub channel; an indeterminate or broken signature also fails closed.
 */
export const verifyAuthenticodeUnsigned = async (
  executablePath: string,
  inspect: SignatureInspector = inspectAuthenticodeSignature,
): Promise<ISignatureVerification> => {
  let signature: IAuthenticodeSignature;
  try {
    signature = await inspect(executablePath);
  } catch (error) {
    return {
      valid: false,
      reason: `Authenticode verification could not be completed: ${
        (error as Error).message
      }`,
    };
  }

  if (
    path.resolve(signature.path).toLowerCase() !==
    path.resolve(executablePath).toLowerCase()
  ) {
    return {
      valid: false,
      reason: 'Windows verified a different executable path',
    };
  }

  if (signature.status !== 'NotSigned') {
    return {
      valid: false,
      reason:
        signature.status === 'Valid'
          ? `executable is signed by "${signature.simpleName || signature.subject || 'an unknown publisher'}"`
          : `Windows reported signature status ${signature.status || 'unknown'}`,
    };
  }

  if (signature.simpleName || signature.subject) {
    return {
      valid: false,
      reason: 'Windows returned a signer for an allegedly unsigned executable',
    };
  }

  return { valid: true };
};

const readHttpsUpdateUrl = (raw: string): string | undefined => {
  try {
    const updateUrl = new URL(raw.trim());
    if (updateUrl.protocol !== 'https:') {
      return undefined;
    }
    return updateUrl.toString();
  } catch {
    return undefined;
  }
};

const readBearerToken = async (provider: UpdateBearerTokenProvider) => {
  const token = (await provider()).trim();
  if (!token || /[\r\n]/.test(token)) {
    throw new Error('The update token endpoint returned an invalid token');
  }
  return token;
};

/**
 * Select exactly one release channel from OS-verified executable state and
 * compile-time pins. An explicitly unsigned package uses GitHub; an official
 * signed package uses only its generic HTTPS feed. Any ambiguous combination
 * returns before the updater, listeners, timers, or network are initialized.
 */
export const setUpReleaseAutoUpdates = async (
  options: IReleaseAutoUpdateOptions,
): Promise<IAuthorizedAutoUpdater | undefined> => {
  const {
    beforeQuit,
    executablePath,
    getBearerToken,
    isPackaged,
    loadUpdater,
    logger,
    onManualCheckResult,
    platform,
    publisherName,
    sendStatus,
    updateUrl: rawUpdateUrl,
    now = Date.now,
    verifyPublisher = verifyAuthenticodePublisher,
    verifyUnsigned = verifyAuthenticodeUnsigned,
  } = options;

  if (platform !== 'win32') {
    logger.info('Updates disabled: only packaged Windows builds can update.');
    return undefined;
  }
  if (!isPackaged) {
    logger.info('Updates disabled: this is a development build.');
    return undefined;
  }

  const expectedPublisher = publisherName.trim();
  const rawFeedPin = rawUpdateUrl.trim();
  const hasPublisherPin = expectedPublisher.length > 0;
  const hasFeedPin = rawFeedPin.length > 0;
  if (hasPublisherPin !== hasFeedPin) {
    logger.warn(
      'Updates disabled: signed release configuration is incomplete.',
    );
    return undefined;
  }

  const isSignedChannel = hasPublisherPin && hasFeedPin;
  const updateUrl = isSignedChannel
    ? readHttpsUpdateUrl(rawFeedPin)
    : undefined;
  if (isSignedChannel && !updateUrl) {
    logger.warn('Updates disabled: the signed build has no valid HTTPS feed.');
    return undefined;
  }

  const currentSignature = isSignedChannel
    ? await verifyPublisher(executablePath, expectedPublisher)
    : await verifyUnsigned(executablePath);
  if (!currentSignature.valid) {
    logger.warn(
      `Updates disabled: current executable does not match its release channel (${currentSignature.reason || 'signature verification failed'}).`,
    );
    return undefined;
  }

  // Loading electron-updater constructs its singleton. Keep that construction
  // beyond every trust check so an ambiguous build never initializes it.
  const updater = loadUpdater();
  updater.logger = logger;
  updater.autoInstallOnAppQuit = false;
  if (isSignedChannel) {
    updater.setFeedURL({ provider: 'generic', url: updateUrl as string });
  } else {
    updater.setFeedURL(UNSIGNED_GITHUB_UPDATE_FEED);
  }

  const verifyInstaller = (installerPath: string) =>
    isSignedChannel
      ? verifyPublisher(installerPath, expectedPublisher)
      : verifyUnsigned(installerPath);

  // electron-updater calls this in its NSIS download path when app-update.yml
  // contains publisherName. Unsigned builds do not have that field, so the
  // update-downloaded listener below repeats the check unconditionally and the
  // returned controller gates the only installation path.
  updater.verifyUpdateCodeSignature = async (
    _publisherNames,
    installerPath,
  ) => {
    const verification = await verifyInstaller(installerPath);
    return verification.valid
      ? null
      : verification.reason || 'Authenticode verification failed';
  };

  let isMandatoryPending = false;
  let hasDownloaded = false;
  let isInstallerAuthorized = false;

  /**
   * Whether a check the user started is still waiting for its verdict.
   *
   * Set by `checkNow` and cleared by whichever updater event answers it
   * first. A periodic check that resolves while this is set will answer the
   * manual one instead — which is not a bug: "is there an update" has one
   * true answer at any moment, and whose request produced it does not change
   * it. What the flag prevents is the opposite and much worse case, a
   * periodic check nobody asked about raising a toast.
   */
  let isManualCheckPending = false;

  const settleManualCheck = (result: ManualCheckResult, version?: string) => {
    if (!isManualCheckPending) {
      return;
    }
    isManualCheckPending = false;
    onManualCheckResult?.(result, version);
  };

  updater.on('update-not-available', () => {
    settleManualCheck('up-to-date');
  });

  updater.on('update-available', (info) => {
    hasDownloaded = false;
    isInstallerAuthorized = false;
    if (isMandatoryUpdate(info)) {
      isMandatoryPending = true;
      logger.info(`Update ${info.version} is marked mandatory`);
    }
    // The download that follows can take minutes, and for a tray-resident
    // window there is nothing on screen saying so. Answering the manual check
    // here rather than waiting for 'ready' is what stops the click looking
    // like it did nothing.
    settleManualCheck('downloading', info.version);
    sendStatus({
      phase: 'available',
      version: info.version,
      ...(isMandatoryPending ? { isMandatory: true } : {}),
    });
  });

  updater.on('download-progress', (progress) => {
    sendStatus({
      phase: 'downloading',
      percent: Math.round(progress.percent),
      ...(isMandatoryPending ? { isMandatory: true } : {}),
    });
  });

  updater.on('update-downloaded', (info) => {
    // A rejection and a failed verification are the same outcome to a user, so
    // they share one path: the installer stays unauthorized and the only route
    // that can run it refuses.
    const rejectDownload = (reason: string) => {
      logger.error(`Downloaded update rejected: ${reason}`);
      if (isMandatoryPending) {
        sendStatus({ phase: 'failed', isMandatory: true, failure: 'download' });
      }
    };

    const authorize = async () => {
      try {
        const verification = await verifyInstaller(info.downloadedFile);
        if (!verification.valid) {
          rejectDownload(
            verification.reason || 'Authenticode verification failed',
          );
          return;
        }

        hasDownloaded = true;
        isInstallerAuthorized = true;
        sendStatus({
          phase: 'ready',
          version: info.version,
          ...(isMandatoryPending ? { isMandatory: true } : {}),
        });
      } catch (error) {
        rejectDownload(
          `Authenticode verification failed (${(error as Error).message})`,
        );
      }
    };

    authorize().catch(() => undefined);
  });

  updater.on('error', (error) => {
    logger.info('Update check failed', error);
    settleManualCheck('failed');
    if (isMandatoryPending && !hasDownloaded) {
      sendStatus({ phase: 'failed', isMandatory: true, failure: 'download' });
    }
  });

  const checkForUpdates = async () => {
    if (isSignedChannel && getBearerToken) {
      // Refreshed before every check. electron-updater reuses requestHeaders
      // for latest.yml, blockmaps, and the installer download.
      updater.addAuthHeader(`Bearer ${await readBearerToken(getBearerToken)}`);
    }
    await updater.checkForUpdates();
  };

  /**
   * A check the user asked for, which owes them an answer.
   *
   * The flag is armed before the request and disarmed by whichever event
   * answers it. A throw here — minting a token failed, the feed is
   * unreachable in a way that rejects rather than emitting 'error' — is
   * itself an answer, so it settles the check before propagating.
   */
  const checkNow = async () => {
    isManualCheckPending = true;
    // An explicit check counts as a check: without this the next wake event
    // would fire another one seconds later for no reason.
    lastCheckAt = now();
    try {
      await checkForUpdates();
    } catch (error) {
      settleManualCheck('failed');
      throw error;
    }
  };

  let lastCheckAt = now();
  checkForUpdates().catch((error) => {
    logger.info('Update check could not start', error);
  });

  /**
   * Check, but only if the last one is old enough to be worth repeating.
   *
   * Called from the events that mean a person is back at the machine — see
   * the note on UPDATE_CHECK_STALE_AFTER_MS for why those and not a timer.
   * Several of them can fire together (a wake is usually followed by an
   * unlock, which is usually followed by the window being shown), so the age
   * test is what keeps three signals from becoming three requests.
   *
   * The timestamp moves before the request rather than after it, so a check
   * that is slow or that fails does not invite the next event to start
   * another one on top of it.
   */
  const checkIfDue = async () => {
    const elapsed = now() - lastCheckAt;
    if (elapsed < UPDATE_CHECK_STALE_AFTER_MS) {
      return false;
    }
    lastCheckAt = now();
    await checkForUpdates();
    return true;
  };

  logger.info(
    isSignedChannel
      ? `Signed updates enabled from the official HTTPS feed: ${updateUrl}`
      : `Unsigned updates enabled from GitHub Releases: ${UNSIGNED_GITHUB_UPDATE_FEED.owner}/${UNSIGNED_GITHUB_UPDATE_FEED.repo}`,
  );

  return {
    quitAndInstall(isSilent, isForceRunAfter) {
      if (!isInstallerAuthorized) {
        throw new Error(
          'The downloaded installer has not passed release-channel verification.',
        );
      }
      // Arm the tray's "real quit" flag before app.quit() runs — otherwise the
      // window's close handler cancels the exit and the detached installer
      // fails to replace a still-open executable. See the note on
      // `beforeQuit` in IReleaseAutoUpdateOptions above.
      beforeQuit?.();
      updater.quitAndInstall(isSilent, isForceRunAfter);
    },
    checkNow,
    checkIfDue,
  };
};
