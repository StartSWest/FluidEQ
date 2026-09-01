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

import LibraryCoverArt, { TLibraryCoverArtSize } from './LibraryCoverArt';
import '../styles/LibraryFolderArt.scss';

interface ILibraryFolderArtProps {
  /**
   * The cover of something beneath this folder — `ILibraryFolder.artId`, which
   * is the first art found anywhere under it and belongs to no particular
   * album. That is exactly why this component exists.
   */
  artId?: string;
  /** The folder's name, for the generated tile when nothing beneath it has a
   * cover yet. */
  label: string;
  size: TLibraryCoverArtSize;
}

/**
 * A folder, drawn as a folder, with what is inside it showing.
 *
 * The Folders shelf drew `LibraryCoverArt` directly, and a folder's `artId`
 * is the first cover found anywhere beneath it — so a root somebody added
 * wore the sleeve of one album three levels down, in a square identical to
 * the album tiles on the next shelf, and said it WAS that album. A directory
 * and an album cannot be the same drawing and stay legible.
 *
 * The silhouette carries what it is and the picture stays for what is in it:
 * the cover sits inside the folder rather than replacing it, with a rim of
 * folder left showing on all four sides and the tab above it. The picture is
 * `LibraryCoverArt` unchanged — same lazy loading, same generated-initials
 * fallback — and this only draws the folder around it.
 */
const LibraryFolderArt = ({ artId, label, size }: ILibraryFolderArtProps) => (
  <span className={`library-folder-art library-folder-art--${size}`}>
    <span className="library-folder-art__sleeve" aria-hidden="true" />
    <span className="library-folder-art__sheet">
      <LibraryCoverArt artId={artId} label={label} size={size} />
    </span>
  </span>
);

export default LibraryFolderArt;
