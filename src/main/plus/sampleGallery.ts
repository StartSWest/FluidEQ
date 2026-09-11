import { SAMPLE_PEOPLE } from './samplePeople';
import { memberLookId, parseMemberLookId } from '../../common/memberScenes';
import {
  GALLERY_PAGE_SIZE,
  PLUS_CATEGORIES,
  type IGalleryQuery,
  type IGalleryScene,
} from '../../common/plusGallery';
import type { IScenePack } from '../../common/scenePacks';
import type { ILikeStatus } from '../memberScenes/social';
import type { IScenePackSummary } from '../scenePackStore';

/**
 * A gallery with scenes in it, for development.
 *
 * The gallery's server half is deployed separately, and an empty grid shows
 * none of what the design is for — pictures side by side, a maker's page,
 * likes moving. So with the sample people switched on, the Plus looks this
 * account already has are laid into the gallery as if members of the sample
 * cast had published them, and each one's page plays the real scene.
 *
 * DEVELOPMENT ONLY, switched on with the sample people (see
 * `samplePeople.ts`) and never in a packaged build. Sample makers carry
 * ids from one reserved block no account is ever given, so nothing else can
 * mistake them for a person; their likes live in memory and are never sent;
 * they cannot be added to anyone's looks, because they were never signed.
 */

const SAMPLE_AUTHOR_PREFIX = '5a3b1e00-0000-4000-8000-';

const DAY_MS = 24 * 60 * 60 * 1000;

export const isSampleGalleryAuthor = (authorId: string) =>
  authorId.startsWith(SAMPLE_AUTHOR_PREFIX);

export interface ISampleGallery {
  /** The sample scenes a gallery query would return, in its order. */
  rows(query: IGalleryQuery): IGalleryScene[];
  /** The Plus look a sample scene stands for, to play on its page. */
  pack(sceneId: string): IScenePack | undefined;
  likeStatus(authorId: string, sceneId: string): ILikeStatus | undefined;
  like(authorId: string, sceneId: string, liked: boolean): void;
}

const sampleAuthorId = (index: number) =>
  `${SAMPLE_AUTHOR_PREFIX}${String(index + 1).padStart(12, '0')}`;

const folded = (text: string) => text.toLocaleLowerCase();

const ORDER: Record<
  IGalleryQuery['sort'],
  (a: IGalleryScene, b: IGalleryScene) => number
> = {
  liked: (a, b) => b.likes - a.likes,
  week: (a, b) => b.likesWeek - a.likesWeek,
  new: (a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt),
};

/** Orders any mix of real and sample rows the way the server orders its own. */
export const sortGalleryRows = (
  rows: IGalleryScene[],
  sort: IGalleryQuery['sort'],
) => [...rows].sort(ORDER[sort]);

export const createSampleGallery = ({
  packs,
  load,
  now = Date.now,
}: {
  /** The Plus looks this account has. */
  packs: () => readonly IScenePackSummary[];
  load: (id: string) => IScenePack | undefined;
  now?: () => number;
}): ISampleGallery => {
  const likes = new Map<string, boolean>();
  const likeKey = (authorId: string, sceneId: string) =>
    `${authorId}/${sceneId}`;

  // Numbers are fixed per position, so the orders by likes and by week
  // differ, and the page reads the same every time it is opened.
  const scenes = (): IGalleryScene[] =>
    packs()
      .filter((pack) =>
        parseMemberLookId(memberLookId(sampleAuthorId(0), pack.id)),
      )
      .map((pack, index) => {
        const personIndex = (index * 5) % SAMPLE_PEOPLE.length;
        const person = SAMPLE_PEOPLE[personIndex];
        const authorId = sampleAuthorId(personIndex);
        const liked = likes.get(likeKey(authorId, pack.id)) ?? false;
        return {
          lookId: memberLookId(authorId, pack.id),
          authorId,
          sceneId: pack.id,
          authorName: person.displayName,
          authorHandle: person.handle,
          version: pack.version,
          category: PLUS_CATEGORIES[(index * 4) % PLUS_CATEGORIES.length],
          names: pack.names,
          swatch: pack.swatch,
          hasPhoto: false,
          likes: ((index * 137 + 41) % 480) + (liked ? 1 : 0),
          likesWeek: (index * 29 + 7) % 60,
          adds: (index * 53 + 19) % 300,
          updatedAt: new Date(now() - (index * 3 + 1) * DAY_MS).toISOString(),
          liked,
          added: false,
        };
      });

  const find = (authorId: string, sceneId: string) =>
    scenes().find(
      (scene) => scene.authorId === authorId && scene.sceneId === sceneId,
    );

  return {
    rows: (query) => {
      const needle = query.query ? folded(query.query) : '';
      const offset = query.offset ?? 0;
      return sortGalleryRows(
        scenes().filter(
          (scene) =>
            (!query.category || scene.category === query.category) &&
            (!query.authorId || scene.authorId === query.authorId) &&
            (!needle ||
              [
                ...Object.values(scene.names),
                scene.authorName ?? '',
                scene.authorHandle ?? '',
              ].some((text) => folded(text).includes(needle))),
        ),
        query.sort,
      ).slice(offset, offset + GALLERY_PAGE_SIZE);
    },
    pack: (sceneId) => load(sceneId),
    likeStatus: (authorId, sceneId) => {
      const scene = find(authorId, sceneId);
      return scene ? { likes: scene.likes, liked: scene.liked } : undefined;
    },
    like: (authorId, sceneId, liked) => {
      likes.set(likeKey(authorId, sceneId), liked);
    },
  };
};
