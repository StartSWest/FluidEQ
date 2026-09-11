import { useCallback, useRef, useState } from 'react';
import type { TranslationKey } from 'common/i18n';
import type { IPublishedScene, TPlusCategory } from 'common/plusGallery';
import { PLUS_TERMS_VERSION } from 'common/plusTerms';
import { requestAccountPanel } from '../account/accountPanel';
import { blobAsDataUrl, renderSceneStill } from '../graph/sceneStill';
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

export interface IPublishDraft {
  /** The WebP bytes sent with the scene. */
  picture: Uint8Array;
  /** The same picture, for the dialog to show. */
  pictureUrl: string;
  /** This scene as it is already published, when it is. */
  published?: IPublishedScene;
  /** Whether the Plus terms this app carries were agreed on this computer. */
  agreed: boolean;
}

/** The picture, as the bytes sent and the image the dialog shows. */
const readStill = async (blob: Blob) => ({
  picture: new Uint8Array(await blob.arrayBuffer()),
  pictureUrl: await blobAsDataUrl(blob),
});

/**
 * Publish, from the Studio: a picture of the scene, the dialog, and
 * everything the server can say back.
 *
 * The picture is the real scene — this version of the project's own pack,
 * drawn on the showcase signal, a busy chorus over moving noise, so it is
 * caught reacting whatever the member was testing with. It is drawn off the
 * stage and at the gallery's full quality (see `sceneStill.ts`): the stage
 * may be running at a fraction of its size on this machine, and the picture
 * is what every other member judges the scene by. "Take another" draws the
 * next moment of the same run.
 */
export default function useStudioPublish(
  view: IStudioView,
  playing: boolean,
  name: string,
) {
  const [capturing, setCapturing] = useState(false);
  const [draft, setDraft] = useState<IPublishDraft>();
  const [publishing, setPublishing] = useState(false);
  const [notice, setNotice] = useState<ISharingNotice>();
  /** Which moment the next picture is of; each retake moves it on. */
  const moment = useRef(0);
  const { pack } = view;
  const packId = pack?.id;

  const takePicture = useCallback(async () => {
    if (!pack) {
      return undefined;
    }
    const blob = await renderSceneStill(pack, { moment: moment.current });
    return blob ? readStill(blob) : undefined;
  }, [pack]);

  const begin = useCallback(() => {
    if (capturing || !playing) {
      return;
    }
    setNotice(undefined);
    setCapturing(true);
    moment.current = 0;
    const published = window.electron?.ipcRenderer
      ?.myPublishedScenes?.()
      .then((outcome) =>
        outcome.ok
          ? outcome.scenes.find((scene) => scene.sceneId === packId)
          : undefined,
      )
      .catch(() => undefined);
    Promise.all([takePicture(), published, studioTermsAgreed()])
      .then(([read, alreadyPublished, agreed]) => {
        setCapturing(false);
        if (!read) {
          setNotice({ ok: false, key: 'studio.publish.noPicture' });
          return undefined;
        }
        setDraft({
          ...read,
          agreed: agreed >= PLUS_TERMS_VERSION,
          ...(alreadyPublished ? { published: alreadyPublished } : {}),
        });
        return undefined;
      })
      .catch(() => {
        setCapturing(false);
        setNotice({ ok: false, key: 'studio.publish.noPicture' });
      });
  }, [capturing, playing, packId, takePicture]);

  /** Another picture for the open dialog, from a later moment. */
  const retake = useCallback(() => {
    if (capturing || !playing || !draft) {
      return;
    }
    setCapturing(true);
    moment.current += 1;
    takePicture()
      .then((read) => {
        setCapturing(false);
        if (read) {
          setDraft((current) => (current ? { ...current, ...read } : current));
        }
        return undefined;
      })
      .catch(() => setCapturing(false));
  }, [capturing, playing, draft, takePicture]);

  const publish = useCallback(
    (category: TPlusCategory) => {
      if (!draft || publishing) {
        return;
      }
      setPublishing(true);
      publishStudioScene(PLUS_TERMS_VERSION, category, draft.picture)
        .then((outcome) => {
          setPublishing(false);
          setDraft(undefined);
          if (outcome.ok) {
            markGalleryStale();
            setNotice({
              ok: true,
              key: draft.published
                ? 'studio.publish.updated'
                : 'studio.publish.done',
              vars: { name },
            });
            return undefined;
          }
          if (outcome.reason === 'not-entitled') {
            requestAccountPanel('subscribe');
            return undefined;
          }
          setNotice({
            ok: false,
            key: PUBLISH_FAILURES[outcome.reason] ?? 'studio.publish.failed',
          });
          return undefined;
        })
        .catch(() => {
          setPublishing(false);
          setNotice({ ok: false, key: 'studio.publish.failed' });
        });
    },
    [draft, publishing, name],
  );

  return {
    capturing,
    draft,
    publishing,
    notice,
    begin,
    retake,
    publish,
    cancel: () => setDraft(undefined),
  };
}
