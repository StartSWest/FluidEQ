import { useState, type CSSProperties } from 'react';
import { useLookThumbnail } from '../graph/lookThumbnails';
import type { IWallpaperLook } from './wallpaperLooks';

/**
 * A visualizer beside its monitor's line: a frame of the scene, cropped to the
 * shape of a screen, with its maker's colours underneath until the frame is
 * there — the same picture the monitors above the list carry, from one cache.
 */
export default function LookSwatch({ look }: { look: IWallpaperLook }) {
  const [element, setElement] = useState<HTMLSpanElement | null>(null);
  const picture = useLookThumbnail(
    look.picture ?? { lookId: '', version: '' },
    look.picture ? element : null,
  );
  const [first, second = first] = look.swatch;
  const colours = first
    ? ({ '--screen-a': first, '--screen-b': second } as CSSProperties)
    : undefined;
  return (
    <span
      ref={setElement}
      className="wallpaper-screen__swatch"
      style={colours}
      aria-hidden="true"
    >
      {picture.state === 'ready' && (
        <img src={picture.url} alt="" draggable={false} />
      )}
    </span>
  );
}
