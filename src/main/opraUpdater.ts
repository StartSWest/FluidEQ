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
 * The database is republished as an asset on a fixed release tag of our own
 * repository, and downloaded from there rather than from OPRA directly. Two
 * reasons: the archive carries our own layout, not OPRA's JSONL; and OPRA asks
 * commercial consumers to mirror the dataset instead of leaning on the CDN they
 * run as a courtesy for open-source projects. FluidEQ is sold, so we mirror.
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
import { IOpraDatabaseManifest, IOpraUpdateStatus } from '../common/constants';
import { forgetOpraIndex } from './opra';

const execFileAsync = promisify(execFile);
const RELEASE_API =
  'https://api.github.com/repos/StartSWest/FluidEQ/releases/tags/opra-database';
const MANIFEST_NAME = 'opra-version.json';
const ARCHIVE_NAME = 'opra-database.zip';

interface IReleaseAsset {
  name: string;
  browser_download_url: string;
}

interface IReleaseResponse {
  assets: IReleaseAsset[];
}

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

const fetchJson = async <Type>(url: string): Promise<Type> => {
  const response = await fetch(url, {
    headers: {
      Accept: 'application/vnd.github+json',
      'User-Agent': 'FluidEQ-Opra-Updater',
    },
  });
  if (!response.ok) {
    throw new Error(`GitHub returned HTTP ${response.status}`);
  }
  return (await response.json()) as Type;
};

const getReleaseAssets = async () => {
  const release = await fetchJson<IReleaseResponse>(RELEASE_API);
  const manifest = release.assets.find((asset) => asset.name === MANIFEST_NAME);
  const archive = release.assets.find((asset) => asset.name === ARCHIVE_NAME);
  if (!manifest || !archive) {
    throw new Error('OPRA database assets are missing.');
  }
  return { manifest, archive };
};

export const checkOpraUpdate = async (): Promise<IOpraUpdateStatus> => {
  const current = getCurrentManifest();
  const { manifest } = await getReleaseAssets();
  const latest = await fetchJson<IOpraDatabaseManifest>(
    manifest.browser_download_url,
  );
  return {
    current,
    latest,
    updateAvailable: latest.contentHash !== current.contentHash,
  };
};

/**
 * Synchronize the bundled OPRA database with the latest published release.
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
 */
const validateDatabase = (
  databasePath: string,
  expected: IOpraDatabaseManifest,
) => {
  const indexPath = path.join(databasePath, 'index.json');
  if (!fs.existsSync(indexPath)) {
    throw new Error('The downloaded OPRA database has no index.');
  }
  const { products } = JSON.parse(fs.readFileSync(indexPath, 'utf8')) as {
    products?: unknown[];
  };
  if (
    !Array.isArray(products) ||
    products.length !== expected.productCount ||
    products.length < 1000
  ) {
    throw new Error('The downloaded OPRA database failed validation.');
  }
  const curvesDir = path.join(databasePath, 'curves');
  if (
    !fs.existsSync(curvesDir) ||
    fs.readdirSync(curvesDir).length < expected.vendorCount
  ) {
    throw new Error('The downloaded OPRA database is missing curve data.');
  }
};

export const updateOpraDatabase = async (): Promise<IOpraUpdateStatus> => {
  const { archive, manifest } = await getReleaseAssets();
  const latest = await fetchJson<IOpraDatabaseManifest>(
    manifest.browser_download_url,
  );
  const userDataDir = app.getPath('userData');
  const updateDir = path.join(userDataDir, `opra-update-${Date.now()}`);
  const archivePath = path.join(updateDir, ARCHIVE_NAME);
  const extractedDir = path.join(updateDir, 'extracted');
  const downloadedDir = path.join(userDataDir, 'opra');
  const backupDir = path.join(userDataDir, 'opra-backup');

  fs.mkdirSync(extractedDir, { recursive: true });
  try {
    const response = await fetch(archive.browser_download_url, {
      headers: { 'User-Agent': 'FluidEQ-Opra-Updater' },
    });
    if (!response.ok) {
      throw new Error(`Download failed with HTTP ${response.status}`);
    }
    // Read it all, then write it. Streaming this through `pipeline` trips an
    // assertion inside Node's HTTP parser when the disk lags the socket.
    fs.writeFileSync(archivePath, Buffer.from(await response.arrayBuffer()));

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
