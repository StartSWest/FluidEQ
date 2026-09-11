import { useCallback, useLayoutEffect, useRef, useState } from 'react';
import type { TranslationKey } from 'common/i18n';
import type { IPublishedScene, TPlusCategory } from 'common/plusGallery';
import { PLUS_TERMS_VERSION } from 'common/plusTerms';
import { requestAccountPanel } from '../account/accountPanel';
import { getAccountSnapshot, useAccount } from '../account/accountStore';
import type { ISceneFrame } from '../graph/sceneGl';
import {
  blobAsDataUrl,
  renderCapturedStill,
  renderSceneStill,
} from '../graph/sceneStill';
import { markGalleryStale } from '../plus/galleryStore';
import {
  publishStudioScene,
  studioTermsAgreed,
  type IStudioView,
} from './studioStore';
import type { ISharingNotice } from './useStudioSharing';

const PUBLISH_FAILURES: Record<string, TranslationKey> = {
  terms: 'studio.publish.outdated',
  offline: 'studio.publish.offline',
  banned: 'studio.export.banned',
  'rate-limited': 'studio.publish.rateLimited',
  refused: 'studio.export.refused',
  'signed-out': 'studio.publish.signedOut',
  'no-build': 'studio.export.refused',
  'no-picture': 'studio.publish.noPicture',
  server: 'studio.publish.failed',
};

/**
 * How many covers the dialog keeps to choose between: the one it opened with
 * and the latest captures, one row of them at every width the dialog has.
 */
export const MAX_SHOTS = 4;

export interface IPublishPicture {
  /** The WebP bytes sent with the scene. */
  bytes: Uint8Array;
  /** The same picture, for the dialog to show. */
  url: string;
}

export interface IPublishShot {
  id: number;
  /** Drawn from the showcase when the dialog opened, or caught by the member. */
  kind: 'auto' | 'captured';
  /** Absent while it is still being drawn. */
  picture?: IPublishPicture;
}

export interface IPublishDraft {
  shots: readonly IPublishShot[];
  /** The shot the gallery gets. Always one with a picture. */
  chosen: number;
  /** This scene as it is already published, when it is. */
  published?: IPublishedScene;
  /** Whether the Plus terms this app carries were agreed on this computer. */
  agreed: boolean;
  /** The last capture could not be drawn. */
  missed: boolean;
}

/** The picture, as the bytes sent and the image the dialog shows. */
const readStill = async (blob: Blob): Promise<IPublishPicture> => ({
  bytes: new Uint8Array(await blob.arrayBuffer()),
  url: await blobAsDataUrl(blob),
});

/**
 * The oldest covers are let go past
 * `MAX_SHOTS` — never the chosen one, and never one still being drawn.
 */
const trimShots = (draft: IPublishDraft): IPublishDraft => {
  let { shots } = draft;
  while (shots.length > MAX_SHOTS) {
    const oldest = shots.findIndex(
      (entry) => entry.id !== draft.chosen && entry.picture !== undefined,
    );
    if (oldest < 0) {
      break;
    }
    shots = shots.filter((_, index) => index !== oldest);
  }
  return { ...draft, shots };
};

/**
 * Publish, from the Studio: a cover for the scene, the dialog, and everything
 * the server can say back.
 *
 * Every cover is the real scene — this version of the project's own pack —
 * drawn off the stage at the gallery's full quality (see `sceneStill.ts`).
 * The dialog opens on one drawn from the showcase signal, a busy chorus over
 * moving noise, so there is a good cover before the member does anything.
 * Then the scene plays in the dialog and every capture is the moment on
 * screen, drawn again at full size from what the scene heard; the newest
 * capture becomes the cover, and the others stay beside it to go back to.
 */
export default function useStudioPublish(
  view: IStudioView,
  playing: boolean,
  name: string,
) {
  const [preparing, setPreparing] = useState(false);
  const [draft, showDraft] = useState<IPublishDraft>();
  const [publishing, setPublishing] = useState(false);
  const [notice, setNotice] = useState<ISharingNotice>();
  const nextShot = useRef(0);
  const currentDraft = useRef<IPublishDraft | undefined>(undefined);
  const retryDraft = useRef<IPublishDraft | undefined>(undefined);
  const preparingRef = useRef(false);
  const publishingRef = useRef(false);
  const generation = useRef(0);
  const lastChoice = useRef(0);
  const accountId = useAccount().identity?.id;
  const { pack } = view;
  const packId = pack?.id;

  // Event handlers can run twice before React commits; refs also keep pending
  // captures and the bytes being published in the same synchronous draft.
  const setDraft = useCallback((next: IPublishDraft | undefined) => {
    currentDraft.current = next;
    showDraft(next);
  }, []);

  const cancel = useCallback(() => {
    generation.current += 1;
    preparingRef.current = false;
    publishingRef.current = false;
    retryDraft.current = undefined;
    setPreparing(false);
    setPublishing(false);
    setDraft(undefined);
  }, [setDraft]);

  // A cover belongs to one account and one build. An old promise must never
  // reopen its dialog or clear a replacement project's work.
  useLayoutEffect(() => {
    cancel();
    setNotice(undefined);
    return () => {
      generation.current += 1;
    };
  }, [
    cancel,
    pack,
    view.serial,
    view.state.activeId,
    view.state.entitled,
    view.problems,
    accountId,
  ]);

  const isCurrent = useCallback(
    (started: number) =>
      generation.current === started &&
      getAccountSnapshot().identity?.id === accountId,
    [accountId],
  );

  const begin = useCallback(() => {
    if (
      preparingRef.current ||
      publishingRef.current ||
      currentDraft.current ||
      !playing ||
      !pack ||
      !view.state.entitled ||
      view.problems
    ) {
      return;
    }
    setNotice(undefined);
    if (retryDraft.current) {
      setDraft(retryDraft.current);
      retryDraft.current = undefined;
      return;
    }
    const started = generation.current;
    preparingRef.current = true;
    setPreparing(true);
    const published = window.electron?.ipcRenderer
      ?.myPublishedScenes?.()
      .then((outcome) =>
        outcome.ok
          ? outcome.scenes.find((scene) => scene.sceneId === packId)
          : undefined,
      )
      .catch(() => undefined);
    const still = renderSceneStill(pack).then((blob) =>
      blob ? readStill(blob) : undefined,
    );
    Promise.all([still, published, studioTermsAgreed()])
      .then(([picture, alreadyPublished, agreed]) => {
        if (!isCurrent(started)) {
          return undefined;
        }
        preparingRef.current = false;
        setPreparing(false);
        if (!picture) {
          setNotice({ ok: false, key: 'studio.publish.noPicture' });
          return undefined;
        }
        nextShot.current += 1;
        const id = nextShot.current;
        setDraft({
          shots: [{ id, kind: 'auto', picture }],
          chosen: id,
          agreed: agreed >= PLUS_TERMS_VERSION,
          missed: false,
          ...(alreadyPublished ? { published: alreadyPublished } : {}),
        });
        return undefined;
      })
      .catch(() => {
        if (!isCurrent(started)) {
          return;
        }
        preparingRef.current = false;
        setPreparing(false);
        setNotice({ ok: false, key: 'studio.publish.noPicture' });
      });
  }, [
    playing,
    pack,
    packId,
    view.state.entitled,
    view.problems,
    isCurrent,
    setDraft,
  ]);

  /**
   * A cover from the moment on the dialog's stage: `frames` are what the
   * scene heard up to it (see `momentRecorder.ts`). It shows at once as a
   * cover being drawn, and becomes the chosen one when it is ready.
   */
  const capture = useCallback(
    (frames: readonly ISceneFrame[]) => {
      const { current } = currentDraft;
      if (
        !pack ||
        !current ||
        publishingRef.current ||
        frames.length === 0 ||
        current.shots.filter((shot) => !shot.picture).length >= MAX_SHOTS - 1
      ) {
        return;
      }
      nextShot.current += 1;
      const id = nextShot.current;
      lastChoice.current = id;
      setDraft(
        trimShots({
          ...current,
          shots: [...current.shots, { id, kind: 'captured' }],
          missed: false,
        }),
      );
      const started = generation.current;
      // Only into the dialog it was captured in: one closed and opened again
      // while this was drawing is a different draft.
      const holds = () =>
        isCurrent(started) &&
        currentDraft.current?.shots.some((shot) => shot.id === id)
          ? currentDraft.current
          : undefined;
      const drop = () => {
        const mine = holds();
        if (mine) {
          setDraft({
            ...mine,
            shots: mine.shots.filter((shot) => shot.id !== id),
            missed: true,
          });
        }
      };
      renderCapturedStill(pack, frames)
        .then((blob) => (blob ? readStill(blob) : undefined))
        .then((picture) => {
          if (!picture) {
            drop();
            return undefined;
          }
          const mine = holds();
          if (mine) {
            setDraft(
              trimShots({
                ...mine,
                // Completion order is not capture order, and neither may
                // replace a manual choice or the cover already being sent.
                chosen:
                  lastChoice.current === id && !publishingRef.current
                    ? id
                    : mine.chosen,
                shots: mine.shots.map((shot) =>
                  shot.id === id ? { ...shot, picture } : shot,
                ),
              }),
            );
          }
          return undefined;
        })
        .catch(drop);
    },
    [pack, isCurrent, setDraft],
  );

  const choose = useCallback(
    (id: number) => {
      const { current } = currentDraft;
      if (
        !publishingRef.current &&
        current?.shots.some((shot) => shot.id === id && shot.picture)
      ) {
        lastChoice.current = id;
        setDraft({ ...current, chosen: id });
      }
    },
    [setDraft],
  );

  const publish = useCallback(
    (category: TPlusCategory) => {
      const mine = currentDraft.current;
      const cover = mine?.shots.find((shot) => shot.id === mine.chosen);
      if (
        !mine ||
        !cover?.picture ||
        publishingRef.current ||
        !view.state.entitled ||
        view.problems
      ) {
        return;
      }
      const started = generation.current;
      publishingRef.current = true;
      setNotice(undefined);
      setPublishing(true);
      const failed = (key: TranslationKey) => {
        // Show the error on the bench, keeping completed covers for the next
        // Publish click. Pending captures cannot be resumed once closed.
        retryDraft.current = {
          ...mine,
          shots: (currentDraft.current ?? mine).shots.filter(
            (shot) => shot.picture,
          ),
        };
        setDraft(undefined);
        publishingRef.current = false;
        setPublishing(false);
        setNotice({ ok: false, key });
      };
      publishStudioScene(PLUS_TERMS_VERSION, category, cover.picture.bytes)
        .then((outcome) => {
          // Even a publication whose dialog has gone away changed the gallery.
          if (outcome.ok) {
            markGalleryStale();
          }
          if (!isCurrent(started)) {
            return undefined;
          }
          publishingRef.current = false;
          setPublishing(false);
          if (outcome.ok) {
            setDraft(undefined);
            setNotice({
              ok: true,
              key: mine.published
                ? 'studio.publish.updated'
                : 'studio.publish.done',
              vars: { name },
            });
            return undefined;
          }
          if (outcome.reason === 'not-entitled') {
            setDraft(undefined);
            requestAccountPanel('subscribe');
            return undefined;
          }
          failed(PUBLISH_FAILURES[outcome.reason] ?? 'studio.publish.failed');
          return undefined;
        })
        .catch(() => {
          if (isCurrent(started)) {
            failed('studio.publish.failed');
          }
        });
    },
    [name, view.state.entitled, view.problems, isCurrent, setDraft],
  );

  return {
    preparing,
    draft,
    publishing,
    notice,
    begin,
    capture,
    choose,
    publish,
    cancel,
  };
}
