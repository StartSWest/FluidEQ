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

/**
 * A mark for each site button, so the row can be read at a glance.
 *
 * Six words in the same weight and colour is a list to be read; six shapes is a
 * row to be recognised, and the difference matters most for the person who uses
 * one of them every day and never looks at the other five.
 *
 * Drawn here as geometry rather than fetched or embedded as artwork. Three
 * reasons, in order of how much they bite:
 *
 *  - Nothing may load from the network. Reaching out to a favicon service would
 *    tell a third party which sites this app shows and when it was opened.
 *  - A brand's own logo file is licensed artwork. These are simplified marks —
 *    a play triangle, a cloud, a glitch bubble — used to identify the service
 *    the button goes to, which is what a browser's own site list does.
 *  - They tint. Every one uses `currentColor`, so a pill inherits the same
 *    hover and active colours as its label instead of carrying a fixed-colour
 *    image that looks wrong in one state or the other.
 *
 * `fillRule="evenodd"` throughout: the counters — the play triangles, Twitch's
 * two bars — are holes punched in one path, so they show the pill behind rather
 * than being painted in a background colour that would be wrong the moment the
 * pill changed state.
 */

/**
 * One entry per site, as its list of subpaths.
 *
 * A list rather than one long string so each shape — the screen, the triangle
 * cut out of it — stays on its own line and can be read and adjusted. They are
 * joined into a single `d`, because the counters only work as holes if they
 * belong to the same path as the shape they are punched through.
 */
const PATHS: Record<string, string[]> = {
  // Rounded screen with the play triangle knocked out of it.
  youtube: [
    'M3.4 3h9.2A2.4 2.4 0 0 1 15 5.4v5.2a2.4 2.4 0 0 1-2.4 2.4H3.4A2.4 2.4 0 0 1 1 10.6V5.4A2.4 2.4 0 0 1 3.4 3Z',
    'M6.6 5.9v4.2L10.6 8Z',
  ],
  // The same triangle, in the circle the music app uses instead.
  'youtube-music': [
    'M8 1.4a6.6 6.6 0 1 1 0 13.2A6.6 6.6 0 0 1 8 1.4Z',
    'M6.6 5.2v5.6L11 8Z',
  ],
  // The slanted quadrilateral of the wordmark's badge.
  bandcamp: ['M1.2 4.1h13.6l-4 7.8H1.2Z'],
  // The glitch bubble, with its two bars as counters.
  twitch: [
    'M3.1 1H15v7.9l-3.4 3.4H8.9l-2.3 2.3v-2.3H3.1V3.4Z',
    'M6.9 4.2h1.2v3.9H6.9Z',
    'M10.2 4.2h1.2v3.9h-1.2Z',
  ],
};

interface IVideoSiteIconProps {
  siteId: string;
}

const VideoSiteIcon = ({ siteId }: IVideoSiteIconProps) => {
  const subpaths = PATHS[siteId];
  if (!subpaths) {
    // A site added to the list without a mark drawn for it still gets a button;
    // it just has a label and no icon, which is what the buttons were before.
    return null;
  }
  return (
    <svg className="video-browser__site-icon" viewBox="0 0 16 16" aria-hidden>
      <path d={subpaths.join('')} fillRule="evenodd" />
    </svg>
  );
};

export default VideoSiteIcon;
