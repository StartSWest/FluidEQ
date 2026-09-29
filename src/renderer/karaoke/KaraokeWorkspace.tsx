/*
<AQUA: System-wide parametric audio equalizer interface>
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

import '../styles/Karaoke.scss';
import useKaraokeWorkspaceStage from './useKaraokeWorkspaceStage';
import useKaraokeWorkspacePlaylist from './useKaraokeWorkspacePlaylist';
import KaraokeWorkspaceView from './KaraokeWorkspaceView';

export interface IKaraokeWorkspaceProps {
  /** Hidden instead of unmounted so future playback and capture survive tabs. */
  isHidden: boolean;
  isFullScreen?: boolean;
  isGraphOverlay?: boolean;
  isChromeIdle?: boolean;
  hasFullScreenTopBar?: boolean;
  onToggleFullScreenTopBar?: () => void;
  onToggleFullScreen?: () => void;
}

/** Local player composition. File bytes stay in renderer-owned File handles. */
const KaraokeWorkspace = ({
  isHidden,
  isFullScreen = false,
  isGraphOverlay = false,
  isChromeIdle = false,
  hasFullScreenTopBar = true,
  onToggleFullScreenTopBar = () => undefined,
  onToggleFullScreen = () => undefined,
}: IKaraokeWorkspaceProps) => {
  // The stage's hooks, then the playlist's, in the order they have always
  // run; the markup reads both and holds nothing of its own.
  const stage = useKaraokeWorkspaceStage({
    isFullScreen,
    isHidden,
  });
  const songs = useKaraokeWorkspacePlaylist(stage, {
    isHidden,
  });
  return (
    <KaraokeWorkspaceView
      stage={stage}
      songs={songs}
      hasFullScreenTopBar={hasFullScreenTopBar}
      isChromeIdle={isChromeIdle}
      isFullScreen={isFullScreen}
      isGraphOverlay={isGraphOverlay}
      isHidden={isHidden}
      onToggleFullScreen={onToggleFullScreen}
      onToggleFullScreenTopBar={onToggleFullScreenTopBar}
    />
  );
};

export default KaraokeWorkspace;
