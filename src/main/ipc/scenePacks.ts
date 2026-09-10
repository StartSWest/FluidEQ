import fs from 'fs';
import path from 'path';
import { BrowserWindow, ipcMain } from 'electron';
import type { IAccountConfig } from '../../common/accountConfig';
import {
  isScenePackEnvelope,
  type IScenePackCatalogueEntry,
} from '../../common/scenePacks';
import type { IEntitlement } from '../account/entitlement';
import type { IAccountSession } from '../account/session';
import { createScenePackCatalogue } from '../scenePackCatalogue';
import {
  createScenePackStore,
  type IScenePackListing,
  type IScenePackStore,
  type IScenePackSummary,
  type TSceneFailure,
} from '../scenePackStore';

/**
 * Premium looks, as the renderer sees them.
 *
 * The renderer asks what is held, asks for one pack's contents when it is about
 * to draw it, and reports back when one would not run. Fetching, verifying and
 * caching stay here; so does the question of whether the account is entitled,
 * which is answered fresh on every list and every load rather than once at
 * startup — a subscription that lapses mid-session stops being offered at the
 * next switch, and one that starts mid-session is offered at the next look.
 *
 * THE SERVER IS ASKED AT EVENTS, on the same staleness rule as the account and
 * the update checker. Nothing here counts down.
 */

export interface IScenePacksIpcDeps {
  getMainWindow: () => BrowserWindow | null;
  userDataDir: string;
  config: IAccountConfig;
  session: IAccountSession;
  entitlement: IEntitlement;
  logger?: { info(message: string): void; warn(message: string): void };
  now?: () => number;
  fetchImpl?: typeof fetch;
  /**
   * DEVELOPMENT ONLY. A directory of `*.envelope.json` files — the signing
   * tool's output — adopted at startup as if the server had sent them. Every
   * envelope still has to verify against the compiled-in key; this shortens
   * the path to the cache, it does not bypass the gate on it. `main.ts` sets
   * it solely when the app is not packaged.
   */
  developmentPacksDir?: string;
}

export interface IScenePacksListing {
  /** Whether the account may draw these right now. */
  entitled: boolean;
  packs: IScenePackSummary[];
  /**
   * The Plus looks this account cannot draw — every one the server lists,
   * whenever the account is not entitled, and none at all when it is. The
   * picker shows them locked, and choosing one opens the upgrade card.
   */
  locked: IScenePackCatalogueEntry[];
}

export interface IScenePacksIpcRegistration {
  store: IScenePackStore;
  /** Announce an event; a fetch follows only if the last one is stale. */
  refreshIfDue(reason: string): Promise<void>;
  dispose(): void;
}

export const SCENE_PACKS_STALE_AFTER_MS = 4 * 60 * 60 * 1000;

const CHANNELS = [
  'scene-packs-list',
  'scene-packs-load',
  'scene-packs-refresh',
  'scene-packs-report-failure',
] as const;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null;

/** Server rows → listings; anything malformed is dropped, not guessed at. */
const readListings = (body: unknown): IScenePackListing[] => {
  if (!Array.isArray(body)) {
    return [];
  }
  const listings: IScenePackListing[] = [];
  body.forEach((row) => {
    if (!isRecord(row)) {
      return;
    }
    const { id, version, envelope } = row;
    if (
      typeof id === 'string' &&
      typeof version === 'number' &&
      Number.isInteger(version) &&
      isScenePackEnvelope(envelope)
    ) {
      listings.push({ id, version, envelope });
    }
  });
  return listings;
};

/**
 * Signed envelopes from a local directory, shaped like server rows. The id and
 * version come from the verified payload later; here the file only has to be
 * an envelope at all. Anything else in the directory is ignored.
 */
const readDevelopmentEnvelopes = (directory: string): IScenePackListing[] => {
  let names: string[];
  try {
    names = fs.readdirSync(directory);
  } catch {
    return [];
  }
  const listings: IScenePackListing[] = [];
  names
    .filter((name) => name.endsWith('.envelope.json'))
    .forEach((name) => {
      try {
        const envelope: unknown = JSON.parse(
          fs.readFileSync(path.join(directory, name), 'utf8'),
        );
        if (!isScenePackEnvelope(envelope)) {
          return;
        }
        const payload: unknown = JSON.parse(
          Buffer.from(envelope.payload, 'base64').toString('utf8'),
        );
        if (
          isRecord(payload) &&
          typeof payload.id === 'string' &&
          typeof payload.version === 'number'
        ) {
          listings.push({ id: payload.id, version: payload.version, envelope });
        }
      } catch {
        // A half-written file from the tool mid-run. Skipped, not fatal.
      }
    });
  return listings;
};

export const registerScenePacksIpc = ({
  getMainWindow,
  userDataDir,
  config,
  session,
  entitlement,
  logger,
  now = Date.now,
  fetchImpl = fetch,
  developmentPacksDir,
}: IScenePacksIpcDeps): IScenePacksIpcRegistration => {
  const store = createScenePackStore({ userDataDir, logger });
  const catalogue = createScenePackCatalogue({
    userDataDir,
    config,
    fetchImpl,
    logger,
  });

  const adoptDevelopmentPacks = () => {
    if (!developmentPacksDir) {
      return;
    }
    const envelopes = readDevelopmentEnvelopes(developmentPacksDir);
    const adopted = store.adopt(envelopes);
    // A pack being iterated on gets a fresh chance on launch or an explicit
    // refresh. The normal signature checks still precede every cache write.
    envelopes.forEach((listing) => store.release(listing.id));
    logger?.info(
      `Development scene packs: ${adopted} adopted from ${developmentPacksDir}.`,
    );
  };
  adoptDevelopmentPacks();
  let lastFetchedAt = 0;
  let catalogueFetchedAt = 0;
  let inFlight: Promise<void> | undefined;

  const entitled = () => entitlement.status().state !== 'none';

  const listing = (): IScenePacksListing => {
    const isEntitled = entitled();
    return {
      entitled: isEntitled,
      packs: store.list(),
      locked: isEntitled ? [] : catalogue.list(),
    };
  };

  const announce = () => {
    getMainWindow()?.webContents.send('scene-packs-changed', listing());
  };

  /**
   * What an account that is not entitled fetches instead of the packs: the
   * public list of what it is missing. Anonymous on purpose — the picker is
   * on screen before anyone has signed in.
   */
  const fetchCatalogue = async () => {
    const changed = await catalogue.refresh();
    catalogueFetchedAt = now();
    if (changed) {
      announce();
    }
  };

  const fetchListings = async () => {
    if (!entitled()) {
      await fetchCatalogue();
      return;
    }
    let token: string;
    try {
      token = await session.accessToken();
    } catch {
      return;
    }
    let response: Response;
    try {
      const url = new URL('/rest/v1/scene_packs', config.supabaseUrl);
      url.searchParams.set('select', 'id,version,envelope');
      response = await fetchImpl(url.toString(), {
        headers: {
          apikey: config.supabaseAnonKey,
          Authorization: `Bearer ${token}`,
          Accept: 'application/json',
        },
      });
    } catch (error) {
      logger?.warn(`Scene pack listing could not reach the server: ${error}`);
      return;
    }
    lastFetchedAt = now();
    if (!response.ok) {
      logger?.warn(`Scene pack listing was answered ${response.status}.`);
      return;
    }
    let body: unknown;
    try {
      // Whole body, never streamed: see CLAUDE.md on `pipeline` and Node's
      // HTTP parser. A few hundred kilobytes is nothing to hold in memory.
      body = JSON.parse(
        Buffer.from(await response.arrayBuffer()).toString('utf8'),
      );
    } catch {
      return;
    }
    if (store.adopt(readListings(body)) > 0) {
      announce();
    }
  };

  const refreshNow = () => {
    inFlight =
      inFlight ??
      fetchListings().finally(() => {
        inFlight = undefined;
      });
    return inFlight;
  };

  /**
   * The staleness rule, one for each of the two things fetched. An account
   * that is not entitled fetches the catalogue; one that is fetches the
   * packs, and the catalogue is not needed because nothing is locked.
   */
  const isDue = () =>
    now() - (entitled() ? lastFetchedAt : catalogueFetchedAt) >=
    SCENE_PACKS_STALE_AFTER_MS;

  // A subscription starting is the one moment "recent enough" does not apply:
  // whoever just paid wants the looks now. A subscription ending changes what
  // the picker may offer — the looks turn into locked rows — and the renderer
  // has to hear that too, with a catalogue to paint them from if it has none.
  const unsubscribe = entitlement.subscribe((status) => {
    announce();
    if (status.state !== 'none' || isDue()) {
      refreshNow().catch(() => undefined);
    }
  });

  ipcMain.handle('scene-packs-list', () => {
    // The renderer asking is an event like any other: the picker is about to
    // be painted, which is when a list worth having is worth fetching. Not
    // awaited — the cache answers now and a change is announced when it comes.
    if (isDue()) {
      refreshNow().catch(() => undefined);
    }
    return listing();
  });

  ipcMain.handle('scene-packs-load', (_event, id: unknown) => {
    if (typeof id !== 'string' || !entitled()) {
      return undefined;
    }
    return store.load(id);
  });

  ipcMain.handle('scene-packs-refresh', async () => {
    // Private packs are authored outside the app tree, so renderer hot reload
    // cannot see a new signed build. Refresh adopts that build through the
    // same verifier as downloads; packaged apps never receive this directory.
    if (developmentPacksDir) {
      adoptDevelopmentPacks();
      announce();
    }
    await refreshNow();
    return listing();
  });

  ipcMain.handle(
    'scene-packs-report-failure',
    (_event, id: unknown, reason: unknown) => {
      if (
        typeof id === 'string' &&
        (reason === 'compile' || reason === 'context-lost')
      ) {
        store.quarantine(id, reason as TSceneFailure);
        announce();
      }
    },
  );

  return {
    store,
    refreshIfDue: async (reason) => {
      if (!isDue()) {
        return;
      }
      logger?.info(`Refreshing scene packs after ${reason}.`);
      await refreshNow();
    },
    dispose: () => {
      unsubscribe();
      CHANNELS.forEach((channel) => ipcMain.removeHandler(channel));
    },
  };
};
