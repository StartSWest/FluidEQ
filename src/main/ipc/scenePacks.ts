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
  createScenePackPublications,
  readPublications,
} from '../scenePackPublications';
import {
  createScenePackStore,
  type IScenePackListing,
  type IScenePackStore,
  type IScenePackSummary,
  isSceneFailure,
} from '../scenePackStore';
import type { ISceneRefusals } from '../sceneRefusals';

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
 * THE SERVER IS ASKED AT EVENTS — the window coming back, the looks being
 * opened, the account changing — and nothing here counts down. For an
 * entitled account each ask is a list of versions, and only a scene whose
 * publication changed is downloaded (`scenePackPublications.ts`).
 */

export interface IScenePacksIpcDeps {
  getMainWindow: () => BrowserWindow | null;
  userDataDir: string;
  config: IAccountConfig;
  session: IAccountSession;
  entitlement: IEntitlement;
  logger?: { info(message: string): void; warn(message: string): void };
  /** Scene code refused wherever it ran (`sceneRefusals.ts`). */
  refusals?: ISceneRefusals;
  /**
   * The scenes added from the gallery, asked about when the looks are opened
   * (`scene-packs-refresh`), so a member's republished scene arrives the same
   * way FluidEQ's own do.
   */
  refreshGalleryScenes?: () => Promise<void>;
  now?: () => number;
  fetchImpl?: typeof fetch;
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
  announce(): void;
  /**
   * Announce an event. An entitled account asks which scenes changed every
   * time; the catalogue for one that is not is fetched only when stale.
   */
  refreshIfDue(reason: string): Promise<void>;
  dispose(): void;
}

export const SCENE_PACKS_STALE_AFTER_MS = 4 * 60 * 60 * 1000;

const CHANNELS = [
  'scene-packs-list',
  'scene-packs-load',
  'scene-packs-remove',
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

export const registerScenePacksIpc = ({
  getMainWindow,
  userDataDir,
  config,
  session,
  entitlement,
  logger,
  refusals,
  refreshGalleryScenes,
  now = Date.now,
  fetchImpl = fetch,
}: IScenePacksIpcDeps): IScenePacksIpcRegistration => {
  const store = createScenePackStore({ userDataDir, logger, refusals });
  const catalogue = createScenePackCatalogue({
    userDataDir,
    config,
    fetchImpl,
    logger,
  });

  const publications = createScenePackPublications({ userDataDir, logger });

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

  /** One read of the packs table, parsed; undefined when it did not answer. */
  const readPacks = async (
    token: string,
    select: string,
    ids?: readonly string[],
  ): Promise<unknown> => {
    const url = new URL('/rest/v1/scene_packs', config.supabaseUrl);
    url.searchParams.set('select', select);
    if (ids) {
      // Every id has passed the pack id pattern, so none can reach outside
      // the list.
      url.searchParams.set('id', `in.(${ids.join(',')})`);
    }
    let response: Response;
    try {
      response = await fetchImpl(url.toString(), {
        headers: {
          apikey: config.supabaseAnonKey,
          Authorization: `Bearer ${token}`,
          Accept: 'application/json',
        },
      });
    } catch (error) {
      logger?.warn(`Scene pack listing could not reach the server: ${error}`);
      return undefined;
    }
    if (!response.ok) {
      logger?.warn(`Scene pack listing was answered ${response.status}.`);
      return undefined;
    }
    try {
      // Whole body, never streamed: see CLAUDE.md on `pipeline` and Node's
      // HTTP parser. A scene with artwork is about 11 MB; held, not piped.
      return JSON.parse(
        Buffer.from(await response.arrayBuffer()).toString('utf8'),
      );
    } catch {
      return undefined;
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
    // The small question first: which publication of each scene the server
    // has. Only the installed scenes whose answer changed are downloaded —
    // new scenes enter through an explicit Add.
    const server = readPublications(
      await readPacks(token, 'id,version,published_at'),
    );
    if (!entitled()) {
      return;
    }
    const changed = publications.changed(
      server,
      new Map(store.list().map((pack) => [pack.id, pack.version])),
    );
    if (changed.length === 0) {
      return;
    }
    const body = await readPacks(token, 'id,version,envelope', changed);
    if (body === undefined || !entitled()) {
      return;
    }
    const listings = readListings(body).filter((pack) =>
      changed.includes(pack.id),
    );
    const adopted = store.adopt(listings);
    // Taken whatever the store made of them: a pack that did not verify is
    // not downloaded again until the server publishes it again. A listing
    // newer than the answer it was asked from stays untaken, so the next
    // check brings the publication it belongs to.
    publications.took(
      server.filter((publication) =>
        listings.some(
          (listing) =>
            listing.id === publication.id &&
            listing.version === publication.version,
        ),
      ),
    );
    if (adopted > 0) {
      logger?.info(`Scene packs: ${adopted} brought up to date.`);
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
   * An account that is entitled asks at every event: the question is a list
   * of versions, and a scene is downloaded only when its publication changed,
   * so a scene republished reaches the listener the next time the window
   * comes back or the looks are opened. The catalogue an account that is not
   * entitled fetches is still rationed; it only names what Plus holds.
   */
  const isDue = () =>
    entitled() || now() - catalogueFetchedAt >= SCENE_PACKS_STALE_AFTER_MS;

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

  // The looks being opened: both kinds of installed scene are asked about, and
  // the answer waits for the official ones, which the listing is made of.
  ipcMain.handle('scene-packs-refresh', async () => {
    await Promise.all([
      refreshNow(),
      refreshGalleryScenes?.().catch((error) =>
        logger?.warn(`Gallery scenes could not be checked: ${String(error)}`),
      ),
    ]);
    return listing();
  });

  ipcMain.handle('scene-packs-remove', (_event, id: unknown) => {
    if (typeof id !== 'string') {
      return false;
    }
    try {
      const removed = store.remove(id);
      if (removed) {
        announce();
      }
      return removed;
    } catch {
      return false;
    }
  });

  ipcMain.handle(
    'scene-packs-report-failure',
    (_event, id: unknown, reason: unknown) => {
      if (typeof id === 'string' && isSceneFailure(reason)) {
        // Its source too, read before the quarantine hides it: the gallery's
        // preview, the lamps and its picture run the same code elsewhere.
        const pack = store.load(id);
        if (pack) {
          refusals?.refuse(pack.source, reason);
        }
        store.quarantine(id, reason);
        announce();
      }
    },
  );

  return {
    store,
    announce,
    refreshIfDue: async () => {
      // Not logged: for an entitled account this is every focus of the
      // window. A download says so when one happens.
      if (!isDue()) {
        return;
      }
      await refreshNow();
    },
    dispose: () => {
      unsubscribe();
      CHANNELS.forEach((channel) => ipcMain.removeHandler(channel));
    },
  };
};
