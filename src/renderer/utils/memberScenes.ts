import { useSyncExternalStore } from 'react';
import { parseMemberLookId } from 'common/memberScenes';
import { lockedLookId, type IScenePack } from 'common/scenePacks';
import type { ISceneWave } from 'common/sceneWave';
import type { IMemberScenesListing } from 'main/ipc/memberScenes';
import type { ILikeStatus } from 'main/memberScenes/social';
import type { IMemberSceneSummary } from 'main/memberScenes/store';
import { isSceneRenderingAvailable } from '../graph/sceneHealth';

/**
 * The scenes this member made, as the renderer sees them.
 *
 * The same shape as the Plus looks' store beside it, and for the same reasons:
 * summaries only until a scene is about to draw, and "usable" decided here,
 * once — the account has Plus, this renderer has not blocked it, and this
 * machine can run a scene at all — so a scene that cannot draw is never
 * offered anywhere a look is offered.
 */

export interface IUsableMemberScene {
  kind: 'member';
  lookId: string;
  authorId: string;
  packId: string;
  version: number;
  revision?: string;
  names: IMemberSceneSummary['names'];
  swatch: string[];
  spectrumRange?: IScenePack['spectrumRange'];
  /**
   * The wave its author built it around, when the pack names one: the
   * listener opens on it, and may set their own over it per scene
   * (`sceneWaveStore.ts`). Carried on the summary beside the spectrum
   * range because the graph decides both before the scene has loaded.
   */
  wave?: ISceneWave;
  /** The colours it lends the window, when its pack names them. */
  windowColours?: IScenePack['windowColours'];
  /** And at the five hours of its day, when its pack names them. */
  windowColourStops?: IScenePack['windowColourStops'];
  own: boolean;
  /** Kept from the maker's Studio project as it stood (`IMemberSceneSummary`). */
  fromBench?: true;
  /** Who sent it, for a scene another member made. */
  authorName?: string | null;
}

/**
 * A member scene on this computer while the membership is off: one the member
 * made, or one another member sent them. Never a selection.
 */
export interface ILockedMemberScene {
  lookId: string;
  names: IMemberSceneSummary['names'];
  swatch: string[];
  own: boolean;
  /** Who sent it, for a scene another member made. */
  authorName?: string | null;
}

/** What the lists read of a member scene to know whether it is a copy. */
interface ICopyFacts {
  own: boolean;
  lookId: string;
  version?: number;
  fromBench?: true;
}

/** What the lists read of one of FluidEQ's scenes held here. */
interface IOfficialFacts {
  id: string;
  lookId: string;
  /** None for a locked one, whose catalogue entry carries no version. */
  version?: number;
  /** Not on this computer, though the account may play it (`IAwayScene`). */
  away?: true;
}

/** The member's own copy of this one of FluidEQ's scenes, by its pack id. */
const isCopyOf = (scene: ICopyFacts, official: IOfficialFacts) =>
  scene.own && parseMemberLookId(scene.lookId)?.packId === official.id;

/**
 * Whether a member's own copy of one of FluidEQ's scenes is listed in
 * FluidEQ's row's place: kept from the Studio's bench, and no older than
 * FluidEQ's version held, which a copy kept before a later publication on
 * another computer is. Or whatever the copy, when FluidEQ's scene is not on
 * this computer at all: the copy is then the only one there is to play.
 */
const standsInFor = (scene: ICopyFacts, official: IOfficialFacts) =>
  isCopyOf(scene, official) &&
  (official.away === true ||
    (scene.fromBench === true &&
      (official.version === undefined ||
        (scene.version !== undefined && scene.version >= official.version))));

/**
 * THE COPY KEPT BY WHOEVER PUBLISHES FLUIDEQ'S OWN SCENES IS NOT A SECOND
 * SCENE (Ivan, 2026-11-23: "why they show duplicated???"). Publishing keeps
 * the scene as the publisher's own look as well (`keepPublished`), so the
 * account that publishes FluidEQ's scenes saw each one twice in every list:
 * FluidEQ's row with its maker's note, and its own copy under the same name.
 * A member's own copy of a scene FluidEQ ships is left out of the lists, and
 * FluidEQ's own stands for it. Nobody else can hold one: the server refuses
 * to publish a copy of FluidEQ's own.
 *
 * Except a copy kept from the Studio's bench, which stands for FluidEQ's
 * row instead (`withoutStoodInFor`): the scene is still listed once, and it
 * plays what the publisher put in their looks. Every copy used to be left
 * out, so "Add to my looks" of changes not yet published kept a copy no list
 * offered, and FluidEQ's row went on playing the published version (Ivan,
 * 2026-11-28: "add to my looks of non published scene is not working").
 */
export const withoutOfficialCopies = <T extends ICopyFacts>(
  scenes: readonly T[],
  officials: readonly IOfficialFacts[],
): T[] =>
  scenes.filter((scene) => {
    const official = officials.find((entry) => isCopyOf(scene, entry));
    return official === undefined || standsInFor(scene, official);
  });

/** The one of FluidEQ's scenes this copy is listed in place of, if any. */
export const officialStoodInFor = <T extends IOfficialFacts>(
  scene: ICopyFacts,
  officials: readonly T[],
): T | undefined => officials.find((official) => standsInFor(scene, official));

/** FluidEQ's own scenes, less each one a member's own copy is listed for. */
export const withoutStoodInFor = <T extends IOfficialFacts>(
  officials: readonly T[],
  members: readonly ICopyFacts[],
): T[] =>
  officials.filter(
    (official) => !members.some((scene) => standsInFor(scene, official)),
  );

/**
 * The look a selection stands for in the lists: FluidEQ's own scene when the
 * selection is its publisher's own copy, which the lists leave out
 * (`withoutOfficialCopies`), the copy when the selection is FluidEQ's scene
 * and the copy is listed in its place, the selection itself otherwise.
 * Without it a graph playing the one not listed was in no list: the picker
 * marked nothing as playing and named nothing on its pill, and the cycle,
 * finding the selection nowhere, started again from the first look (Ivan,
 * 2026-11-24: "it's starting from the beginning ... sometimes it doesn't").
 */
export const listedLookOf = (
  lookId: string,
  members: readonly ICopyFacts[],
  officials: readonly IOfficialFacts[],
): string => {
  const chosen = members.find((scene) => scene.lookId === lookId);
  const copied =
    chosen && officials.find((official) => isCopyOf(chosen, official));
  if (chosen && copied) {
    return standsInFor(chosen, copied) ? lookId : copied.lookId;
  }
  const official = officials.find((entry) => entry.lookId === lookId);
  const standIn =
    official && members.find((scene) => standsInFor(scene, official));
  return standIn ? standIn.lookId : lookId;
};

const EMPTY: IMemberScenesListing = { scenes: [], locked: [] };

let listing: IMemberScenesListing = EMPTY;
let loaded = false;
const blocked = new Set<string>();
let subscribed = false;
const listeners = new Set<() => void>();
let usable: IUsableMemberScene[] = [];
let locked: ILockedMemberScene[] = [];

const bridge = () => window.electron?.ipcRenderer;

const recompute = () => {
  const canDraw = isSceneRenderingAvailable();
  usable = canDraw
    ? listing.scenes
        .filter((scene) => !blocked.has(scene.lookId))
        .map((scene) => ({
          kind: 'member' as const,
          lookId: scene.lookId,
          authorId: scene.authorId,
          packId: scene.packId,
          version: scene.version,
          revision: scene.revision,
          names: scene.names,
          swatch: scene.swatch,
          own: scene.own,
          ...(scene.own ? {} : { authorName: scene.authorName ?? null }),
          ...(scene.own && scene.fromBench ? { fromBench: true as const } : {}),
          ...(scene.spectrumRange
            ? { spectrumRange: scene.spectrumRange }
            : {}),
          ...(scene.wave ? { wave: scene.wave } : {}),
          ...(scene.windowColours
            ? { windowColours: scene.windowColours }
            : {}),
          ...(scene.windowColourStops
            ? { windowColourStops: scene.windowColourStops }
            : {}),
        }))
    : [];
  locked = canDraw
    ? listing.locked.map((scene) => ({
        // The Plus looks' locked prefix, so the picker treats both the same:
        // choosing one opens the Plus card and no selection lands on it.
        lookId: lockedLookId(scene.lookId),
        names: scene.names,
        swatch: scene.swatch,
        own: scene.own,
        ...(scene.own ? {} : { authorName: scene.authorName ?? null }),
      }))
    : [];
};

const publish = () => {
  recompute();
  listeners.forEach((listener) => listener());
};

const adopt = (next: IMemberScenesListing) => {
  listing = next;
  loaded = true;
  // Nothing on disk remembers a failure any more, so a fresh listing is a
  // clean slate: every scene this session had blocked gets another try.
  blocked.clear();
  publish();
};

const start = () => {
  if (subscribed) {
    return () => {};
  }
  subscribed = true;
  const api = bridge();
  api
    ?.listMemberScenes?.()
    .then(adopt)
    .catch(() => {
      // No backend, or no handler: no member scenes is already the state.
    });
  return api?.onMemberScenesChanged?.(adopt) ?? (() => {});
};

let stop: () => void = () => {};

export const subscribeMemberScenes = (listener: () => void) => {
  if (listeners.size === 0) {
    stop = start();
  }
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};

export const isMemberSceneListingLoaded = (): boolean => loaded;
export const getUsableMemberScenes = (): readonly IUsableMemberScene[] =>
  usable;
export const getUsableMemberScene = (
  lookId: string,
): IUsableMemberScene | undefined =>
  usable.find((scene) => scene.lookId === lookId);
/** Set aside by this session rather than gone: as `isSceneBlocked`. */
export const isMemberSceneBlocked = (lookId: string): boolean =>
  blocked.has(lookId);
export const getMemberSceneSummary = (
  lookId: string,
): IMemberSceneSummary | undefined =>
  [...listing.scenes, ...listing.locked].find(
    (scene) => scene.lookId === lookId,
  );
export const getLockedMemberScenes = (): readonly ILockedMemberScene[] =>
  locked;

/**
 * A member scene this account may play, whether or not the graph can draw it
 * right now: the desk lights' question, as `getEntitledScene` is for packs.
 */
export const getEntitledMemberScene = (
  lookId: string,
): IMemberSceneSummary | undefined =>
  listing.scenes.find((scene) => scene.lookId === lookId);

export const useUsableMemberScenes = (): readonly IUsableMemberScene[] =>
  useSyncExternalStore(
    subscribeMemberScenes,
    getUsableMemberScenes,
    getUsableMemberScenes,
  );

export const useLockedMemberScenes = (): readonly ILockedMemberScene[] =>
  useSyncExternalStore(
    subscribeMemberScenes,
    getLockedMemberScenes,
    getLockedMemberScenes,
  );

export const loadMemberScene = async (
  lookId: string,
): Promise<IScenePack | undefined> => bridge()?.loadMemberScene?.(lookId);

export const refreshMemberScenes = async () => {
  const next = await bridge()?.listMemberScenes?.();
  if (next) {
    adopt(next);
  }
};

export const getMemberSceneListing = () => listing;

/** This machine cannot run it right now. This session only. */
export const blockMemberScene = (lookId: string) => {
  if (!blocked.has(lookId)) {
    blocked.add(lookId);
    publish();
  }
};

/** Tried again by the member: offered once more, as `unblockScene`. */
export const unblockMemberScene = (lookId: string) => {
  if (blocked.delete(lookId)) {
    publish();
  }
};

/** How many members like a scene, and whether this one does. */
export const fetchMemberSceneLikes = async (
  lookId: string,
): Promise<ILikeStatus | undefined> =>
  bridge()?.memberSceneLikeStatus?.(lookId);

/** Likes or takes a like back; answers the new count, or undefined offline. */
export const likeMemberSceneLook = async (
  lookId: string,
  liked: boolean,
): Promise<ILikeStatus | undefined> =>
  bridge()?.likeMemberScene?.(lookId, liked);

/** For tests: a clean module between runs. */
export const resetMemberSceneStore = () => {
  stop();
  stop = () => {};
  subscribed = false;
  listeners.clear();
  blocked.clear();
  listing = EMPTY;
  loaded = false;
  recompute();
};

/** For tests: hand the store a listing without an IPC bridge. */
export const adoptMemberSceneListingForTesting = (next: IMemberScenesListing) =>
  adopt(next);
