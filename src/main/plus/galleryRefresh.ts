import type { IGalleryScene } from '../../common/plusGallery';
import type { IGalleryAccess } from './galleryAccess';
import { listGallery } from './galleryApi';

/** App focus/resume/account checks refresh installed scenes; no polling timer. */
export const createGalleryRefresh = (
  access: IGalleryAccess,
  sync: (scenes: readonly IGalleryScene[]) => Promise<void>,
) => {
  let lastAccount: string | undefined;
  let lastAt = 0;
  let inFlight: Promise<void> | undefined;
  const run = async (force: boolean) => {
    const me = access.accountId();
    if (!me || !access.entitled()) {
      return;
    }
    if (
      !force &&
      lastAccount === me &&
      Date.now() - lastAt < 4 * 60 * 60 * 1000
    ) {
      return;
    }
    const auth = await access.auth();
    if (!auth || me !== access.accountId()) {
      return;
    }
    let offset = 0;
    let more = true;
    while (more && offset <= 6000) {
      const result = await listGallery(auth, { sort: 'new', offset });
      if (!result.ok || me !== access.accountId() || !access.entitled()) {
        return;
      }
      await sync(result.scenes);
      more = result.more && result.scenes.length > 0;
      offset += result.scenes.length;
    }
    lastAccount = me;
    lastAt = Date.now();
  };
  return (force = false) => {
    if (force && inFlight) {
      return inFlight.then(() => run(true));
    }
    if (!inFlight) {
      inFlight = run(force).finally(() => {
        inFlight = undefined;
      });
    }
    return inFlight;
  };
};
