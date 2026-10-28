/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026> <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import type { CSSProperties } from 'react';
import type { IKaraokeSong } from '../../common/karaoke/types';
import { useOverlayBlur } from '../utils/graphOverlay';
import KaraokeGraphBackground from './KaraokeGraphBackground';
import KaraokeStageMedia, { hasKaraokeStageArt } from './KaraokeStageMedia';
import { KaraokeLiveValue, type IKaraokeLiveValue } from './karaokeLiveValue';
import type { TKaraokeBackground } from './karaokeWorkspacePrefs';

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
  const blur = useOverlayBlur();
  const showsCover = background === 'cover' && song && hasKaraokeStageArt(song);
  return (
    <div
      className="karaoke-backdrop"
      style={
        {
          '--karaoke-backdrop-filter':
            isGraphOverlay && blur > 0 ? `blur(${blur}px)` : 'none',
        } as CSSProperties
      }
    >
      {background === 'graph' && <KaraokeGraphBackground />}
      {background !== 'graph' && showsCover && (
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
      {background !== 'graph' && !showsCover && (
        <div className="karaoke-stage-media karaoke-ambient" aria-hidden inert>
          <span className="karaoke-ambient__light" />
          <span className="karaoke-ambient__light is-cool" />
        </div>
      )}
    </div>
  );
}
