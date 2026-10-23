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
  player: ['compact-player'],
  engine: ['fluideq-engine'],
  looks: ['custom-looks'],
  dsp: ['dsp', 'de-esser'],
  library: ['library'],
  karaoke: ['karaoke'],
  maker: ['karaoke-maker'],
};

export default HELP_FILMS;
