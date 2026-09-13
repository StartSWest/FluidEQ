import { useCallback, useEffect, useRef, useState } from 'react';
import type { TranslationKey } from 'common/i18n';
import type { IPictureFraming } from 'common/pictureFraming';
import type {
  IPictureSlot,
  IStudioPicture,
  TStudioPictures,
} from 'main/ipc/studioPictures';
import { decodePicture, keptPhoto, layPicture } from './scenePicture';
import sameStudioPictures from './sameStudioPictures';

type TPictureOutcome =
  'saved' | 'no-slot' | 'bad-slot' | 'too-large' | 'unreadable' | 'failed';

const NOTICE_KEYS: Record<TPictureOutcome, TranslationKey> = {
  saved: 'studio.picture.saved',
  'no-slot': 'studio.picture.noSlot',
  'bad-slot': 'studio.picture.badSlot',
  'too-large': 'studio.picture.tooLarge',
  unreadable: 'studio.picture.unreadable',
  failed: 'studio.picture.failed',
};

export interface IPictureNotice {
  ok: boolean;
  key: TranslationKey;
}

export interface IPicturePreview {
  /** What is in the place now, small; absent while it is drawn. */
  url?: string;
  /** Whether anything is in the place at all. */
  filled: boolean;
}

/** A photo on the framing editor, for one picture. */
export interface IFramingSession {
  picture: IStudioPicture;
  photo: ImageBitmap;
  /** Where the editor starts: the member's framing, or the scene's. */
  framing: IPictureFraming;
}

/** A preview's longest side: a card's tile, sharp on a 2x display. */
const PREVIEW_EDGE = 360;

/** Alpha a pixel needs to count as something being there. */
const FILLED_ALPHA = 8;

/**
 * Each place of `image` as a small picture of its own, and whether anything
 * is in it: a place the member has not filled yet is clear, and says so.
 */
const previewsOf = async (
  image: Uint8Array | undefined,
  pictures: IPictureSlot[],
): Promise<Record<string, IPicturePreview>> => {
  const bitmap = image ? await decodePicture(image) : undefined;
  const previews: Record<string, IPicturePreview> = {};
  if (!bitmap) {
    pictures.forEach((slot) => {
      previews[slot.id] = { filled: false };
    });
    return previews;
  }
  await Promise.all(
    pictures.map(async (slot) => {
      const scale = Math.min(
        1,
        PREVIEW_EDGE / Math.max(slot.width, slot.height),
      );
      const canvas = document.createElement('canvas');
      canvas.width = Math.max(1, Math.round(slot.width * scale));
      canvas.height = Math.max(1, Math.round(slot.height * scale));
      const context = canvas.getContext('2d', { willReadFrequently: true });
      if (!context) {
        previews[slot.id] = { filled: false };
        return;
      }
      context.imageSmoothingQuality = 'high';
      context.drawImage(
        bitmap,
        slot.x,
        slot.y,
        slot.width,
        slot.height,
        0,
        0,
        canvas.width,
        canvas.height,
      );
      const { data } = context.getImageData(0, 0, canvas.width, canvas.height);
      let filled = false;
      for (let alpha = 3; alpha < data.length && !filled; alpha += 16) {
        filled = data[alpha] > FILLED_ALPHA;
      }
      const blob = filled
        ? await new Promise<Blob | null>((resolve) => {
            canvas.toBlob(resolve, 'image/webp', 0.9);
          })
        : null;
      previews[slot.id] = blob
        ? { url: URL.createObjectURL(blob), filled }
        : { filled };
    }),
  );
  bitmap.close();
  return previews;
};

const revokeAll = (previews: Record<string, IPicturePreview>) =>
  Object.values(previews).forEach(
    (preview) => preview.url && URL.revokeObjectURL(preview.url),
  );

/**
 * A photo from the system dialog as a bitmap, or why there is none. The
 * dialog is the main process's; only the photo's bytes come back.
 */
const pickPhoto = async (
  label: string,
): Promise<ImageBitmap | TPictureOutcome | 'cancelled'> => {
  const chosen =
    await window.electron?.ipcRenderer?.chooseStudioPicture?.(label);
  if (!chosen) {
    return 'failed';
  }
  if (!chosen.ok) {
    return chosen.reason;
  }
  return (await decodePicture(chosen.bytes)) ?? 'unreadable';
};

/**
 * The Studio's Pictures card: the pictures the open scene asks for, what is
 * in each now, and framing a photo into one.
 *
 * Read again whenever the Studio's view of the project changes — every build
 * the folder's watcher makes, every project switch — because the member's AI
 * rewrites `pack.json` whenever it likes, and a missing picture fails the
 * same way whatever else changed; and read again after every save.
 *
 * Opening a picture takes its kept photo straight to the framing editor, at
 * the member's own framing; a picture with none asks for a photo first and
 * starts from how the scene would have it sit.
 */
export default function useScenePictures(
  label: string,
  /** A new value whenever the Studio's view of the project changes. */
  revision: unknown,
) {
  const [pictures, setPictures] = useState<TStudioPictures>();
  const [previews, setPreviews] = useState<Record<string, IPicturePreview>>({});
  /** The picture being opened: its photo read, or a photo being chosen. */
  const [opening, setOpening] = useState<string>();
  const [session, setSession] = useState<IFramingSession>();
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState<IPictureNotice>();
  const [reads, setReads] = useState(0);
  const generation = useRef(0);
  const loaded = useRef<TStudioPictures | undefined>(undefined);
  // The previews on screen, let go only once new ones replace them, so a
  // re-read never shows a broken picture in between.
  const shown = useRef<Record<string, IPicturePreview>>({});
  const sessionRef = useRef(session);
  sessionRef.current = session;

  useEffect(
    () => () => {
      revokeAll(shown.current);
      sessionRef.current?.photo.close();
    },
    [],
  );

  useEffect(() => {
    generation.current += 1;
    const mine = generation.current;
    const read = window.electron?.ipcRenderer?.readStudioPictures?.();
    if (!read) {
      setPictures({ kind: 'none' });
      return;
    }
    read
      .then(async (next) => {
        if (mine !== generation.current) {
          return undefined;
        }
        if (sameStudioPictures(loaded.current, next)) {
          return undefined;
        }
        const made =
          next.kind === 'atlas'
            ? await previewsOf(next.image, next.pictures)
            : {};
        if (mine !== generation.current) {
          revokeAll(made);
          return undefined;
        }
        revokeAll(shown.current);
        shown.current = made;
        loaded.current = next;
        setPictures(next);
        setPreviews(made);
        return undefined;
      })
      .catch(() => {
        if (mine === generation.current) {
          loaded.current = undefined;
          setPictures({ kind: 'none' });
        }
      });
  }, [revision, reads]);

  const report = useCallback(
    (outcome: TPictureOutcome) =>
      setNotice({ ok: outcome === 'saved', key: NOTICE_KEYS[outcome] }),
    [],
  );

  const open = useCallback(
    (picture: IStudioPicture) => {
      if (opening || session) {
        return;
      }
      setOpening(picture.id);
      setNotice(undefined);
      const kept = picture.hasPhoto
        ? window.electron?.ipcRenderer?.readStudioPicturePhoto?.(picture.id)
        : undefined;
      Promise.resolve(kept)
        .then(async (bytes) => {
          const photo = bytes ? await decodePicture(bytes) : undefined;
          if (photo) {
            return { photo, framing: picture.framed };
          }
          const picked = await pickPhoto(label);
          return picked instanceof ImageBitmap
            ? { photo: picked, framing: picture.framing }
            : picked;
        })
        .then((result) => {
          setOpening(undefined);
          if (typeof result === 'string') {
            if (result !== 'cancelled') {
              report(result);
            }
            return undefined;
          }
          setSession({ picture, ...result });
          return undefined;
        })
        .catch(() => {
          setOpening(undefined);
          report('failed');
        });
    },
    [label, opening, session, report],
  );

  /** Another photo for the picture on the editor, framed as the scene would. */
  const another = useCallback(() => {
    const { current } = sessionRef;
    if (!current || saving) {
      return;
    }
    pickPhoto(label)
      .then((picked) => {
        if (typeof picked === 'string') {
          if (picked !== 'cancelled') {
            report(picked);
          }
          return undefined;
        }
        setSession((now) => {
          if (!now || now.picture.id !== current.picture.id) {
            picked.close();
            return now;
          }
          now.photo.close();
          return { ...now, photo: picked, framing: now.picture.framing };
        });
        return undefined;
      })
      .catch(() => report('failed'));
  }, [label, saving, report]);

  const cancel = useCallback(() => {
    if (saving) {
      return;
    }
    setSession((now) => {
      now?.photo.close();
      return undefined;
    });
  }, [saving]);

  const save = useCallback(
    (framing: IPictureFraming) => {
      const { current } = sessionRef;
      if (!current || saving || pictures?.kind !== 'atlas') {
        return;
      }
      setSaving(true);
      const { picture, photo } = current;
      Promise.all([
        layPicture(pictures, picture, photo, framing),
        keptPhoto(photo),
      ])
        .then(async ([image, kept]) => {
          if (!image) {
            return 'failed' as const;
          }
          const written =
            await window.electron?.ipcRenderer?.saveStudioPicture?.(
              image,
              kept ? { id: picture.id, photo: kept, framing } : undefined,
            );
          if (written === 'no-slot' || written === 'bad-slot') {
            return written;
          }
          return written === 'written' ? 'saved' : 'failed';
        })
        .then((outcome) => {
          setSaving(false);
          report(outcome);
          if (outcome === 'saved') {
            setSession((now) => {
              now?.photo.close();
              return undefined;
            });
            setReads((count) => count + 1);
          }
          return undefined;
        })
        .catch(() => {
          setSaving(false);
          report('failed');
        });
    },
    [pictures, saving, report],
  );

  return {
    pictures,
    previews,
    opening,
    session,
    saving,
    notice,
    open,
    another,
    cancel,
    save,
  };
}
