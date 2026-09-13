import type { CSSProperties } from 'react';
import type { IArtworkRegion } from 'main/memberScenes/artworkRegions';

/**
 * A region's size the way it is saved. Packing may lay a piece on its side
 * to fit the image; saving stands it back up.
 */
export const uprightSize = (region: IArtworkRegion) =>
  region.rotated
    ? { width: region.height, height: region.width }
    : { width: region.width, height: region.height };

interface IAtlasPictureProps {
  /** The scene's whole image, as an object URL. */
  url: string;
  atlasWidth: number;
  atlasHeight: number;
  region: IArtworkRegion;
  className: string;
  /** Its name for assistive technology, where no button around it says so. */
  label?: string;
}

/**
 * One region of the scene's image, upright, drawn straight from the whole
 * image — every tile, thumbnail and the viewer share the one decoded picture
 * instead of each holding a copy cut out of it.
 *
 * Turned exactly the way `copyRegion` turns it before saving, so what is on
 * screen is what "Save image" writes. The piece packed sideways used to show
 * sideways here and save upright.
 *
 * Publishes `--aspect`, the upright width over height, so a stylesheet can
 * fit it into any box without a percentage height (see `StudioPictures.scss`).
 */
export default function AtlasPicture({
  url,
  atlasWidth,
  atlasHeight,
  region,
  className,
  label,
}: IAtlasPictureProps) {
  const upright = uprightSize(region);
  return (
    <svg
      className={className}
      viewBox={`0 0 ${upright.width} ${upright.height}`}
      style={{ '--aspect': upright.width / upright.height } as CSSProperties}
      role={label ? 'img' : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
      focusable="false"
    >
      {/* `rotate(-90)` about the origin, then down by the piece's own width:
          the canvas transform `copyRegion` applies, written for SVG. */}
      <g
        transform={
          region.rotated
            ? `translate(0 ${region.width}) rotate(-90)`
            : undefined
        }
      >
        {/* A nested viewport clips to the region by itself; no clip path,
            so no id to keep unique across the page. */}
        <svg
          width={region.width}
          height={region.height}
          viewBox={`${region.x} ${region.y} ${region.width} ${region.height}`}
        >
          <image href={url} width={atlasWidth} height={atlasHeight} />
        </svg>
      </g>
    </svg>
  );
}
