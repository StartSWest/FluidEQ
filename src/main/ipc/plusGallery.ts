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
  recordAdd,
  reportScene,
  type TGalleryFailure,
} from '../plus/galleryApi';
import { sceneRefOf, type IGalleryAccess } from '../plus/galleryAccess';
import { createPictureCache } from '../plus/pictureCache';
import { fetchOfficialScene } from '../plus/officialGallery';
import type { IScenePackStore } from '../scenePackStore';

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
}

export interface IPlusGalleryRegistration {
  dispose(): void;
}

const CHANNELS = [
  'plus-gallery-list',
  'plus-gallery-picture',
  'plus-gallery-preview',
  'plus-gallery-add',
  'plus-gallery-report',
] as const;

/**
 * Pictures kept in memory, by the bytes they take. A picture is 1280 by 720
 * and usually 100-400KB, so this holds a gallery page or two of cards.
 */
const PICTURE_CACHE_BYTES = 48 * 1024 * 1024;

/**
 * Scene files kept from the scene's page for its Add button, so pressing it
 * does not download the same file twice. Only the last few pages opened.
 */
const PREVIEW_CACHE_SCENES = 4;

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
}: IPlusGalleryIpcDeps): IPlusGalleryRegistration => {
  const pictures = createPictureCache(PICTURE_CACHE_BYTES);
  const picturesInFlight = new Map<string, Promise<string | undefined>>();
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
    const auth = await access.auth();
    const bytes = auth
      ? await fetchPicture(auth, authorId, sceneId)
      : undefined;
    if (!bytes) {
      // A failure is not remembered: the next time the card is on screen is
      // the next chance.
      return undefined;
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

  ipcMain.handle(
    'plus-gallery-list',
    async (_event, rawQuery: unknown): Promise<TGalleryListOutcome> => {
      if (!signedIn()) {
        return { ok: false, reason: 'signed-out' };
      }
      const query = readQuery(rawQuery);
      const auth = await access.auth();
      const listed = auth
        ? await listGallery(auth, query)
        : ({ ok: false, reason: 'signed-out' } as const);
      if (!listed.ok) {
        return listed;
      }
      // The server leaves blocked scenes out already; the list this computer
      // holds is asked as well, so the two can never disagree on screen.
      return {
        ok: true,
        scenes: listed.scenes.filter(
          (scene) => !store.isBlocked(scene.authorId, scene.sceneId),
        ),
        more: listed.more,
      };
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
        ref.authorId === FLUIDEQ_CREATOR_ID ||
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
      // Anyone signed in may watch a scene on its page: with Plus for as
      // long as they like, without it for the taste the page gives. What
      // stays Plus is keeping it — Add, below.
      const ref = sceneRefOf(authorId, sceneId);
      if (!ref || !signedIn()) {
        return { ok: false, reason: 'not-entitled' };
      }
      if (ref.authorId === FLUIDEQ_CREATOR_ID) {
        const me = access.accountId();
        const auth = await access.auth();
        const fetched = auth
          ? await fetchOfficialScene(auth, ref.packId)
          : undefined;
        const pack = fetched?.pack;
        return pack && me === access.accountId()
          ? { ok: true, pack, own: false }
          : { ok: false, reason: 'unavailable' };
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
        if (!fetched || !officialStore) {
          return { ok: false, reason: 'unavailable' };
        }
        try {
          officialStore.adopt([
            {
              id: fetched.pack.id,
              version: fetched.pack.version,
              envelope: fetched.envelope,
            },
          ]);
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
      );
      if (typeof fetched === 'string') {
        return { ok: false, reason: fetched };
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

  // Losing Plus drops the scene files kept for Add; the pictures are what
  // anyone signed in may see, and stay.
  const unsubscribe = onEntitlementChange(() => {
    if (!access.entitled()) {
      previews.clear();
    }
  });

  return {
    dispose: () => {
      unsubscribe();
      forgetEverything();
      CHANNELS.forEach((channel) => ipcMain.removeHandler(channel));
    },
  };
};
