import { CROP_CORNERS } from './sketchCrop';
import type { TSketchCrop } from './useSketchCrop';

interface IStudioChatCropBoxProps {
  crop: TSketchCrop;
  /** The picture's own size, which the box is measured in. */
  width: number;
  height: number;
}

const percent = (part: number, whole: number) => `${(part / whole) * 100}%`;

/**
 * The crop box over the sketch's picture: what is outside it dimmed, its
 * thirds drawn as a photographer frames, a grip at each corner and the size
 * it keeps, in the picture's pixels. Placed in percent of the picture, so it
 * stays on what it frames at any zoom.
 *
 * Decorative to assistive technology: the crop is made with the pointer,
 * and the dialog's Crop button and Enter apply it.
 */
export default function StudioChatCropBox({
  crop,
  width,
  height,
}: IStudioChatCropBoxProps) {
  const { box } = crop;
  if (!box) {
    return null;
  }
  return (
    <div className="studio-chat-crop" aria-hidden>
      <div
        className={`studio-chat-crop__box${crop.usable ? '' : ' is-small'}`}
        style={{
          left: percent(box.x, width),
          top: percent(box.y, height),
          width: percent(box.width, width),
          height: percent(box.height, height),
        }}
        onPointerDown={(event) => crop.begin('move', event)}
        onPointerMove={crop.move}
        onPointerUp={crop.end}
        onPointerCancel={crop.end}
      >
        <span className="studio-chat-crop__third is-v1" />
        <span className="studio-chat-crop__third is-v2" />
        <span className="studio-chat-crop__third is-h1" />
        <span className="studio-chat-crop__third is-h2" />
        {CROP_CORNERS.map((corner) => (
          <span
            key={corner}
            className={`studio-chat-crop__corner is-${corner}`}
            onPointerDown={(event) => crop.begin(corner, event)}
            onPointerMove={crop.move}
            onPointerUp={crop.end}
            onPointerCancel={crop.end}
          />
        ))}
        <span className="studio-chat-crop__size">
          {Math.round(box.width)} × {Math.round(box.height)}
        </span>
      </div>
    </div>
  );
}
