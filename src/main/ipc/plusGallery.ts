import { ipcMain } from 'electron';
import type { IMemberScenePayload } from '../../common/memberSceneFile';
import { memberLookId } from '../../common/memberScenes';
import {
  cleanGalleryQuery,
  FLUIDEQ_CREATOR_ID,
  isGallerySort,
  isPlusCategory,
  isReportReason,
  type IGalleryQuery,
  type IGalleryScene,
  type IGalleryVersion,
} from '../../common/plusGallery';
import {
  premiumLookId,
  type IScenePack,
  type IScenePackEnvelope,
} from '../../common/scenePacks';
import { openMemberEnvelope } from '../memberScenes/sharing';
import type { IMemberSceneStore } from '../memberScenes/store';
import {
  fetchEnvelope,
  fetchPicture,
  listGallery,
  listVersions,
  recordAdd,
  reportScene,
  type TGalleryFailure,
} from '../plus/galleryApi';
import { sceneRefOf, type IGalleryAccess } from '../plus/galleryAccess';
import { createPictureCache } from '../plus/pictureCache';
import {
  createPictureDiskCache,
  type IPictureDiskCache,
} from '../plus/pictureDiskCache';
import { fetchOfficialScene } from '../plus/officialGallery';
import { fetchTasteSamples } from '../plus/tasteSamples';
import type { IScenePackStore } from '../scenePackStore';
import { createGallerySceneSync } from '../plus/syncGalleryScenes';
import { createGalleryRefresh } from '../plus/galleryRefresh';

/**
 * The Plus gallery, over IPC: listing it, its pictures, a scene's page, Add
 * and Report. The member's own publishing is in `plusPublishing.ts`.
 *
 * Browsing is for every account: the list, the pictures, a scene playing on
 * its page and a report need somebody signed in and nothing more, so a
 * member without Plus sees what Plus members make — the page gives them ten
 * seconds of it. Keeping a scene — Add — needs Plus, asked afresh on every
 * call. A scene from the gallery comes in through the same door as a file
 * somebody sent: the signature against the member key, every rule on the
 * pack, then the block list — so neither the page nor Add can take in
 * something "Open a scene file" would refuse.
 *
 * NO PATH EVER COMES FROM THE PAGE. The page names scenes by author and scene
 * id, both checked the way a look id is, and a query is rebuilt from only the
 * parts of it that check out.
 */

export type TGalleryListOutcome =
  | { ok: true; scenes: IGalleryScene[]; more: boolean }
  | { ok: false; reason: TGalleryFailure };

export type TGalleryVersionsOutcome =
  | { ok: true; versions: IGalleryVersion[] }
  | { ok: false; reason: TGalleryFailure };

/** Why a scene from the gallery could not be shown or added. */
export type TGallerySceneFailure =
  | 'not-entitled'
  /** Could not be downloaded: offline, or taken down a moment ago. */
  | 'unavailable'
  | 'blocked'
  /** Downloaded, but not a scene the member key vouches for. */
  | 'changed';

export type TGalleryPreviewOutcome =
  | { ok: true; pack: IScenePack; own: boolean }
  | { ok: false; reason: TGallerySceneFailure };

export type TGalleryAddOutcome =
  | { ok: true; lookId: string }
  | { ok: false; reason: TGallerySceneFailure | 'refused' };

export interface IPlusGalleryIpcDeps {
  access: IGalleryAccess;
  store: IMemberSceneStore;
  /** Asks for the block list now; from sharing's registration. */
  refreshBlocked: () => Promise<void>;
  /** Tell the renderer the list of member scenes changed. */
  announce: () => void;
  /** Subscribe to Plus switching on or off; answers the unsubscribe. */
  onEntitlementChange: (listener: () => void) => () => void;
  officialStore?: IScenePackStore;
  announceOfficial?: () => void;
  logger?: { warn(message: string): void };
  /** The clock the list's block-list check reads; replaced in tests. */
  now?: () => number;
  /**
   * Where gallery pictures are kept between sessions (`pictureDiskCache.ts`).
   * Without one, pictures are kept for the session only.
   */
  pictureDir?: string;
}

export interface IPlusGalleryRegistration {
  /**
   * Asks the makers of the installed scenes for their newest, every time
   * (`plus/galleryRefresh.ts`); `force` runs once more after a check already
   * under way.
   */
  refreshIfDue(force?: boolean): Promise<void>;
  /**
   * Settles once the installed copies the lists asked about are up to date.
   * A list answers before that sync ends (`plus-gallery-list`), so this is
   * the one way to know it has.
   */
  whenSynced(): Promise<void>;
  dispose(): void;
}

const CHANNELS = [
  'plus-gallery-list',
  'plus-gallery-picture',
  'plus-gallery-preview',
  'plus-gallery-add',
  'plus-gallery-report',
  'plus-gallery-samples',
  'plus-gallery-versions',
] as const;

/**
 * Pictures kept in memory, by the bytes they take. A picture is 1280 by 720
 * and usually 100-400KB, so this holds a gallery page or two of cards.
 */
const PICTURE_CACHE_BYTES = 48 * 1024 * 1024;

/**
 * Pictures kept on disk, by the bytes they take: at 100-400KB each, several
 * hundred cards — more than a member browses between two releases of the
 * gallery's scenes.
 */
export const PICTURE_DISK_BYTES = 128 * 1024 * 1024;

/**
 * Scene files kept from the scene's page for its Add button, so pressing it
 * does not download the same file twice. Only the last few pages opened.
 */
const PREVIEW_CACHE_SCENES = 4;

/**
 * How old the block list may be for a gallery page to lean on it. A page only
 * filters what the server has already filtered; adding or importing a scene
 * still asks for the list every time, and the bucket refuses a blocked
 * scene's files to a preview whatever this computer's copy says.
 */
export const BLOCKED_FOR_LIST_MS = 10 * 60 * 1000;

/** Deeper than anyone scrolls; past it the query is not the gallery's. */
const MAX_OFFSET = 6000;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

/** A query from the page, rebuilt from only the parts that check out. */
const readQuery = (value: unknown): IGalleryQuery => {
  const raw = isRecord(value) ? value : {};
  const author =
    typeof raw.authorId === 'string'
      ? sceneRefOf(raw.authorId, 'probe')?.authorId
      : undefined;
  const offset =
    typeof raw.offset === 'number' && Number.isInteger(raw.offset)
      ? Math.min(Math.max(raw.offset, 0), MAX_OFFSET)
      : 0;
  const query = cleanGalleryQuery(raw.query);
  return {
    sort: isGallerySort(raw.sort) ? raw.sort : 'liked',
    offset,
    ...(isPlusCategory(raw.category) ? { category: raw.category } : {}),
    ...(author ? { authorId: author } : {}),
    ...(query ? { query } : {}),
  };
};

interface IFetchedScene {
  envelope: IScenePackEnvelope;
  payload: IMemberScenePayload;
  revision: string;
}

const readRevision = (value: unknown) =>
  typeof value === 'string' &&
  value.length <= 40 &&
  Number.isFinite(Date.parse(value))
    ? value
    : '';

export const registerPlusGalleryIpc = ({
  access,
  store,
  refreshBlocked,
  announce,
  onEntitlementChange,
  officialStore,
  announceOfficial,
  logger,
  now = Date.now,
  pictureDir,
}: IPlusGalleryIpcDeps): IPlusGalleryRegistration => {
  const syncInstalled = createGallerySceneSync({
    access,
    store,
    officialStore,
    announce,
    announceOfficial,
    logger,
  });
  const pictures = createPictureCache(PICTURE_CACHE_BYTES);
  const kept: IPictureDiskCache | undefined = pictureDir
    ? createPictureDiskCache({ dir: pictureDir, maxBytes: PICTURE_DISK_BYTES })
    : undefined;
  const picturesInFlight = new Map<string, Promise<string | undefined>>();
  const listsInFlight = new Map<string, Promise<TGalleryListOutcome>>();
  // Never, so the first page of a session asks.
  let lastBlockedForList = -Infinity;
  const previews = new Map<string, IFetchedScene>();

  const picture = async (
    authorId: string,
    sceneId: string,
    version: number,
    revision: string,
  ): Promise<string | undefined> => {
    const key = `${authorId}/${sceneId}@${version}:${revision}`;
    const cached = pictures.get(key);
    if (cached) {
      return cached;
    }
    // From disk only with a revision to name it by — without one the file
    // could be an older picture of the same version — and never for a scene
    // blocked since it was kept: the bucket would refuse it, so this does too.
    const fromDisk =
      revision && !store.isBlocked(authorId, sceneId)
        ? await kept?.read(key)
        : undefined;
    const auth = fromDisk ? undefined : await access.auth();
    const bytes =
      fromDisk ??
      (auth ? await fetchPicture(auth, authorId, sceneId) : undefined);
    if (!bytes) {
      // A failure is not remembered: the next time the card is on screen is
      // the next chance.
      return undefined;
    }
    if (!fromDisk && revision) {
      // Kept for the next session, before the picture is handed over: a few
      // milliseconds after a download, and nothing is left writing once the
      // card shows. A disk that will not take it costs only that — the
      // picture is still shown.
      await kept
        ?.write(key, bytes)
        .catch((error) =>
          logger?.warn(`Could not keep a gallery picture: ${String(error)}`),
        );
    }
    // A data URL is what the page's content policy lets an <img> show, and it
    // is only ever built from bytes that are a WebP by their own header.
    const dataUrl = `data:image/webp;base64,${Buffer.from(bytes).toString('base64')}`;
    pictures.put(key, dataUrl);
    return dataUrl;
  };

  /**
   * One scene from the gallery, verified, or why not. The version is the one
   * the gallery row showed: a page opened on it can reuse the file its
   * preview already downloaded, and a newer file is simply fetched.
   */
  const fetchScene = async (
    authorId: string,
    sceneId: string,
    version?: number,
    revision = '',
  ): Promise<IFetchedScene | TGallerySceneFailure> => {
    const lookId = memberLookId(authorId, sceneId);
    const kept = previews.get(lookId);
    if (
      kept &&
      kept.revision === revision &&
      version !== undefined &&
      kept.payload.pack.version === version
    ) {
      return kept;
    }
    const auth = await access.auth();
    const envelope = auth
      ? await fetchEnvelope(auth, authorId, sceneId)
      : undefined;
    if (!envelope) {
      return 'unavailable';
    }
    const payload = openMemberEnvelope(envelope);
    // The file must be the scene that was asked for: a row pointing at
    // somebody else's work is refused however well it is signed.
    if (
      !payload ||
      payload.author.id !== authorId ||
      payload.pack.id !== sceneId
    ) {
      return 'changed';
    }
    const fetched = { envelope, payload, revision };
    previews.delete(lookId);
    previews.set(lookId, fetched);
    if (previews.size > PREVIEW_CACHE_SCENES) {
      const [oldest] = previews.keys();
      previews.delete(oldest);
    }
    return fetched;
  };

  const forgetEverything = () => {
    pictures.clear();
    previews.clear();
  };

  /** Anybody signed in may browse; the server answers nobody else. */
  const signedIn = () => access.accountId() !== undefined;

  /**
   * One page of the gallery. The server's gallery query is the most expensive
   * thing this app asks it, so each is asked once: a page already on its way
   * for the same account is shared rather than asked again, and nothing else
   * holds the answer up.
   */
  const listPage = async (
    query: IGalleryQuery,
  ): Promise<TGalleryListOutcome> => {
    const auth = await access.auth();
    const listed = auth
      ? await listGallery(auth, query)
      : ({ ok: false, reason: 'signed-out' } as const);
    if (!listed.ok) {
      return listed;
    }
    // The block list, when it is older than a list page may trust. The server
    // leaves blocked scenes out of this answer already, so a page does not
    // need the newest copy — only one recent enough that the local filter
    // below agrees with it; it used to be fetched again for every page.
    if (
      access.entitled() &&
      now() - lastBlockedForList >= BLOCKED_FOR_LIST_MS
    ) {
      lastBlockedForList = now();
      await refreshBlocked();
    }
    // Installed copies of these scenes are brought up to date behind the
    // answer, not before it: the sync announces what it changes, and a page
    // used to wait on a newer version of a 12MB official scene downloading.
    syncInstalled(listed.scenes).catch((error) =>
      logger?.warn(`Could not update installed scenes: ${String(error)}`),
    );
    // The server leaves blocked scenes out already; the list this computer
    // holds is asked as well, so the two can never disagree on screen.
    return {
      ok: true,
      scenes: listed.scenes.filter(
        (scene) => !store.isBlocked(scene.authorId, scene.sceneId),
      ),
      more: listed.more,
    };
  };

  // The official scenes a free account can taste live; empty when the list
  // could not be asked.
  ipcMain.handle('plus-gallery-samples', async (): Promise<string[]> => {
    const auth = await access.auth();
    return (auth && (await fetchTasteSamples(auth))) || [];
  });

  ipcMain.handle(
    'plus-gallery-list',
    (_event, rawQuery: unknown): Promise<TGalleryListOutcome> => {
      const me = access.accountId();
      if (me === undefined) {
        return Promise.resolve({ ok: false, reason: 'signed-out' });
      }
      const query = readQuery(rawQuery);
      const key = `${me}:${JSON.stringify(query)}`;
      const inFlight = listsInFlight.get(key);
      if (inFlight) {
        return inFlight;
      }
      const request = listPage(query).finally(() => listsInFlight.delete(key));
      listsInFlight.set(key, request);
      return request;
    },
  );

  ipcMain.handle(
    'plus-gallery-picture',
    (
      _event,
      authorId: unknown,
      sceneId: unknown,
      version: unknown,
      rawRevision: unknown,
    ) => {
      const ref = sceneRefOf(authorId, sceneId);
      if (
        !ref ||
        !signedIn() ||
        typeof version !== 'number' ||
        !Number.isInteger(version) ||
        version < 1
      ) {
        return undefined;
      }
      const revision = readRevision(rawRevision);
      const key = `${ref.authorId}/${ref.packId}@${version}:${revision}`;
      const inFlight = picturesInFlight.get(key);
      if (inFlight) {
        return inFlight;
      }
      const request = picture(
        ref.authorId,
        ref.packId,
        version,
        revision,
      ).finally(() => picturesInFlight.delete(key));
      picturesInFlight.set(key, request);
      return request;
    },
  );

  ipcMain.handle(
    'plus-gallery-preview',
    async (
      _event,
      authorId: unknown,
      sceneId: unknown,
      version: unknown,
      rawRevision: unknown,
    ): Promise<TGalleryPreviewOutcome> => {
      // Anyone signed in may open a scene's page. With Plus it plays for as
      // long as they like; without, only the scenes chosen as free samples
      // play, for the taste the page gives, and the rest show their picture.
      // The server decides which (0023): the whole scene reaches the machine
      // that plays it, and a rebuilt app keeps whatever it is given.
      const ref = sceneRefOf(authorId, sceneId);
      const previewAccount = access.accountId();
      if (!ref || !signedIn()) {
        return { ok: false, reason: 'not-entitled' };
      }
      if (ref.authorId === FLUIDEQ_CREATOR_ID) {
        const me = access.accountId();
        const auth = await access.auth();
        const fetched = auth
          ? await fetchOfficialScene(auth, ref.packId)
          : undefined;
        if (fetched === 'plus-required') {
          return { ok: false, reason: 'not-entitled' };
        }
        const pack = fetched?.pack;
        if (!pack || me !== access.accountId()) {
          return { ok: false, reason: 'unavailable' };
        }
        return { ok: true, pack, own: false };
      }
      // A member's scene file is Plus's and its author's (server migration
      // 0023); asking for it without either is a refusal already known.
      if (!access.entitled() && ref.authorId !== previewAccount) {
        return { ok: false, reason: 'not-entitled' };
      }
      if (store.isBlocked(ref.authorId, ref.packId)) {
        return { ok: false, reason: 'blocked' };
      }
      const fetched = await fetchScene(
        ref.authorId,
        ref.packId,
        typeof version === 'number' ? version : undefined,
        readRevision(rawRevision),
      );
      if (typeof fetched === 'string') {
        return { ok: false, reason: fetched };
      }
      if (access.accountId() !== previewAccount || !signedIn()) {
        return { ok: false, reason: 'not-entitled' };
      }
      return {
        ok: true,
        pack: fetched.payload.pack,
        own: fetched.payload.author.id === access.accountId(),
      };
    },
  );

  ipcMain.handle(
    'plus-gallery-add',
    async (
      _event,
      authorId: unknown,
      sceneId: unknown,
      version: unknown,
      rawRevision: unknown,
    ): Promise<TGalleryAddOutcome> => {
      const ref = sceneRefOf(authorId, sceneId);
      const me = access.accountId();
      if (!ref || !access.entitled() || !me) {
        return { ok: false, reason: 'not-entitled' };
      }
      if (ref.authorId === FLUIDEQ_CREATOR_ID) {
        const auth = await access.auth();
        const fetched = auth
          ? await fetchOfficialScene(auth, ref.packId)
          : undefined;
        if (!access.entitled() || access.accountId() !== me) {
          return { ok: false, reason: 'not-entitled' };
        }
        if (typeof fetched !== 'object' || !officialStore) {
          return { ok: false, reason: 'unavailable' };
        }
        try {
          officialStore.adopt(
            [
              {
                id: fetched.pack.id,
                version: fetched.pack.version,
                envelope: fetched.envelope,
              },
            ],
            true,
          );
          if (!officialStore.load(ref.packId)) {
            return { ok: false, reason: 'refused' };
          }
          announceOfficial?.();
          return { ok: true, lookId: premiumLookId(ref.packId) };
        } catch (error) {
          logger?.warn(
            `Adding an official gallery scene failed: ${String(error)}`,
          );
          return { ok: false, reason: 'refused' };
        }
      }
      // A scene blocked since the list was last asked must not slip in.
      await refreshBlocked();
      if (store.isBlocked(ref.authorId, ref.packId)) {
        return { ok: false, reason: 'blocked' };
      }
      const fetched = await fetchScene(
        ref.authorId,
        ref.packId,
        typeof version === 'number' ? version : undefined,
        readRevision(rawRevision),
      );
      if (typeof fetched === 'string') {
        return { ok: false, reason: fetched };
      }
      if (!access.entitled() || access.accountId() !== me) {
        return { ok: false, reason: 'not-entitled' };
      }
      if (store.isBlocked(ref.authorId, ref.packId)) {
        return { ok: false, reason: 'blocked' };
      }
      try {
        // The member's own scene comes back as their own — editable, and
        // theirs to export — exactly as it does from a file.
        if (ref.authorId === me) {
          store.save(me, fetched.payload.pack);
        } else {
          store.saveImported(fetched.envelope);
        }
      } catch (error) {
        logger?.warn(`Adding a gallery scene failed: ${String(error)}`);
        return { ok: false, reason: 'refused' };
      }
      announce();
      const auth = await access.auth();
      if (auth) {
        // Counted for the maker's page; the scene is already in the member's
        // looks whether or not this lands.
        await recordAdd(auth, ref.authorId, ref.packId);
      }
      return { ok: true, lookId: memberLookId(ref.authorId, ref.packId) };
    },
  );

  ipcMain.handle(
    'plus-gallery-report',
    async (
      _event,
      authorId: unknown,
      sceneId: unknown,
      reason: unknown,
    ): Promise<boolean> => {
      // Whoever can see a scene can say what is wrong with it.
      const ref = sceneRefOf(authorId, sceneId);
      if (!ref || !signedIn() || !isReportReason(reason)) {
        return false;
      }
      if (ref.authorId === FLUIDEQ_CREATOR_ID) {
        return false;
      }
      const auth = await access.auth();
      return auth ? reportScene(auth, ref.authorId, ref.packId, reason) : false;
    },
  );

  // A scene's earlier versions and their notes, for its page: what anyone
  // signed in may read about a scene they can see.
  ipcMain.handle(
    'plus-gallery-versions',
    async (
      _event,
      authorId: unknown,
      sceneId: unknown,
    ): Promise<TGalleryVersionsOutcome> => {
      const ref = sceneRefOf(authorId, sceneId);
      if (!ref || !signedIn()) {
        return { ok: false, reason: 'signed-out' };
      }
      const auth = await access.auth();
      return auth
        ? listVersions(auth, ref.authorId, ref.packId)
        : { ok: false, reason: 'signed-out' };
    },
  );

  // Losing Plus drops the scene files kept for Add; the pictures are what
  // anyone signed in may see, and stay.
  const unsubscribe = onEntitlementChange(() => {
    if (!access.entitled()) {
      previews.clear();
    }
  });

  return {
    refreshIfDue: createGalleryRefresh(access, syncInstalled, () =>
      store.list().map((scene) => scene.authorId),
    ),
    // Nothing added to the queue: settles after everything already in it.
    whenSynced: () => syncInstalled([]),
    dispose: () => {
      unsubscribe();
      forgetEverything();
      CHANNELS.forEach((channel) => ipcMain.removeHandler(channel));
    },
  };
};
