/*
<AQUA: System-wide parametric audio equalizer interface>
Copyright (C) <2023>  <AQUA Dev Team>

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
 * On unless told otherwise.
 *
 * Somebody who opens a video inside an equalizer is there to listen to
 * something, and the first thing they meet should not be an advertisement. The
 * switch is in plain sight for anyone who would rather leave them in.
 */
export const VIDEO_AD_BLOCK_DEFAULT = true;

/** Where the window remembers the switch between runs. */
export const VIDEO_AD_BLOCK_STORAGE_KEY = 'fluideq.videoAdBlock';
