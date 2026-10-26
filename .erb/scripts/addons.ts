import { execFileSync } from 'child_process';
import fs from 'fs';
import path from 'path';

/**
 * Add-ons: code a developer keeps in their own checkout, under `addons/`
 * (git-ignored), that development loads and no release ever contains.
 *
 * Each add-on is a folder with a `main/index.ts`, a `renderer/index.tsx`, or
 * both. Development loads them (`dev-main.cjs`, the dev renderer's webpack
 * config); the release configs never call this file, and the release check
 * (`check-release-addons.ts`) refuses a package that holds any of them.
 * `FLUIDEQ_NO_ADDONS=1` runs development without them, to see the app as it
 * ships.
 */

export const ADDONS_DIR = path.resolve(__dirname, '../../addons');

export const addonsDisabled = () => process.env.FLUIDEQ_NO_ADDONS === '1';

const folders = (): string[] => {
  if (addonsDisabled() || !fs.existsSync(ADDONS_DIR)) {
    return [];
  }
  return fs
    .readdirSync(ADDONS_DIR, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && /^[a-z0-9-]+$/.test(entry.name))
    .map((entry) => path.join(ADDONS_DIR, entry.name))
    .sort();
};

const entriesOf = (file: string) =>
  folders()
    .map((folder) => path.join(folder, file))
    .filter((entry) => fs.existsSync(entry));

/** Each add-on's main-process entry, in name order. */
export const mainAddonEntries = () => entriesOf(path.join('main', 'index.ts'));

/** Each add-on's window entry, in name order. */
export const rendererAddonEntries = () =>
  entriesOf(path.join('renderer', 'index.tsx'));

/**
 * Brings every add-on that is its own git repository up to date before
 * development starts. Fast-forward only, and never fatal: offline, or with
 * work of its own in progress, an add-on runs as it is and says why.
 */
export const pullAddons = (log: (line: string) => void = console.warn) => {
  folders()
    .filter((folder) => fs.existsSync(path.join(folder, '.git')))
    .forEach((folder) => {
      try {
        execFileSync('git', ['-C', folder, 'pull', '--ff-only', '--quiet'], {
          stdio: ['ignore', 'ignore', 'pipe'],
        });
      } catch (error) {
        const reason =
          error instanceof Error ? error.message.split('\n')[0] : String(error);
        log(`Add-on ${path.basename(folder)} not updated: ${reason}`);
      }
    });
};
