/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { createPortal } from 'react-dom';
import { useTransportSources } from '../audio/transportSource';
import LibraryCoverArt from './LibraryCoverArt';
import useStageArtFrame from './useStageArtFrame';
import '../styles/LibraryStageArt.scss';

/**
 * The machine's own song behind an expanded or full-screen graph, the way the
 * Library's is.
 *
 * Spotify, a browser tab or anything else Windows knows is playing used to get
 * the bare plot on the app's background in these modes — the quiet surface on
 * purpose, back when nothing about an outside player's song was known beyond
 * its title (Ivan, 2026-09-23: "when doing expanded mode or fullscreen on
 * system audio we can show the cover art too same as we do for library"). The
 * cover now comes with the title from Windows' own media session
 * (`systemMedia.ts`), so the picture is the Library's picture: the same wash,
 * the same record in the middle, the same caption, in the same box.
 *
 * With no picture — a player that publishes none, or one not read yet — the
 * record is the generated tile, exactly as a Library track with no cover gets.
 * A game is a source too, and its icon is its cover.
 *
 * Same classes as the Library's on purpose: this is the same view with a
 * different source, and a second stylesheet would be a second design.
 */
const SystemStageArt = () => {
  const { system } = useTransportSources();

  useStageArtFrame();

  if (!system?.title || typeof document === 'undefined') {
    return null;
  }

  const cover = system.artworkUrl;

  return createPortal(
    <div className="library-stage-art" aria-hidden="true">
      {cover && (
        <img
          className="library-stage-art__wash"
          src={cover}
          alt=""
          aria-hidden
        />
      )}
      <div className="library-stage-art__cover">
        <LibraryCoverArt src={cover} label={system.title} size="cover" />
      </div>
      <div className="library-stage-art__meta">
        <h2>{system.title}</h2>
        {system.subtitle && <p>{system.subtitle}</p>}
      </div>
    </div>,
    document.body,
  );
};

export default SystemStageArt;
