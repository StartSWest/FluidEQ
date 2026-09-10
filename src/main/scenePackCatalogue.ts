import fs from 'fs';
import path from 'path';
import type { IAccountConfig } from '../common/accountConfig';
import {
  normalizeCatalogueEntry,
  type IScenePackCatalogueEntry,
} from '../common/scenePacks';

/**
 * The Plus looks that exist, for an account that cannot draw them.
 *
 * The picker shows every Plus look as a locked row before anyone subscribes —
 * the name, the icon, the tag — so the free app says what Plus is instead of
 * hiding it, and choosing a locked row opens the upgrade card. This is the
 * list those rows are painted from: the server's public catalogue, which
 * answers names and colours and never a shader. It is asked with the app's
 * publishable key alone, because the picker exists before there is an
 * account to speak for.
 *
 * Kept on disk so the rows are there at the next launch before the network
 * answers, and there at all when it never does. A plain file, not
 * `safeStorage`: there is nothing in it that is not on the product page.
 *
 * Nothing here counts down. The IPC layer asks for a refresh at the same
 * events the packs and the subscription use, and this module only says
 * whether the answer changed.
 */

const FILE = path.join('scene-packs', 'catalogue.json');

export interface IScenePackCatalogue {
  /** What the server last said exists, verified for shape. */
  list(): IScenePackCatalogueEntry[];
  /** Ask the server again. Resolves to whether the list changed. */
  refresh(): Promise<boolean>;
}

export interface IScenePackCatalogueOptions {
  userDataDir: string;
  config: IAccountConfig;
  fetchImpl?: typeof fetch;
  logger?: { info(message: string): void; warn(message: string): void };
}

const readEntries = (body: unknown): IScenePackCatalogueEntry[] => {
  if (!Array.isArray(body)) {
    return [];
  }
  const seen = new Set<string>();
  const entries: IScenePackCatalogueEntry[] = [];
  body.forEach((row) => {
    const entry = normalizeCatalogueEntry(row);
    if (entry && !seen.has(entry.id)) {
      seen.add(entry.id);
      entries.push(entry);
    }
  });
  return entries;
};

/**
 * The cache holds server rows, not app entries, so the file is read through
 * the same checks the network answer is — one parser, one shape, and a stale
 * file from an older build is filtered exactly as a stale server would be.
 */
const toRow = (entry: IScenePackCatalogueEntry) => ({
  id: entry.id,
  version: entry.version,
  names: entry.names,
  fallback_style: entry.fallbackStyle,
  swatch: entry.swatch,
});

const sameList = (
  a: readonly IScenePackCatalogueEntry[],
  b: readonly IScenePackCatalogueEntry[],
) => JSON.stringify(a) === JSON.stringify(b);

/** Atomic write, as every other cache under userData does it. */
const writeAtomically = (filePath: string, contents: string) => {
  const temporaryPath = `${filePath}.tmp`;
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  try {
    fs.writeFileSync(temporaryPath, contents, 'utf8');
    fs.renameSync(temporaryPath, filePath);
  } catch (error) {
    try {
      fs.rmSync(temporaryPath, { force: true });
    } catch {
      // Preserve the original error if cleanup also fails.
    }
    throw error;
  }
};

export const createScenePackCatalogue = ({
  userDataDir,
  config,
  fetchImpl = fetch,
  logger,
}: IScenePackCatalogueOptions): IScenePackCatalogue => {
  const filePath = path.join(userDataDir, FILE);

  const readCached = (): IScenePackCatalogueEntry[] => {
    try {
      return readEntries(JSON.parse(fs.readFileSync(filePath, 'utf8')));
    } catch {
      return [];
    }
  };

  let entries = readCached();

  return {
    list: () => entries,

    refresh: async () => {
      let response: Response;
      try {
        // A remote procedure rather than a table: the packs table is readable
        // only by a paying account, and this is the one door through it that
        // gives away nothing worth paying for.
        const url = new URL('/rest/v1/rpc/scene_catalogue', config.supabaseUrl);
        response = await fetchImpl(url.toString(), {
          headers: {
            apikey: config.supabaseAnonKey,
            Authorization: `Bearer ${config.supabaseAnonKey}`,
            Accept: 'application/json',
          },
        });
      } catch (error) {
        logger?.warn(`Scene catalogue could not reach the server: ${error}`);
        return false;
      }
      if (!response.ok) {
        logger?.warn(`Scene catalogue was answered ${response.status}.`);
        return false;
      }
      let body: unknown;
      try {
        // Whole body, never streamed: see CLAUDE.md on `pipeline` and Node's
        // HTTP parser. A catalogue is a few kilobytes.
        body = JSON.parse(
          Buffer.from(await response.arrayBuffer()).toString('utf8'),
        );
      } catch {
        return false;
      }
      const next = readEntries(body);
      if (sameList(entries, next)) {
        return false;
      }
      entries = next;
      try {
        writeAtomically(filePath, JSON.stringify(next.map(toRow)));
      } catch (error) {
        logger?.warn(`Scene catalogue could not be cached: ${error}`);
      }
      logger?.info(`Scene catalogue: ${next.length} looks listed.`);
      return true;
    },
  };
};
