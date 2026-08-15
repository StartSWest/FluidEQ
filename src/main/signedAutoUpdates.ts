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

const UPDATE_CHECK_INTERVAL_MS = 60 * 60 * 1000;

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
  getBearerToken?: UpdateBearerTokenProvider;
  schedule?: typeof setInterval;
  verifyPublisher?: PublisherVerifier;
  verifyUnsigned?: UnsignedVerifier;
}

export interface IAuthorizedAutoUpdater {
  quitAndInstall(isSilent?: boolean, isForceRunAfter?: boolean): void;
}

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
    executablePath,
    getBearerToken,
    isPackaged,
    loadUpdater,
    logger,
    platform,
    publisherName,
    sendStatus,
    updateUrl: rawUpdateUrl,
    schedule = setInterval,
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

  updater.on('update-available', (info) => {
    hasDownloaded = false;
    isInstallerAuthorized = false;
    if (isMandatoryUpdate(info)) {
      isMandatoryPending = true;
      logger.info(`Update ${info.version} is marked mandatory`);
    }
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

  checkForUpdates().catch((error) => {
    logger.info('Update check could not start', error);
  });
  schedule(() => {
    checkForUpdates().catch((error) => {
      logger.info('Scheduled update check could not start', error);
    });
  }, UPDATE_CHECK_INTERVAL_MS);

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
      updater.quitAndInstall(isSilent, isForceRunAfter);
    },
  };
};
