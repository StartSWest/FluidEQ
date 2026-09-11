import { useCallback, useEffect, useRef, useState } from 'react';
import type { TranslationKey } from 'common/i18n';
import type { IPublishedScene, TPlusCategory } from 'common/plusGallery';
import { PLUS_TERMS_VERSION } from 'common/plusTerms';
import { requestAccountPanel } from '../account/accountPanel';
import { markGalleryStale } from '../plus/galleryStore';
import type { TStillTaker } from './StudioStage';
import {
  publishStudioScene,
  studioTermsAgreed,
  type IStudioView,
} from './studioStore';
import type { ISharingNotice } from './useStudioSharing';

/** The gallery's picture: the size the server accepts, and the size it shows. */
const STILL_WIDTH = 480;
const STILL_HEIGHT = 270;
/** The server refuses a picture over 256KB; this leaves a wide margin. */
const STILL_QUALITIES = [0.86, 0.7, 0.5] as const;
const MAX_STILL_BYTES = 240 * 1024;

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

const encode = (canvas: HTMLCanvasElement, quality: number) =>
  new Promise<Blob | null>((resolve) => {
    canvas.toBlob(resolve, 'image/webp', quality);
  });

const asDataUrl = (blob: Blob) =>
  new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });

/**
 * The stage's frame, cropped to fill 16:9 and scaled to the gallery's size.
 * Drawn onto a 2D canvas at once — the WebGL frame is gone after this task —
 * and encoded from there at leisure.
 */
const cropStill = (
  source: HTMLCanvasElement,
): HTMLCanvasElement | undefined => {
  const still = document.createElement('canvas');
  still.width = STILL_WIDTH;
  still.height = STILL_HEIGHT;
  const context = still.getContext('2d');
  if (!context || source.width < 2 || source.height < 2) {
    return undefined;
  }
  const scale = Math.max(
    STILL_WIDTH / source.width,
    STILL_HEIGHT / source.height,
  );
  const width = STILL_WIDTH / scale;
  const height = STILL_HEIGHT / scale;
  context.drawImage(
    source,
    (source.width - width) / 2,
    (source.height - height) / 2,
    width,
    height,
    0,
    0,
    STILL_WIDTH,
    STILL_HEIGHT,
  );
  return still;
};

/** The first quality whose WebP fits, tried in order; each only if the last was too big. */
const encodeStill = async (
  still: HTMLCanvasElement,
  qualities: readonly number[] = STILL_QUALITIES,
): Promise<Blob | undefined> => {
  const [quality, ...rest] = qualities;
  if (quality === undefined) {
    return undefined;
  }
  const blob = await encode(still, quality);
  return blob && blob.type === 'image/webp' && blob.size <= MAX_STILL_BYTES
    ? blob
    : encodeStill(still, rest);
};

/** The still, as the bytes sent and the picture the dialog shows. */
const readStill = async (blob: Blob) => ({
  picture: new Uint8Array(await blob.arrayBuffer()),
  pictureUrl: await asDataUrl(blob),
});

/**
 * Publish, from the Studio: a still of the stage, the dialog, and everything
 * the server can say back.
 *
 * The still is taken from the frame the stage draws next — an event, not a
 * guess at when one will be ready — and if the stage stops before it draws
 * one, the request is dropped and said so.
 */
export default function useStudioPublish(
  view: IStudioView,
  playing: boolean,
  name: string,
) {
  const stillRef = useRef<TStillTaker | undefined>(undefined);
  const [capturing, setCapturing] = useState(false);
  const [draft, setDraft] = useState<IPublishDraft>();
  const [publishing, setPublishing] = useState(false);
  const [notice, setNotice] = useState<ISharingNotice>();
  const packId = view.pack?.id;

  useEffect(() => {
    if (capturing && !playing) {
      stillRef.current = undefined;
      setCapturing(false);
      setNotice({ ok: false, key: 'studio.publish.noPicture' });
    }
  }, [capturing, playing]);

  const begin = useCallback(() => {
    if (capturing || !playing) {
      return;
    }
    setNotice(undefined);
    setCapturing(true);
    const taken = new Promise<HTMLCanvasElement | undefined>((resolve) => {
      stillRef.current = (canvas) => resolve(cropStill(canvas));
    });
    const published = window.electron?.ipcRenderer
      ?.myPublishedScenes?.()
      .then((outcome) =>
        outcome.ok
          ? outcome.scenes.find((scene) => scene.sceneId === packId)
          : undefined,
      )
      .catch(() => undefined);
    Promise.all([taken, published, studioTermsAgreed()])
      .then(async ([still, alreadyPublished, agreed]) => {
        const blob = still ? await encodeStill(still) : undefined;
        const read = blob ? await readStill(blob) : undefined;
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
  }, [capturing, playing, packId]);

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
    stillRef,
    capturing,
    draft,
    publishing,
    notice,
    begin,
    publish,
    cancel: () => setDraft(undefined),
  };
}
