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

/**
 * Keep the bundled OPRA library current.
 *
 * The database is republished as an asset on our own version releases, and
 * downloaded from there rather than from OPRA directly. Two reasons: the
 * archive carries our own layout, not OPRA's JSONL; and OPRA asks commercial
 * consumers to mirror the dataset instead of leaning on the CDN they run as a
 * courtesy for open-source projects. FluidEQ is sold, so we mirror.
 *
 * Where it is published and how often it is asked is `opraFeed.ts`: one fixed
 * prerelease, read through release downloads rather than the REST API, once a
 * day at most, conditionally, and never inside a rate limit's reset.
 *
 * The version check compares a hash of the upstream dataset. Its predecessor
 * compared AutoEq's upstream commit id, which had not moved since July 2025 and
 * never will again — so `updateAvailable` was structurally incapable of being
 * true, and a database three times the size of the bundled one sat published
 * and unreachable. Hashing the content cannot fail that way.
 */

import fs from 'fs';
import path from 'path';
import { execFile } from 'child_process';
import { promisify } from 'util';
import { app } from 'electron';
import log from 'electron-log';
import { IOpraDatabaseManifest, IOpraUpdateStatus } from '../common/constants';
import { isOpraProductId, isOpraShardName } from '../common/opraIds';
import writeFileAtomically from './atomicWrite';
import { forgetOpraIndex } from './opra';
import {
  IOpraFeedState,
  OPRA_ARCHIVE_URL,
  parseOpraFeedState,
  readOpraManifest,
} from './opraFeed';

const execFileAsync = promisify(execFile);
const MANIFEST_NAME = 'opra-version.json';
const ARCHIVE_NAME = 'opra-database.zip';
const FEED_STATE_NAME = 'opra-feed.json';

/**
 * The most the library may weigh. The September 2026 library is 10.5 MB
 * unpacked (a 2.1 MB index and 714 shards) and a few MB zipped; many times
 * that is not a library, it is something else wearing its name, and the
 * archive is read into memory whole before it is written.
 */
const MAX_ARCHIVE_BYTES = 64 * 1024 * 1024;
const MAX_DATABASE_BYTES = 256 * 1024 * 1024;

const bundledManifestPath = () =>
  app.isPackaged
    ? path.join(process.resourcesPath, 'assets', MANIFEST_NAME)
    : path.join(__dirname, '../../assets', MANIFEST_NAME);

const downloadedManifestPath = () =>
  path.join(app.getPath('userData'), MANIFEST_NAME);

const readManifest = (manifestPath: string): IOpraDatabaseManifest =>
  JSON.parse(fs.readFileSync(manifestPath, 'utf8')) as IOpraDatabaseManifest;

const getCurrentManifest = () => {
  const downloaded = downloadedManifestPath();
  return readManifest(
    fs.existsSync(downloaded) ? downloaded : bundledManifestPath(),
  );
};

const feedStatePath = () => path.join(app.getPath('userData'), FEED_STATE_NAME);

const readFeedState = (): IOpraFeedState => {
  try {
    return parseOpraFeedState(fs.readFileSync(feedStatePath(), 'utf8'));
  } catch {
    // No file yet, or one that cannot be read: ask as a first launch would.
    return {};
  }
};

/**
 * The newest published manifest, by `opraFeed`'s rules, with what it decided
 * kept for the next launch. A rate limit is one line in the log when it
 * starts, and silence while it lasts.
 */
const latestManifest = async (): Promise<IOpraDatabaseManifest | undefined> => {
  const before = readFeedState();
  const answer = await readOpraManifest(before, Date.now(), fetch);
  if (answer.state !== before) {
    writeFileAtomically(feedStatePath(), JSON.stringify(answer.state, null, 2));
  }
  if (
    answer.outcome === 'rate-limited' &&
    answer.state.notBefore !== before.notBefore &&
    answer.state.notBefore !== undefined
  ) {
    log.info(
      `OPRA database check postponed until ${new Date(
        answer.state.notBefore,
      ).toISOString()}: rate limited by GitHub`,
    );
  }
  return answer.latest;
};

export const checkOpraUpdate = async (): Promise<IOpraUpdateStatus> => {
  const current = getCurrentManifest();
  const latest = await latestManifest();
  return {
    current,
    latest,
    updateAvailable:
      latest !== undefined && latest.contentHash !== current.contentHash,
  };
};

/**
 * Synchronize the bundled OPRA database with the published one, by the
 * feed's once-a-day rules (`opraFeed.ts`).
 * A current database is left untouched; a newer release is downloaded and
 * swapped in atomically by updateOpraDatabase.
 */
export const syncOpraDatabase = async (): Promise<IOpraUpdateStatus> => {
  const status = await checkOpraUpdate();
  return status.updateAvailable ? updateOpraDatabase() : status;
};

/**
 * Refuse anything that is not recognisably the library.
 *
 * A truncated download, a wrong asset or an archive built by a broken importer
 * all land here as something that would replace a working database with a
 * useless one — and the old copy has already been moved aside by then.
 *
 * Nothing but the release it hangs on vouches for the archive, so its shape is
 * held to exactly what the importer writes: `index.json` and
 * `curves/<vendor>.json`, plain files, no links, every product id one the
 * reader accepts. A link or a stray name would otherwise be followed later by
 * a process that trusts its own folder.
 */
export const validateDatabase = (
  databasePath: string,
  expected: IOpraDatabaseManifest,
) => {
  const entriesOf = (dir: string) =>
    fs.readdirSync(dir).map((name) => ({
      name,
      stats: fs.lstatSync(path.join(dir, name)),
    }));
  const top = entriesOf(databasePath);
  const plainTop =
    top.length === 2 &&
    top.some(({ name, stats }) => name === 'index.json' && stats.isFile()) &&
    top.some(({ name, stats }) => name === 'curves' && stats.isDirectory());
  if (!plainTop) {
    throw new Error('The downloaded OPRA database is not the library.');
  }
  const indexPath = path.join(databasePath, 'index.json');
  const shards = entriesOf(path.join(databasePath, 'curves'));
  const bytes = shards.reduce(
    (total, { stats }) => total + stats.size,
    fs.lstatSync(indexPath).size,
  );
  if (
    bytes > MAX_DATABASE_BYTES ||
    shards.some(({ name, stats }) => !stats.isFile() || !isOpraShardName(name))
  ) {
    throw new Error('The downloaded OPRA database holds more than curves.');
  }
  const { products } = JSON.parse(fs.readFileSync(indexPath, 'utf8')) as {
    products?: unknown[];
  };
  if (
    !Array.isArray(products) ||
    products.length !== expected.productCount ||
    products.length < 1000 ||
    !products.every(
      (product) =>
        typeof product === 'object' &&
        product !== null &&
        isOpraProductId((product as { id?: unknown }).id),
    )
  ) {
    throw new Error('The downloaded OPRA database failed validation.');
  }
  if (shards.length < expected.vendorCount) {
    throw new Error('The downloaded OPRA database is missing curve data.');
  }
};

export const updateOpraDatabase = async (): Promise<IOpraUpdateStatus> => {
  const latest = await latestManifest();
  if (!latest) {
    throw new Error('No OPRA database is published to update from.');
  }
  const userDataDir = app.getPath('userData');
  const updateDir = path.join(userDataDir, `opra-update-${Date.now()}`);
  const archivePath = path.join(updateDir, ARCHIVE_NAME);
  const extractedDir = path.join(updateDir, 'extracted');
  const downloadedDir = path.join(userDataDir, 'opra');
  const backupDir = path.join(userDataDir, 'opra-backup');

  fs.mkdirSync(extractedDir, { recursive: true });
  try {
    // Published beside the manifest and replaced with it (`--clobber` on
    // both), and checked against it below, product count and all.
    const response = await fetch(OPRA_ARCHIVE_URL, {
      headers: { 'User-Agent': 'FluidEQ-Opra-Updater' },
    });
    if (!response.ok) {
      throw new Error(`Download failed with HTTP ${response.status}`);
    }
    const declared = Number(response.headers.get('content-length'));
    if (Number.isFinite(declared) && declared > MAX_ARCHIVE_BYTES) {
      throw new Error('The OPRA database archive is too large.');
    }
    // Read it all, then write it. Streaming this through `pipeline` trips an
    // assertion inside Node's HTTP parser when the disk lags the socket.
    const archiveBytes = Buffer.from(await response.arrayBuffer());
    if (archiveBytes.length > MAX_ARCHIVE_BYTES) {
      throw new Error('The OPRA database archive is too large.');
    }
    fs.writeFileSync(archivePath, archiveBytes);

    await execFileAsync(process.platform === 'win32' ? 'tar.exe' : 'tar', [
      '-xf',
      archivePath,
      '-C',
      extractedDir,
    ]);
    const nextDatabase = path.join(extractedDir, 'opra');
    validateDatabase(nextDatabase, latest);

    if (fs.existsSync(backupDir)) {
      fs.rmSync(backupDir, { recursive: true });
    }
    if (fs.existsSync(downloadedDir)) {
      fs.renameSync(downloadedDir, backupDir);
    }
    try {
      fs.renameSync(nextDatabase, downloadedDir);
      fs.writeFileSync(
        downloadedManifestPath(),
        JSON.stringify(latest, null, 2),
      );
      if (fs.existsSync(backupDir)) {
        fs.rmSync(backupDir, { recursive: true });
      }
    } catch (error) {
      if (fs.existsSync(downloadedDir)) {
        fs.rmSync(downloadedDir, { recursive: true });
      }
      if (fs.existsSync(backupDir)) {
        fs.renameSync(backupDir, downloadedDir);
      }
      throw error;
    }
    // The cached index still describes the directory that was just replaced.
    forgetOpraIndex();
  } finally {
    if (fs.existsSync(updateDir)) {
      fs.rmSync(updateDir, { recursive: true });
    }
  }

  return { current: latest, latest, updateAvailable: false };
};
