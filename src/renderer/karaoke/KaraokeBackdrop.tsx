/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026> <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import type { CSSProperties } from 'react';
import type { IKaraokeSong } from '../../common/karaoke/types';
import { useOverlayBlur } from '../utils/graphOverlay';
import KaraokeGraphBackground from './KaraokeGraphBackground';
import KaraokeLights from './KaraokeLights';
import KaraokeStageMedia, { hasKaraokeStageArt } from './KaraokeStageMedia';
import { KaraokeLiveValue, type IKaraokeLiveValue } from './karaokeLiveValue';
import type { TKaraokeBackground } from './karaokeWorkspacePrefs';
import { useKaraokeSceneAppearance } from './karaokeSceneAppearance';

/**
 * What stands behind the words. The graph's scene, the song's cover, the
 * stage's own lights when there is neither — or nothing at all while the
 * window's visualizer is drawn through the page: its picture is the
 * backdrop then, and lights laid over it were a second spotlight on a stage
 * that already had one (Ivan, 2026-10-29).
 */
export type TKaraokeBackdropKind = 'graph' | 'cover' | 'lights' | 'none';

export const karaokeBackdropKind = (
  background: TKaraokeBackground,
  song: IKaraokeSong | undefined,
  isGraphOverlay: boolean,
): TKaraokeBackdropKind => {
  if (background === 'graph') {
    return 'graph';
  }
  if (background === 'cover' && song && hasKaraokeStageArt(song)) {
    return 'cover';
  }
  return isGraphOverlay ? 'none' : 'lights';
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
  const kind = karaokeBackdropKind(background, song, isGraphOverlay);
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
      {kind === 'cover' && song && (
        <KaraokeLiveValue value={playhead}>
          {(playheadMs) => (
            <KaraokeStageMedia
              song={song}
              playheadMs={playheadMs}
              isPlaying={isPlaying}
            />
          )}
        </KaraokeLiveValue>
      )}
      {kind === 'lights' && <KaraokeLights isPlaying={isPlaying} />}
    </div>
  );
}
