import fs from 'fs';
import path from 'path';
import { execFile } from 'child_process';
import { promisify } from 'util';
import { app } from 'electron';
import {
  IAutoEqDatabaseManifest,
  IAutoEqUpdateStatus,
} from '../common/constants';

const execFileAsync = promisify(execFile);
const RELEASE_API =
  'https://api.github.com/repos/StartSWest/FluidEQ/releases/tags/autoeq-database';
const MANIFEST_NAME = 'autoeq-version.json';
const ARCHIVE_NAME = 'autoeq-database.zip';

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

const readManifest = (manifestPath: string): IAutoEqDatabaseManifest =>
  JSON.parse(fs.readFileSync(manifestPath, 'utf8')) as IAutoEqDatabaseManifest;

const getCurrentManifest = () => {
  const downloaded = downloadedManifestPath();
  return readManifest(
    fs.existsSync(downloaded) ? downloaded : bundledManifestPath()
  );
};

const fetchJson = async <Type>(url: string): Promise<Type> => {
  const response = await fetch(url, {
    headers: {
      Accept: 'application/vnd.github+json',
      'User-Agent': 'FluidEQ-AutoEq-Updater',
    },
  });
  if (!response.ok) throw new Error(`GitHub returned HTTP ${response.status}`);
  return (await response.json()) as Type;
};

const getReleaseAssets = async () => {
  const release = await fetchJson<IReleaseResponse>(RELEASE_API);
  const manifest = release.assets.find((asset) => asset.name === MANIFEST_NAME);
  const archive = release.assets.find((asset) => asset.name === ARCHIVE_NAME);
  if (!manifest || !archive) throw new Error('AutoEq database assets are missing.');
  return { manifest, archive };
};

export const checkAutoEqUpdate = async (): Promise<IAutoEqUpdateStatus> => {
  const current = getCurrentManifest();
  const { manifest } = await getReleaseAssets();
  const latest = await fetchJson<IAutoEqDatabaseManifest>(
    manifest.browser_download_url
  );
  return {
    current,
    latest,
    updateAvailable: latest.sourceCommit !== current.sourceCommit,
  };
};

const validateDatabase = (databasePath: string, expectedModels: number) => {
  const models = fs
    .readdirSync(databasePath, { withFileTypes: true })
    .filter((entry) => entry.isDirectory());
  if (models.length !== expectedModels || models.length < 1000) {
    throw new Error('The downloaded AutoEq database failed validation.');
  }
};

export const updateAutoEqDatabase = async (): Promise<IAutoEqUpdateStatus> => {
  const { archive, manifest } = await getReleaseAssets();
  const latest = await fetchJson<IAutoEqDatabaseManifest>(
    manifest.browser_download_url
  );
  const userDataDir = app.getPath('userData');
  const updateDir = path.join(userDataDir, `autoeq-update-${Date.now()}`);
  const archivePath = path.join(updateDir, ARCHIVE_NAME);
  const extractedDir = path.join(updateDir, 'extracted');
  const downloadedDir = path.join(userDataDir, 'autoeq');
  const backupDir = path.join(userDataDir, 'autoeq-backup');

  fs.mkdirSync(extractedDir, { recursive: true });
  try {
    const response = await fetch(archive.browser_download_url, {
      headers: { 'User-Agent': 'FluidEQ-AutoEq-Updater' },
    });
    if (!response.ok) throw new Error(`Download failed with HTTP ${response.status}`);
    fs.writeFileSync(archivePath, Buffer.from(await response.arrayBuffer()));

    await execFileAsync(process.platform === 'win32' ? 'tar.exe' : 'tar', [
      '-xf',
      archivePath,
      '-C',
      extractedDir,
    ]);
    const nextDatabase = path.join(extractedDir, 'autoeq');
    validateDatabase(nextDatabase, latest.modelCount);

    if (fs.existsSync(backupDir)) fs.rmSync(backupDir, { recursive: true });
    if (fs.existsSync(downloadedDir)) fs.renameSync(downloadedDir, backupDir);
    try {
      fs.renameSync(nextDatabase, downloadedDir);
      fs.writeFileSync(downloadedManifestPath(), JSON.stringify(latest, null, 2));
      if (fs.existsSync(backupDir)) fs.rmSync(backupDir, { recursive: true });
    } catch (error) {
      if (fs.existsSync(downloadedDir)) fs.rmSync(downloadedDir, { recursive: true });
      if (fs.existsSync(backupDir)) fs.renameSync(backupDir, downloadedDir);
      throw error;
    }
  } finally {
    if (fs.existsSync(updateDir)) fs.rmSync(updateDir, { recursive: true });
  }

  return { current: latest, latest, updateAvailable: false };
};
