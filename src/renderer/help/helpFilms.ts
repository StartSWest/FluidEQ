/* Copyright (C) 2026 Ivan Carmenates Garcia. SPDX-License-Identifier: GPL-3.0-or-later */

/**
 * What's New's films, under the Help topic each one shows, by topic id
 * (`helpChapters`), drawn after the topic's captures: the pictures first,
 * then the film, so a film the site cannot send leaves the topic whole
 * (Ivan, 2026-10-17). A topic with none has its captures alone; each film
 * stands as its bundled poster (`FILM_POSTERS`) until play is pressed, so
 * nothing is fetched before that.
 */
const HELP_FILMS: Readonly<Record<string, readonly string[]>> = {
  eq: ['each-ear', 'delete-import'],
  eqmode: ['engine-sound'],
  games: ['game-presets'],
  headphones: ['headphone-presets'],
  profiles: ['every-output'],
  engine: ['fluideq-engine'],
  looks: ['custom-looks'],
  dsp: ['dsp', 'de-esser'],
  library: ['library'],
  karaoke: ['karaoke'],
  maker: ['karaoke-maker'],
};

/**
 * Films that play nowhere until they are recorded again, because they show
 * something the app no longer has. Their files, captions and posters stay
 * where they are, so a new take replaces the old one and comes back here.
 *
 * - `compact-player` shows the two players 2.1 made one (Ivan, 2026-10-26:
 *   out of What's New and Help until it is recorded again).
 */
export const FILMS_AWAY: readonly string[] = ['compact-player'];

export default HELP_FILMS;
