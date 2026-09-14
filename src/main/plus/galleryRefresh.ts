import type { IGalleryScene } from '../../common/plusGallery';
import { FLUIDEQ_CREATOR_ID } from '../../common/plusGallery';
import type { IGalleryAccess } from './galleryAccess';
import { listGallery } from './galleryApi';

/**
 * Brings the scenes added from the gallery up to date, at events — the window
 * coming back, the looks being opened, the account changing — with no timer.
 *
 * It used to walk the whole gallery, every page of it, and so was rationed to
 * once every four hours: a scene its maker republished reached the people who
 * had it hours later, or at the next launch. Only the makers of installed
 * scenes are asked now, one page of their own scenes each, which is small
 * enough to ask every time. The sync downloads a scene only when its
 * publication is one it has not taken this session (`syncGalleryScenes.ts`).
 *
 * FluidEQ's own scenes are not asked here: the pack listing asks for exactly
 * their versions (`ipc/scenePacks.ts`).
 */
export const createGalleryRefresh = (
  access: IGalleryAccess,
  sync: (scenes: readonly IGalleryScene[]) => Promise<void>,
  /** The makers of the scenes installed from the gallery, repeats allowed. */
  installedAuthors: () => readonly string[],
) => {
  let inFlight: Promise<void> | undefined;
  const run = async () => {
    const me = access.accountId();
    if (!me || !access.entitled()) {
      return;
    }
    const authors = [...new Set(installedAuthors())].filter(
      (author) => author !== FLUIDEQ_CREATOR_ID,
    );
    if (authors.length === 0) {
      return;
    }
    const auth = await access.auth();
    if (!auth || me !== access.accountId()) {
      return;
    }
    // One maker at a time: each page is synced before the next is asked, so
    // memory stays bounded however many large scenes one maker has.
    await authors.reduce(async (previous, authorId) => {
      await previous;
      let offset = 0;
      let more = true;
      while (more) {
        const result = await listGallery(auth, {
          sort: 'new',
          authorId,
          offset,
        });
        if (!result.ok || me !== access.accountId() || !access.entitled()) {
          return;
        }
        await sync(result.scenes);
        more = result.more && result.scenes.length > 0;
        offset += result.scenes.length;
      }
    }, Promise.resolve());
  };
  /**
   * `force`: something changed while a check may already be under way — a
   * publication, a takedown — so it runs once more after that one.
   */
  return (force = false) => {
    if (force && inFlight) {
      return inFlight.then(() => run());
    }
    if (!inFlight) {
      inFlight = run().finally(() => {
        inFlight = undefined;
      });
    }
    return inFlight;
  };
};
