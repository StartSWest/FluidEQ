import { useEffect, useSyncExternalStore } from 'react';
import type { IGalleryQuery, IGalleryScene } from 'common/plusGallery';
import type { TGalleryListOutcome } from 'main/ipc/plusGallery';

/**
 * The gallery's lists, as the renderer holds them: one per question asked —
 * a sort, a category, a maker, a search — each kept once loaded, so going
 * from a scene's page back to the gallery shows it exactly as it was left,
 * without asking the server again.
 *
 * Lists go stale after the member publishes or unpublishes, and when the
 * Plus tab is opened on a list older than a minute; a stale list is shown as
 * it is while its refresh loads.
 *
 * ONE QUESTION, ONE REQUEST. Every list asked of the server runs the gallery's
 * query for this member, and that query is the most expensive thing the app
 * asks the server for. Opening the tab used to ask twice — the list started
 * loading, the tab then marked everything stale, and the finished load kept
 * the mark and started again — and every visit to the tab asked again however
 * recently it had. With many members that is the load that made the gallery
 * time out for all of them. A list is now refreshed on showing only once it
 * is a minute old, and never while it is already on its way.
 */

export type TGalleryListFailure = Extract<
  TGalleryListOutcome,
  { ok: false }
>['reason'];

export type TListQuery = Omit<IGalleryQuery, 'offset'>;

export interface IGalleryList {
  scenes: IGalleryScene[];
  more: boolean;
  loading: boolean;
  /** Answered at least once, successfully or not. */
  loaded: boolean;
  /** The first page could not be had. */
  error?: TGalleryListFailure;
  /**
   * A later page could not be had. Kept apart from `error`: the pages already
   * on screen are still right, and a notice over them said the gallery could
   * not be loaded while it was sitting there loaded.
   */
  moreError?: TGalleryListFailure;
}

const EMPTY_LIST: IGalleryList = {
  scenes: [],
  more: false,
  loading: false,
  loaded: false,
};

interface IListEntry {
  list: IGalleryList;
  stale: boolean;
  /** Bumped by every fresh load, so a late page of an older one is dropped. */
  generation: number;
  /** When its first page last arrived, for `refreshGalleryOnShow`. */
  fetchedAt?: number;
}

/**
 * How old a list has to be before opening the tab asks for it again. Likes
 * and new scenes are worth seeing within a minute; a member going back and
 * forth between tabs is not a reason to run the gallery query each time.
 */
export const GALLERY_REFRESH_AFTER_MS = 60_000;

const lists = new Map<string, IListEntry>();
const listeners = new Set<() => void>();

const bridge = () => window.electron?.ipcRenderer;

export const galleryListKey = (query: TListQuery) =>
  JSON.stringify([
    query.sort,
    query.category ?? '',
    query.authorId ?? '',
    query.query ?? '',
  ]);

const notify = () => listeners.forEach((listener) => listener());

const put = (key: string, entry: IListEntry) => {
  lists.set(key, entry);
  notify();
};

const request = async (query: IGalleryQuery): Promise<TGalleryListOutcome> => {
  try {
    return (
      (await bridge()?.listGallery?.(query)) ?? { ok: false, reason: 'offline' }
    );
  } catch {
    // The call itself failed — the main process went away mid-call. Without
    // an answer the list stayed "loading" for good, with no Retry to press.
    return { ok: false, reason: 'offline' };
  }
};

const load = async (query: TListQuery, offset: number) => {
  const key = galleryListKey(query);
  const current = lists.get(key);
  const generation =
    offset === 0 ? (current?.generation ?? 0) + 1 : (current?.generation ?? 0);
  put(key, {
    list: { ...(current?.list ?? EMPTY_LIST), loading: true },
    stale: false,
    generation,
    // A later page leaves the list as old as its first page is.
    ...(current?.fetchedAt !== undefined
      ? { fetchedAt: current.fetchedAt }
      : {}),
  });
  const outcome = await request({ ...query, offset });
  const latest = lists.get(key);
  if (!latest || latest.generation !== generation) {
    return;
  }
  if (!outcome.ok) {
    put(key, {
      ...latest,
      list: {
        ...latest.list,
        loading: false,
        loaded: true,
        ...(offset === 0
          ? { error: outcome.reason }
          : { moreError: outcome.reason }),
      },
    });
    return;
  }
  const kept = offset === 0 ? [] : latest.list.scenes;
  // A scene can move between pages while they are fetched; it is shown once.
  const seen = new Set(kept.map((scene) => scene.lookId));
  put(key, {
    ...latest,
    ...(offset === 0 ? { fetchedAt: Date.now() } : {}),
    list: {
      scenes: [
        ...kept,
        ...outcome.scenes.filter((scene) => !seen.has(scene.lookId)),
      ],
      more: outcome.more,
      loading: false,
      loaded: true,
    },
  });
};

const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};

/**
 * One list of the gallery, loaded when first asked for and refreshed when
 * stale. `loadMore` asks for the next page.
 */
export const useGalleryList = (query: TListQuery) => {
  const key = galleryListKey(query);
  const list = useSyncExternalStore(
    subscribe,
    () => lists.get(key)?.list ?? EMPTY_LIST,
    () => EMPTY_LIST,
  );
  const entry = lists.get(key);
  const needsLoad = !entry || (entry.stale && !entry.list.loading);

  useEffect(() => {
    if (needsLoad) {
      load(query, 0).catch(() => undefined);
    }
    // The key is the query written out: it changes exactly when the query
    // does, which the object itself — new on every render — cannot say.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, needsLoad]);

  return {
    list,
    loadMore: () => {
      if (!list.loading && list.more) {
        load(query, list.scenes.length).catch(() => undefined);
      }
    },
    reload: () => {
      load(query, 0).catch(() => undefined);
    },
  };
};

/**
 * Every list is asked again the next time it is shown: the member published,
 * unpublished or moderated, and the lists no longer say what the server does.
 */
export const markGalleryStale = () => {
  lists.forEach((entry, key) => lists.set(key, { ...entry, stale: true }));
  notify();
};

/**
 * The Plus tab was opened: lists older than `GALLERY_REFRESH_AFTER_MS` are
 * asked again as they are shown. A list on its way, or one that arrived a
 * moment ago, is left as it is — which is also what stops the tab's own first
 * list from being asked twice.
 */
export const refreshGalleryOnShow = (now = Date.now()) => {
  let changed = false;
  lists.forEach((entry, key) => {
    if (
      entry.stale ||
      entry.list.loading ||
      (entry.fetchedAt !== undefined &&
        now - entry.fetchedAt < GALLERY_REFRESH_AFTER_MS)
    ) {
      return;
    }
    changed = true;
    lists.set(key, { ...entry, stale: true });
  });
  if (changed) {
    notify();
  }
};

/** A like or an add, reflected in every list that holds the scene. */
export const patchGalleryScene = (
  lookId: string,
  patch: Partial<Pick<IGalleryScene, 'likes' | 'liked' | 'added' | 'adds'>>,
) => {
  let changed = false;
  lists.forEach((entry, key) => {
    if (!entry.list.scenes.some((scene) => scene.lookId === lookId)) {
      return;
    }
    changed = true;
    lists.set(key, {
      ...entry,
      list: {
        ...entry.list,
        scenes: entry.list.scenes.map((scene) =>
          scene.lookId === lookId ? { ...scene, ...patch } : scene,
        ),
      },
    });
  });
  if (changed) {
    notify();
  }
};

/** The freshest copy of a scene any list holds, for a page opened on an older one. */
export const findGalleryScene = (lookId: string): IGalleryScene | undefined =>
  Array.from(lists.values())
    .flatMap((entry) => entry.list.scenes)
    .find((scene) => scene.lookId === lookId);

export const useGalleryScene = (scene: IGalleryScene): IGalleryScene =>
  useSyncExternalStore(
    subscribe,
    () => findGalleryScene(scene.lookId) ?? scene,
    () => scene,
  );

/** For tests: a clean module between runs. */
export const resetGalleryStore = () => {
  lists.clear();
  listeners.clear();
};
