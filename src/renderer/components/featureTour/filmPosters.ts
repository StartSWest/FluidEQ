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
import walkthrough from './filmPosters/walkthrough.jpg';

/**
 * A frame of each film, bundled with the app, by film id: what a film's
 * frame shows before the site has sent a single picture — on the What's New
 * slide while it loads, and in Help until play is pressed.
 */
const FILM_POSTERS: Readonly<Record<string, string>> = {
  'compact-player': compactPlayer,
  'custom-looks': customLooks,
  'de-esser': deEsser,
  'delete-import': deleteImport,
  dsp,
  'each-ear': eachEar,
  'engine-sound': engineSound,
  'every-output': everyOutput,
  'fluideq-engine': fluideqEngine,
  'game-presets': gamePresets,
  'headphone-presets': headphonePresets,
  karaoke,
  'karaoke-maker': karaokeMaker,
  library,
  walkthrough,
};

export default FILM_POSTERS;
