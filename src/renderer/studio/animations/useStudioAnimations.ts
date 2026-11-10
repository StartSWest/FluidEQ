import { useEffect, useRef, useState } from 'react';
import { feetLineOf, measureAnimation } from 'common/animationFrames';
import { isDecodablePicture, SHEET_BOUNDS } from 'common/pictureBounds';
import { frameCell, type IStudioAnimation } from 'common/studioAnimation';

/**
 * The open project's animations as the Animations tab shows them: each
 * sheet decoded once into a bitmap the frames are drawn from, and measured
 * once for the line its creature's feet stand on (`animationFrames.ts`).
 *
 * Read again whenever the Studio's view of the project changes and whenever
 * main says one of their files did (`studioAnimations.ts`): the member's AI
 * writes a sheet and its file whenever it likes, and the tab shows what is
 * there now.
 */

export interface IViewedAnimation {
  animation: IStudioAnimation;
  /** Undefined when the sheet is not a picture the window can decode. */
  bitmap?: ImageBitmap;
  /** One frame's width over its height. */
  aspect: number;
  /** Where the feet stand, as a share of a frame's height from its top. */
  feetLine?: number;
}

/**
 * An animation as the tab shows it, from its sheet's bitmap: a frame's
 * shape, and where the feet stand. Also what an import's preview is
 * measured with, so it plays as it will once added.
 */
export const viewOf = (
  animation: IStudioAnimation,
  bitmap: ImageBitmap,
): IViewedAnimation => {
  const cell = frameCell(animation, bitmap.width, bitmap.height, 0);
  const aspect = cell.height > 0 ? cell.width / cell.height : 1;
  const canvas = document.createElement('canvas');
  canvas.width = bitmap.width;
  canvas.height = bitmap.height;
  const context = canvas.getContext('2d', { willReadFrequently: true });
  if (!context || cell.width < 1 || cell.height < 1) {
    return { animation, bitmap, aspect };
  }
  context.drawImage(bitmap, 0, 0);
  const pixels = context.getImageData(0, 0, bitmap.width, bitmap.height);
  const feetLine = feetLineOf(measureAnimation(pixels, animation));
  return {
    animation,
    bitmap,
    aspect,
    ...(feetLine === undefined ? {} : { feetLine }),
  };
};

const decode = async (
  animation: IStudioAnimation,
  sheet: Uint8Array,
): Promise<IViewedAnimation> => {
  // Main reads no sheet past the bounds; this window never decodes one
  // either, whatever handed it over.
  if (!isDecodablePicture(sheet, SHEET_BOUNDS)) {
    return { animation, aspect: 1 };
  }
  let bitmap: ImageBitmap;
  try {
    // A copy of exactly the file's bytes: the array handed across may be a
    // view into a larger buffer.
    bitmap = await createImageBitmap(new Blob([sheet.slice()]));
  } catch {
    return { animation, aspect: 1 };
  }
  return viewOf(animation, bitmap);
};

const release = (viewed: IViewedAnimation[] | undefined) =>
  viewed?.forEach(({ bitmap }) => bitmap?.close());

export default function useStudioAnimations(
  /** A new value whenever the Studio's view of the project changes. */
  revision: unknown,
): IViewedAnimation[] | undefined {
  const [animations, setAnimations] = useState<IViewedAnimation[]>();
  const [told, setTold] = useState(0);
  const generation = useRef(0);
  const shown = useRef<IViewedAnimation[] | undefined>(undefined);

  useEffect(
    () =>
      window.electron?.ipcRenderer?.onStudioAnimationsChanged?.(() =>
        setTold((count) => count + 1),
      ),
    [],
  );
  useEffect(() => () => release(shown.current), []);

  useEffect(() => {
    generation.current += 1;
    const mine = generation.current;
    const read = window.electron?.ipcRenderer?.readStudioAnimations?.();
    if (!read) {
      setAnimations([]);
      return;
    }
    read
      .then(async (found) => {
        if (mine !== generation.current) {
          return undefined;
        }
        const decoded =
          found.kind === 'animations'
            ? await Promise.all(
                found.animations.map(({ animation, sheet }) =>
                  decode(animation, sheet),
                ),
              )
            : [];
        if (mine !== generation.current) {
          release(decoded);
          return undefined;
        }
        release(shown.current);
        shown.current = decoded;
        setAnimations(decoded);
        return undefined;
      })
      .catch(() => {
        if (mine === generation.current) {
          setAnimations([]);
        }
      });
  }, [revision, told]);

  return animations;
}
