/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026> <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { type ReactNode, useState } from 'react';
import { useTranslation } from '../../utils/I18nContext';
import { featureFilmUrl } from './featureFilms';

/**
 * What it holds, drawn only once the site has the film: for a film recorded
 * after the build that announces it (the Visualizers' own, 2.5), whose key
 * would otherwise open a player that says the film cannot be played.
 *
 * The site answers through the film itself: a muted, hidden video asks for
 * its first bytes only (`preload="metadata"`) and says yes on
 * `loadedmetadata`, no on `error`. Nothing is drawn while it asks or after a
 * no, so the page looks as if there were no film until there is one. The
 * same request the player makes, under the same rule (media from FluidEQ's
 * own site and nowhere else), with no cookie and nothing about the reader.
 */
export default function FilmOnSite({
  id,
  children,
}: {
  id: string;
  children: ReactNode;
}) {
  const { locale } = useTranslation();
  const src = featureFilmUrl(id, locale);
  // Keyed by the source, so a language with another voice asks again.
  const [answer, setAnswer] = useState<{ src: string; isOnSite: boolean }>();
  const known = answer?.src === src ? answer : undefined;

  if (known?.isOnSite) {
    return children;
  }
  if (known) {
    return null;
  }
  return (
    // eslint-disable-next-line jsx-a11y/media-has-caption -- never shown or heard: it only asks the site whether the film is there
    <video
      key={src}
      src={src}
      preload="metadata"
      muted
      aria-hidden="true"
      tabIndex={-1}
      hidden
      onLoadedMetadata={() => setAnswer({ src, isOnSite: true })}
      onError={() => setAnswer({ src, isOnSite: false })}
    />
  );
}
