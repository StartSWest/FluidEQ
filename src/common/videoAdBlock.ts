/*
<AQUA: System-wide parametric audio equalizer interface>
Copyright (C) <2023>  <AQUA Dev Team>
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
 * The link between the ad blocker and the switch that controls it.
 *
 * The blocker itself runs inside the player's own renderer, which is a
 * different process from the window the switch lives in, so the flag travels:
 * window → main → every attached player. These are the two channels it travels
 * on, named here so both ends import the same strings.
 *
 * Deliberately not in `ChannelEnum`: that enum is the API the app's renderer is
 * given, and these belong to a preload the page can never reach.
 */

/** Asked by a player as it loads, so it starts in the right state. */
export const VIDEO_AD_BLOCK_REQUEST = 'fluideq-video-ad-block-request';

/** Pushed to every player when the switch moves. */
export const VIDEO_AD_BLOCK_CHANGED = 'fluideq-video-ad-block-changed';

/**
 * Off until somebody turns it on.
 *
 * Blocking an advertisement is the user's decision to make about their own
 * machine, and it stays theirs only while the app is not making it for them.
 * A switch that arrives on has already decided; a switch that arrives off and
 * is turned on has not. That distinction is the whole defence of the feature,
 * so it is worth the extra click — once.
 */
export const VIDEO_AD_BLOCK_DEFAULT = false;

/** Where the window remembers the switch between runs. */
export const VIDEO_AD_BLOCK_STORAGE_KEY = 'fluideq.videoAdBlock';

/**
 * Where the window remembers whether the switch is on show.
 *
 * The control is not in the interface until somebody asks for it by pressing
 * the chord below, and the same chord puts it away again. Two things follow
 * from that, and both are the point:
 *
 *  - A fresh install has no ad blocker in it. Not one that is off — one that is
 *    not there, is not offered, and has stripped nothing from anybody's page.
 *  - Turning it on is an act nobody performs by accident. Whatever is said
 *    about the feature afterwards, "the user went looking for this" is simply
 *    true.
 *
 * Out of sight means off, not merely hidden. The renderer will not run the
 * blocker for a switch that is not on screen, so putting it away is enough to
 * stop it — and the switch's own position survives for when it comes back.
 */
export const VIDEO_AD_BLOCK_REVEAL_STORAGE_KEY = 'fluideq.videoAdBlockRevealed';

/**
 * The chord that puts the switch on screen: Ctrl+Shift+Alt+B.
 *
 * Alt is in there because nothing else in the app uses it — Euphoria's Ctrl+E
 * and the graph's shortcuts all step aside when it is held — so this can never
 * be half of somebody else's shortcut.
 *
 * Takes the fields rather than the event, so the rule can be read and tested
 * without a DOM.
 */
export const isAdBlockRevealChord = (event: {
  code: string;
  ctrlKey: boolean;
  shiftKey: boolean;
  altKey: boolean;
}): boolean =>
  event.code === 'KeyB' && event.ctrlKey && event.shiftKey && event.altKey;
