import { useEffect, useRef, useState } from 'react';
import { decodePicture } from '../scenePicture';
import { cropPixels, type ICropBox } from './sketchCrop';
import type { TSketchMark } from './sketchMarks';

/** What a crop replaced, for Undo to put back. */
interface ICropped {
  picture: ImageBitmap;
  marks: TSketchMark[];
}

/**
 * The sketch's picture, the marks on it and the crops taken from it: Undo
 * takes back the last mark, and once there are none, the last crop with the
 * marks it held. Every picture made here is kept until the dialog goes,
 * since Undo may go back to any of them.
 *
 * `onUnreadable` is told when the picture handed in cannot be decoded, or
 * when its header says it decodes past `PICTURE_BOUNDS`.
 */
export default function useSketchPicture(
  image: Uint8Array,
  onUnreadable: () => void,
) {
  const [picture, setPicture] = useState<ImageBitmap>();
  const [marks, setMarks] = useState<TSketchMark[]>([]);
  const [cropped, setCropped] = useState<ICropped[]>([]);
  const bitmaps = useRef<ImageBitmap[]>([]);

  useEffect(() => {
    let live = true;
    // Through the header check every decode of a chat's picture asks first
    // (`decodePicture`): the sketch also opens on pictures Claude's looks and
    // ChatGPT brought in, from the chat's picture viewer.
    decodePicture(image)
      .then((bitmap) => {
        if (!bitmap) {
          if (live) {
            onUnreadable();
          }
          return undefined;
        }
        if (live) {
          bitmaps.current.push(bitmap);
          setPicture(bitmap);
        } else {
          bitmap.close();
        }
        return undefined;
      })
      .catch(() => onUnreadable());
    return () => {
      live = false;
    };
  }, [image, onUnreadable]);

  const gone = useRef(false);
  useEffect(
    () => () => {
      gone.current = true;
      bitmaps.current.forEach((bitmap) => bitmap.close());
      bitmaps.current = [];
    },
    [],
  );

  return {
    picture,
    marks,
    setMarks,
    /** How many crops have been taken: each is a new picture to fit. */
    crops: cropped.length,
    canUndo: marks.length > 0 || cropped.length > 0,
    undo: () => {
      if (marks.length > 0) {
        setMarks((done) => done.slice(0, -1));
        return;
      }
      const before = cropped[cropped.length - 1];
      if (before) {
        setCropped((all) => all.slice(0, -1));
        setPicture(before.picture);
        setMarks(before.marks);
      }
    },
    /**
     * The part of `drawn` inside `box` becomes the picture, the marks drawn
     * on it with it. `drawn` is the canvas the picture and its marks are
     * painted on, at the picture's own size.
     */
    cropTo: async (drawn: HTMLCanvasElement, box: ICropBox) => {
      if (!picture) {
        return;
      }
      const kept = cropPixels(box, picture);
      const out = document.createElement('canvas');
      out.width = kept.width;
      out.height = kept.height;
      out
        .getContext('2d')
        ?.drawImage(
          drawn,
          kept.x,
          kept.y,
          kept.width,
          kept.height,
          0,
          0,
          kept.width,
          kept.height,
        );
      const bitmap = await createImageBitmap(out);
      // Closed with the dialog while it was being made: nobody will show it.
      if (gone.current) {
        bitmap.close();
        return;
      }
      bitmaps.current.push(bitmap);
      setCropped((all) => [...all, { picture, marks }]);
      setPicture(bitmap);
      setMarks([]);
    },
  };
}
