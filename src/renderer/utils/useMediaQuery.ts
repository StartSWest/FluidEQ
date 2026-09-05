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

import { useEffect, useState } from 'react';

/**
 * Whether a media query matches, followed as the window changes.
 *
 * Measured rather than styled where the answer changes what is *rendered*
 * rather than how it looks: a control that has to move into a menu cannot be
 * drawn in both places and hidden with CSS, because two copies of a fader or
 * a seek line are two things a screen reader offers and only one of them is
 * real.
 *
 * Guarded the way `KaraokeWorkspace` and `KaraokeLyrics` guard their own
 * calls: jsdom has no `matchMedia`, and a stub for it in the shared test
 * setup is not a free thing to add — one answering `matches: false` where
 * there had been nothing flipped Karaoke onto a different branch and took its
 * pitch lane off the stage.
 */
// eslint-disable-next-line import/prefer-default-export -- a hook, not a
// component; the other files in this directory export the same way.
const useMediaQuery = (query: string): boolean => {
  const [matches, setMatches] = useState(false);
  useEffect(() => {
    if (typeof window.matchMedia !== 'function') {
      return undefined;
    }
    const media = window.matchMedia(query);
    const apply = () => setMatches(media.matches);
    apply();
    media.addEventListener('change', apply);
    return () => media.removeEventListener('change', apply);
  }, [query]);
  return matches;
};

export default useMediaQuery;
