/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { createHash } from 'crypto';
import fs from 'fs';
import path from 'path';
import type { IAppUpdateStatus } from '../common/constants';
import { isMandatoryUpdate } from '../common/mandatoryUpdate';
import type {
  IAuthorizedAutoUpdater,
  ManualCheckResult,
} from './signedAutoUpdates';
import { UNSIGNED_GITHUB_UPDATE_FEED } from './signedAutoUpdates';
import { verifyUpdateFeedSignature } from './updateFeedSignature';

/**
 * FluidEQ updating itself on a Mac.
 *
 * electron-updater's Mac path is Squirrel.Mac, and Squirrel.Mac installs only
 * an update whose code signature satisfies the running app's designated
 * requirement. An ad-hoc signature's requirement is its own code hash, so no
 * later build can ever satisfy it: with no Developer ID, Squirrel refuses
 * every update. The trust comes from the same place as the Windows GitHub
 * channel's instead — the release's `latest-mac.yml` must carry the maker's
 * feed signature (`updateFeedSignature.ts`), the zip must hash to the SHA-512
 * that signature covers, and the app inside must be FluidEQ, at that version,
 * with a signature `codesign` accepts.
 *
 * The new bundle is unpacked beside the running one, so the swap is two
 * renames on one volume, and the swap happens on Electron's `quit` — after
 * every window, helper and write has finished — with the relaunch Electron
 * starts once the process has gone. A copy macOS runs from a disk image or
 * from App Translocation, or one in a folder this account cannot write, has
 * no updater: nothing could be put in its place.
 */

const FEED_URL = `https://github.com/${UNSIGNED_GITHUB_UPDATE_FEED.owner}/${UNSIGNED_GITHUB_UPDATE_FEED.repo}/releases/latest/download/latest-mac.yml`;

const releaseAsset = (version: string, file: string) =>
  `https://github.com/${UNSIGNED_GITHUB_UPDATE_FEED.owner}/${UNSIGNED_GITHUB_UPDATE_FEED.repo}/releases/download/v${encodeURIComponent(version)}/${encodeURIComponent(file)}`;

/**
 * How stale a check must be before another is worth making: four hours, as
 * on Windows (`signedAutoUpdates.ts` says why this is not an interval —
 * checks run on the events that mean a person is back at the machine).
 */
const CHECK_STALE_AFTER_MS = 4 * 60 * 60 * 1000;

/** Read in pieces of this size, so a 200 MB zip is never held in memory. */
const HASH_CHUNK_BYTES = 1024 * 1024;

/** Leftovers of an update, kept beside the app and swept at launch. */
const STAGING_PREFIX = '.FluidEQ-update-';
const REPLACED_PREFIX = '.FluidEQ-replaced-';

interface IFeedFile {
  url: string;
  sha512: string;
  size?: number;
}

const unquote = (value: string) => value.trim().replace(/^(['"])(.*)\1$/, '$2');

/**
 * The fields of an electron-builder `latest-mac.yml`, without a YAML
 * library: top-level `key: value` lines, and the `files:` list of `url`,
 * `sha512` and `size`. Anything else is ignored, so a field this reader does
 * not know never changes what is verified.
 */
export const parseMacFeed = (yaml: string): Record<string, unknown> => {
  const info: Record<string, unknown> = {};
  const files: Partial<IFeedFile>[] = [];
  let inFiles = false;
  yaml.split(/\r?\n/).forEach((line) => {
    const top = /^([A-Za-z][\w-]*):\s*(.*)$/.exec(line);
    if (top) {
      inFiles = top[1] === 'files' && top[2] === '';
      if (!inFiles) {
        info[top[1]] = unquote(top[2]);
      }
      return;
    }
    if (!inFiles) {
      return;
    }
    const item = /^\s*(-\s+)?(url|sha512|size):\s*(.*)$/.exec(line);
    if (!item) {
      return;
    }
    if (item[1] || files.length === 0) {
      files.push({});
    }
    const file = files[files.length - 1];
    const value = unquote(item[3]);
    if (item[2] === 'size') {
      file.size = Number(value);
    } else {
      file[item[2] as 'url' | 'sha512'] = value;
    }
  });
  info.files = files;
  return info;
};

const versionParts = (version: string) =>
  version
    .split('-')[0]
    .split('.')
    .map((part) => Number.parseInt(part, 10));

/** Whether `candidate` is a later release than `current` (major.minor.patch). */
export const isNewerVersion = (candidate: string, current: string): boolean => {
  const next = versionParts(candidate);
  const now = versionParts(current);
  if ([...next, ...now].some((part) => !Number.isSafeInteger(part))) {
    return false;
  }
  for (let index = 0; index < Math.max(next.length, now.length); index += 1) {
    const difference = (next[index] ?? 0) - (now[index] ?? 0);
    if (difference !== 0) {
      return difference > 0;
    }
  }
  return false;
};

/**
 * The running bundle, from the executable inside it: `<bundle>.app/Contents/
 * MacOS/<name>`. Read from the path as written, either separator, so the
 * tests that run on Windows read a Mac path the way a Mac does.
 */
export const bundleOf = (executablePath: string): string | undefined =>
  /^(.+\.app)[\\/]Contents[\\/]MacOS[\\/][^\\/]+$/.exec(executablePath)?.[1];

/** Where macOS runs a copy that cannot be replaced: a disk image or App Translocation. */
const isUnreplaceable = (bundle: string) =>
  bundle.startsWith('/Volumes/') || bundle.includes('/AppTranslocation/');

export interface IMacSelfUpdateDeps {
  executablePath: string;
  currentVersion: string;
  isPackaged: boolean;
  platform: NodeJS.Platform;
  arch: string;
  logger: {
    info(message: string, ...details: unknown[]): void;
    warn(message: string, ...details: unknown[]): void;
    error(message: string, ...details: unknown[]): void;
  };
  sendStatus: (payload: IAppUpdateStatus) => void;
  onManualCheckResult?: (result: ManualCheckResult, version?: string) => void;
  /** Arms the tray's real-quit flag, as on Windows. */
  beforeQuit?: () => void;
  fetchText: (url: string) => Promise<string>;
  /** Writes `url` to `file`, reporting the bytes so far, and resolves once it is all on disk. */
  download: (
    url: string,
    file: string,
    onBytes: (received: number, total: number | undefined) => void,
  ) => Promise<void>;
  /** Runs a system tool and resolves with its standard output. */
  run: (file: string, args: readonly string[]) => Promise<string>;
  canWrite: (target: string) => Promise<boolean>;
  /** Electron's `quit`: the last moment before the process goes. */
  onQuit: (listener: () => void) => void;
  relaunch: () => void;
  quit: () => void;
  now?: () => number;
  /** The feed keys to trust; the build's own unless a test hands in its own. */
  feedKeys?: Readonly<Record<string, string>>;
}

const sha512Base64 = async (file: string) => {
  const hash = createHash('sha512');
  const handle = await fs.promises.open(file, 'r');
  try {
    const chunk = Buffer.alloc(HASH_CHUNK_BYTES);
    for (;;) {
      // eslint-disable-next-line no-await-in-loop -- one chunk at a time is the point
      const { bytesRead } = await handle.read(chunk, 0, chunk.length, null);
      if (bytesRead === 0) {
        break;
      }
      hash.update(chunk.subarray(0, bytesRead));
    }
  } finally {
    await handle.close();
  }
  return hash.digest('base64');
};

const sweepLeftovers = async (
  folder: string,
  logger: IMacSelfUpdateDeps['logger'],
) => {
  const entries = await fs.promises.readdir(folder).catch(() => [] as string[]);
  await Promise.all(
    entries
      .filter(
        (name) =>
          name.startsWith(STAGING_PREFIX) || name.startsWith(REPLACED_PREFIX),
      )
      .map((name) =>
        fs.promises
          .rm(path.join(folder, name), { recursive: true, force: true })
          .catch((error) =>
            logger.warn(`Could not remove the old update ${name}`, error),
          ),
      ),
  );
};

/**
 * The Mac's updater, or undefined (with the reason logged) where this copy
 * cannot be replaced. Same contract as `setUpReleaseAutoUpdates`.
 */
export const setUpMacSelfUpdates = async (
  deps: IMacSelfUpdateDeps,
): Promise<IAuthorizedAutoUpdater | undefined> => {
  const { logger, sendStatus, now = Date.now } = deps;
  if (deps.platform !== 'darwin') {
    return undefined;
  }
  if (!deps.isPackaged) {
    logger.info('Updates disabled: this is a development build.');
    return undefined;
  }
  const bundle = bundleOf(deps.executablePath);
  if (!bundle) {
    logger.warn('Updates disabled: FluidEQ is not running from an app bundle.');
    return undefined;
  }
  if (isUnreplaceable(bundle)) {
    logger.info(
      'Updates disabled: FluidEQ is running from a disk image or a translocated copy; move it to Applications.',
    );
    return undefined;
  }
  const folder = path.dirname(bundle);
  if (!(await deps.canWrite(folder)) || !(await deps.canWrite(bundle))) {
    logger.info(`Updates disabled: this account cannot replace ${bundle}.`);
    return undefined;
  }
  await sweepLeftovers(folder, logger);

  const plistOf = (app: string) => path.join(app, 'Contents', 'Info.plist');
  const readPlist = async (app: string, key: string) =>
    (
      await deps.run('/usr/bin/plutil', [
        '-extract',
        key,
        'raw',
        '-o',
        '-',
        plistOf(app),
      ])
    ).trim();
  const bundleId = await readPlist(bundle, 'CFBundleIdentifier');

  let ready: { version: string; app: string } | undefined;
  let isMandatoryPending = false;
  let isManualCheckPending = false;
  let isSwapArmed = false;
  let checking: Promise<void> | undefined;

  /**
   * What the check in flight has found, kept so a person who asks while it
   * runs gets that answer at once, even if it was reached a moment before
   * they asked, instead of waiting for a download to finish.
   */
  let verdict: { result: ManualCheckResult; version?: string } | undefined;

  const settleManualCheck = (result: ManualCheckResult, version?: string) => {
    verdict = { result, version };
    if (!isManualCheckPending) {
      return;
    }
    isManualCheckPending = false;
    deps.onManualCheckResult?.(result, version);
  };

  const fail = (reason: string, error?: unknown) => {
    logger.error(`Mac update failed: ${reason}`, ...(error ? [error] : []));
    settleManualCheck('failed');
    if (isMandatoryPending) {
      sendStatus({ phase: 'failed', isMandatory: true, failure: 'download' });
    }
  };

  const fetchAndStage = async (
    version: string,
    file: IFeedFile,
  ): Promise<string> => {
    const staging = path.join(folder, `${STAGING_PREFIX}${version}`);
    await fs.promises.rm(staging, { recursive: true, force: true });
    await fs.promises.mkdir(staging, { recursive: true });
    const zip = path.join(staging, 'update.zip');
    let lastPercent = -1;
    await deps.download(releaseAsset(version, file.url), zip, (got, total) => {
      const size = total ?? file.size;
      if (!size) {
        return;
      }
      const percent = Math.min(100, Math.floor((100 * got) / size));
      if (percent !== lastPercent) {
        lastPercent = percent;
        sendStatus({
          phase: 'downloading',
          percent,
          ...(isMandatoryPending ? { isMandatory: true } : {}),
        });
      }
    });
    if ((await sha512Base64(zip)) !== file.sha512) {
      throw new Error('the download does not match the signed feed');
    }
    await deps.run('/usr/bin/ditto', ['-x', '-k', zip, staging]);
    await fs.promises.rm(zip, { force: true });
    const app = path.join(staging, path.basename(bundle));
    if (!fs.existsSync(plistOf(app))) {
      throw new Error(`the update holds no ${path.basename(bundle)}`);
    }
    if ((await readPlist(app, 'CFBundleIdentifier')) !== bundleId) {
      throw new Error('the update is a different app');
    }
    if ((await readPlist(app, 'CFBundleShortVersionString')) !== version) {
      throw new Error('the update is not the version the feed names');
    }
    await deps.run('/usr/bin/codesign', [
      '--verify',
      '--deep',
      '--strict',
      app,
    ]);
    return app;
  };

  const check = async () => {
    verdict = undefined;
    const info = parseMacFeed(await deps.fetchText(FEED_URL));
    const feed = verifyUpdateFeedSignature(info, deps.feedKeys);
    if (!feed.valid) {
      fail(feed.reason || 'the update feed is not trusted');
      return;
    }
    const version = String(info.version);
    if (!isNewerVersion(version, deps.currentVersion)) {
      settleManualCheck('up-to-date');
      return;
    }
    if (ready?.version === version) {
      settleManualCheck('downloading', version);
      sendStatus({ phase: 'ready', version });
      return;
    }
    const files = (info.files as Partial<IFeedFile>[]).filter(
      (entry): entry is IFeedFile =>
        typeof entry.url === 'string' && typeof entry.sha512 === 'string',
    );
    const file =
      files.find(
        (entry) =>
          entry.url.endsWith('-mac.zip') && entry.url.includes(deps.arch),
      ) ?? files.find((entry) => entry.url.endsWith('-mac.zip'));
    if (!file) {
      fail(`release ${version} has no Mac zip`);
      return;
    }
    isMandatoryPending = isMandatoryUpdate(info);
    settleManualCheck('downloading', version);
    sendStatus({
      phase: 'available',
      version,
      ...(isMandatoryPending ? { isMandatory: true } : {}),
    });
    try {
      const app = await fetchAndStage(version, file);
      ready = { version, app };
      logger.info(`Mac update ${version} downloaded and verified`);
      sendStatus({
        phase: 'ready',
        version,
        ...(isMandatoryPending ? { isMandatory: true } : {}),
      });
    } catch (error) {
      fail(`update ${version} was refused (${(error as Error).message})`);
    }
  };

  /** One check at a time; a second caller shares the one in flight. */
  const checkForUpdates = () => {
    checking ??= check()
      .catch((error) => fail('the update feed could not be read', error))
      .finally(() => {
        checking = undefined;
      });
    return checking;
  };

  /**
   * Put the new bundle where the old one was. Run on Electron's `quit`, so
   * nothing of the old app is still being read; if the second rename fails
   * the first is undone, and the relaunch opens the version that was running.
   */
  const swap = () => {
    if (!ready) {
      return;
    }
    const aside = path.join(
      folder,
      `${REPLACED_PREFIX}${deps.currentVersion}.app`,
    );
    try {
      fs.rmSync(aside, { recursive: true, force: true });
      fs.renameSync(bundle, aside);
      try {
        fs.renameSync(ready.app, bundle);
      } catch (error) {
        fs.renameSync(aside, bundle);
        throw error;
      }
      logger.info(`Installed FluidEQ ${ready.version}`);
    } catch (error) {
      logger.error('The Mac update could not be put in place', error);
    }
  };

  let lastCheckAt = now();
  checkForUpdates().catch(() => undefined);
  logger.info(`Mac updates enabled from GitHub Releases: ${FEED_URL}`);

  return {
    quitAndInstall() {
      if (!ready) {
        throw new Error('No verified Mac update is waiting to be installed.');
      }
      if (!isSwapArmed) {
        isSwapArmed = true;
        deps.onQuit(swap);
      }
      deps.beforeQuit?.();
      deps.relaunch();
      deps.quit();
    },
    isReadyToInstall: () => Boolean(ready),
    checkNow: async () => {
      isManualCheckPending = true;
      lastCheckAt = now();
      if (checking && verdict) {
        settleManualCheck(verdict.result, verdict.version);
        return;
      }
      await (checking ?? checkForUpdates());
    },
    checkIfDue: async () => {
      if (now() - lastCheckAt < CHECK_STALE_AFTER_MS) {
        return false;
      }
      lastCheckAt = now();
      await checkForUpdates();
      return true;
    },
  };
};
