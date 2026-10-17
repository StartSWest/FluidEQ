/* Copyright (C) 2026 Ivan Carmenates Garcia. SPDX-License-Identifier: GPL-3.0-or-later */

import compactPlayer from './filmPosters/compact-player.jpg';
import customLooks from './filmPosters/custom-looks.jpg';
import deEsser from './filmPosters/de-esser.jpg';
import deleteImport from './filmPosters/delete-import.jpg';
import dsp from './filmPosters/dsp.jpg';
import eachEar from './filmPosters/each-ear.jpg';
import engineSound from './filmPosters/engine-sound.jpg';
import everyOutput from './filmPosters/every-output.jpg';
import fluideqEngine from './filmPosters/fluideq-engine.jpg';
import gamePresets from './filmPosters/game-presets.jpg';
import headphonePresets from './filmPosters/headphone-presets.jpg';
import karaoke from './filmPosters/karaoke.jpg';
import karaokeMaker from './filmPosters/karaoke-maker.jpg';
import library from './filmPosters/library.jpg';

export interface IHelpFilm {
  /** The film's id in `FEATURE_FILMS`. */
  id: string;
  /** A frame of it, bundled with the app (`filmPosters/`). */
  poster: string;
}

/**
 * What's New's films, under the Help topic each one shows, by topic id
 * (`helpChapters`). A topic with none has its captures alone; the posters
 * are frames cut from the films themselves, so nothing is fetched until a
 * reader presses play.
 */
export const HELP_FILMS: Readonly<Record<string, readonly IHelpFilm[]>> = {
  eq: [
    { id: 'each-ear', poster: eachEar },
    { id: 'delete-import', poster: deleteImport },
  ],
  eqmode: [{ id: 'engine-sound', poster: engineSound }],
  games: [{ id: 'game-presets', poster: gamePresets }],
  headphones: [{ id: 'headphone-presets', poster: headphonePresets }],
  profiles: [{ id: 'every-output', poster: everyOutput }],
  player: [{ id: 'compact-player', poster: compactPlayer }],
  engine: [{ id: 'fluideq-engine', poster: fluideqEngine }],
  looks: [{ id: 'custom-looks', poster: customLooks }],
  dsp: [
    { id: 'dsp', poster: dsp },
    { id: 'de-esser', poster: deEsser },
  ],
  library: [{ id: 'library', poster: library }],
  karaoke: [{ id: 'karaoke', poster: karaoke }],
  maker: [{ id: 'karaoke-maker', poster: karaokeMaker }],
};
