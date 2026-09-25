/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * The Studio's made-up music, as far as anything outside it needs to know:
 * its tempo, the shape of its song, and when its big moments come. The
 * signals are built from these in the window (`studioSignals.ts`,
 * `sceneShowcaseRun.ts`), and the look_at_scene tool tells the member's AI
 * the same numbers from main (`lookRequest.ts`), so the words and the music
 * can never disagree.
 */

/** A beat every 60 / this seconds, from the first frame, unless asked for another. */
export const STUDIO_TEST_BPM = 118;

/**
 * The showcase's musical accent (`uMusicAccent`) peaks here, early, so a
 * scene that answers one has been seen answering it before the gallery's
 * picture is taken at the first kick after the warm-up.
 */
export const STUDIO_TEST_ACCENT_AT_S = 0.6;

/**
 * The showcase's song, in beats, over and over: a plain bar, a bar building
 * (`uSong.y` rising to 1), the drop on the next bar's first beat, and a
 * plain bar after it. Two drops come inside the look tool's longest run, so
 * a scene that makes each drop different can be seen doing it.
 */
export const STUDIO_TEST_CYCLE_BEATS = 16;
export const STUDIO_TEST_BUILD_FROM_BEAT = 4;
export const STUDIO_TEST_DROP_BEAT = 8;
