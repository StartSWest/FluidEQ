/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { useLastShown } from '../audio/lastShown';
import { useLiveAudioCapture } from '../audio/LiveAudioContext';
import LibraryCoverArt from '../library/LibraryCoverArt';
import { useTranslation } from '../utils/I18nContext';
import Marquee from './Marquee';
import PlayerPath from './PlayerPath';
import type { TPlayerPage } from './PlayerMarkMenu';
import { useLibraryDeck } from './libraryDeck';
import usePlayerSource from './usePlayerSource';

/**
 * What is playing, large, over the picture (the Stage, Ivan 2026-09-27): the
 * cover, the song and who sings it, and under them the path the sound takes
 * from where it comes from to the output (`PlayerPath`).
 *
 * Whatever is making sound, from whichever source — the Library, the Media
 * page, Karaoke, another program, another computer — through the one shape
 * they all publish (`transportSource.ts`); and while nothing is live, the
 * last thing that was, so the amp does not open blank (`lastShown.ts`).
 */
const PlayerNow = ({
  onOpenPage,
}: {
  onOpenPage: (page: TPlayerPage) => void;
}) => {
  const { t } = useTranslation();
  const source = usePlayerSource();
  const remembered = useLastShown();
  const shown = source ?? remembered;
  const library = useLibraryDeck();
  // The path's light follows the live capture, as the analyser does.
  useLiveAudioCapture(true);
  const isLibrary = source?.owner === 'library' && library !== undefined;
  const title = shown?.title ?? t('library.nothingPlaying');

  return (
    <section className="player-now" aria-label={t('player.deck.aria')}>
      <span className="player-now__art">
        <LibraryCoverArt
          src={isLibrary ? undefined : shown?.artworkUrl}
          artId={isLibrary ? library.track?.artId : undefined}
          label={title}
          size="tile"
        />
      </span>
      <Marquee text={title} className="player-now__title" />
      {shown?.subtitle && (
        <span className="player-now__artist">{shown.subtitle}</span>
      )}
      <div className="player-now__chips">
        <PlayerPath
          source={shown}
          codec={isLibrary ? library.track?.codec : undefined}
          onOpenPage={onOpenPage}
        />
      </div>
    </section>
  );
};

export default PlayerNow;
