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

import '../styles/Library.scss';
import useLibraryWorkspaceShelf from './useLibraryWorkspaceShelf';
import useLibraryWorkspaceNavigation from './useLibraryWorkspaceNavigation';
import LibraryWorkspaceView from './LibraryWorkspaceView';

export interface ILibraryWorkspaceProps {
  /** Hidden instead of unmounted, matching KaraokeWorkspace and VideoBrowser:
   * once a track is playing here, leaving the tab must not stop it. */
  isHidden: boolean;
  /** An album to open, asked for from outside — the now-playing bar pressing
   * "show me what is playing". Carries a nonce rather than an id alone so that
   * asking twice for the SAME album still reopens it after the user has
   * navigated away; an id-only prop would look unchanged and do nothing. */
  revealRequest?: { albumId: string; trackId: string; nonce: number };
  /** Shared fullscreen state owned by App across all three media tabs. */
  isFullScreen: boolean;
  /** Show only the playing art/video beneath an expanded graph. */
  isGraphBackdrop?: boolean;
  onToggleFullScreen: () => void;
}

const LibraryWorkspace = ({
  isHidden,
  revealRequest,
  isFullScreen,
  isGraphBackdrop = false,
  onToggleFullScreen,
}: ILibraryWorkspaceProps) => {
  const shelf = useLibraryWorkspaceShelf({
    revealRequest,
  });
  const navigation = useLibraryWorkspaceNavigation(shelf);
  return (
    <LibraryWorkspaceView
      shelf={shelf}
      navigation={navigation}
      isFullScreen={isFullScreen}
      isGraphBackdrop={isGraphBackdrop}
      isHidden={isHidden}
      onToggleFullScreen={onToggleFullScreen}
    />
  );
};

export default LibraryWorkspace;
