/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026> <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import type { CSSProperties } from 'react';
import type { IKaraokeSong } from '../../common/karaoke/types';
import { useOverlayBlur } from '../utils/graphOverlay';
import KaraokeGraphBackground from './KaraokeGraphBackground';
import KaraokeStageMedia, {
  hasKaraokeStageStill,
  hasKaraokeStageVideo,
} from './KaraokeStageMedia';
import { KaraokeLiveValue, type IKaraokeLiveValue } from './karaokeLiveValue';
import type { TKaraokeBackground } from './karaokeWorkspacePrefs';
import { useKaraokeSceneAppearance } from './karaokeSceneAppearance';

/**
 * What stands behind the words: the app's scene, the song's picture, the
 * song's video, or the bare flat stage. The stage's own dancing lights,
 * drawn when there was none of those, were taken out (Ivan, 2026-11-15:
 * "the lights that are now the bg, remove that"); the stage is the
 * Library's flat card then, as the K1 mockup draws it.
 */
export type TKaraokeBackdropKind = 'graph' | 'cover' | 'video' | 'none';

export const karaokeBackdropKind = (
  background: TKaraokeBackground,
  song: IKaraokeSong | undefined,
): TKaraokeBackdropKind => {
  if (background === 'graph') {
    return 'graph';
  }
  if (background === 'cover' && song && hasKaraokeStageStill(song)) {
    return 'cover';
  }
  if (background === 'video' && song && hasKaraokeStageVideo(song)) {
    return 'video';
  }
  return 'none';
};

/** Exactly one backdrop. Hidden pages unmount it, stopping every renderer. */
export default function KaraokeBackdrop({
  background,
  song,
  playhead,
  isPlaying,
  isGraphOverlay,
}: {
  background: TKaraokeBackground;
  song?: IKaraokeSong;
  playhead: IKaraokeLiveValue<number>;
  isPlaying: boolean;
  isGraphOverlay: boolean;
}) {
  const overlayBlur = useOverlayBlur();
  const scene = useKaraokeSceneAppearance();
  let blur = 0;
  if (background === 'graph') {
    blur = scene.blur;
  } else if (isGraphOverlay) {
    blur = overlayBlur;
  }
  const kind = karaokeBackdropKind(background, song);
  return (
    <div
      className="karaoke-backdrop"
      style={
        {
          '--karaoke-backdrop-filter': blur > 0 ? `blur(${blur}px)` : 'none',
          '--karaoke-scene-opacity': scene.opacity,
        } as CSSProperties
      }
    >
      {kind === 'graph' && <KaraokeGraphBackground />}
      {(kind === 'cover' || kind === 'video') && song && (
        <KaraokeLiveValue value={playhead}>
          {(playheadMs) => (
            <KaraokeStageMedia
              song={song}
              showsVideo={kind === 'video'}
              playheadMs={playheadMs}
              isPlaying={isPlaying}
            />
          )}
        </KaraokeLiveValue>
      )}
    </div>
  );
}
