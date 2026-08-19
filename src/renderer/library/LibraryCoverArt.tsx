/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU General Public License as published by
the Free Software Foundation, either version 3 of the License, or
(at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
GNU General Public License for more details.

You should have received a copy of the GNU General Public License
along with this program.  If not, see <https://www.gnu.org/licenses/>.
*/

import {
  libraryTileHue,
  libraryTileInitials,
} from '../../common/library/artwork';
import { libraryMediaUrl } from '../../main/library/libraryProtocol';

export type TLibraryCoverArtSize = 'row' | 'tile' | 'cover';

interface ILibraryCoverArtProps {
  /** Thumbnail id in the art cache; absent draws the generated tile. */
  artId?: string;
  /** What the initials and the hue are derived from — the track, album or
   * artist name this cover stands for. */
  label: string;
  size: TLibraryCoverArtSize;
}

/**
 * A two-stop gradient rather than a flat fill, matching the gradient every
 * other surface in `_theme.scss` uses — a generated tile should read as a
 * surface, not a swatch. Darker at both ends than the euphoria accent's
 * `95% 62%` (`_theme.scss`): those stops are a glow layered over dark art,
 * this hue IS the background, and the initials drawn on it need to read as
 * white text rather than fight the colour for attention.
 */
const libraryTileBackground = (label: string): string => {
  const hue = libraryTileHue(label);
  return `linear-gradient(155deg, hsl(${hue}deg 58% 34%), hsl(${hue}deg 66% 20%))`;
};

/**
 * One component, three sizes — every view that shows a track, an album or an
 * artist reuses this rather than drawing its own cover.
 *
 * `alt=""` on the image and `aria-hidden="true"` on the generated tile are
 * the same decision applied to both branches: the label this stands for is
 * always set beside it in text already, so a screen reader reading the
 * album name a second time — or reading out one or two bare initials on a
 * freshly scanned library, where most rows have no cover yet — is worse
 * than not reading the image at all.
 */
const LibraryCoverArt = ({ artId, label, size }: ILibraryCoverArtProps) => (
  <span className={`library-cover-art library-cover-art--${size}`}>
    {artId ? (
      <img
        className="library-cover-art__image"
        src={libraryMediaUrl('art', artId)}
        alt=""
        loading="lazy"
      />
    ) : (
      <span
        className="library-cover-art__tile"
        style={{ background: libraryTileBackground(label) }}
        aria-hidden="true"
      >
        {libraryTileInitials(label)}
      </span>
    )}
  </span>
);

export default LibraryCoverArt;
