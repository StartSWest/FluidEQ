/* Copyright (C) 2026 Ivan Carmenates Garcia. SPDX-License-Identifier: GPL-3.0-or-later */

import { OFFICIAL_SITE_URL } from '../../../common/branding';
import type { LocaleCode, TranslationKey } from '../../../common/i18n';

/**
 * The short films What's New plays in place of a slide's drawing: the real
 * app, recorded once by the video kit's film rig (`.claude/video-kit/films`),
 * with a voice saying what the feature is and how to use it (Ivan,
 * 2026-10-15: "same videos but with voice", GPT-Live through his own
 * ChatGPT plan). The picture is the same in every language; each language
 * has its own voice, so its own file, and the line being said is shown under
 * the picture as a subtitle, from the same dictionary the voice read
 * (`narration/lines.cjs` in the kit writes both).
 *
 * A slide with no film here fetches nothing and keeps its drawing. The films
 * stream from FluidEQ's own site, with no cookie and nothing about the
 * reader (`terms.elsewhere.p10`).
 */

/** One line of the voice: what it says, and from when to when (seconds). */
export interface IFilmCue {
  key: TranslationKey;
  from: number;
  to: number;
}

export interface IFeatureFilm {
  /** The film's own pixels, so its box has its shape before it loads. */
  width: number;
  height: number;
  cues: readonly IFilmCue[];
}

/**
 * Voices are published independently of interface dictionaries. A new UI
 * locale must not create a URL for a film nobody recorded. Until Korean and
 * Traditional Chinese films are supplied, use the existing English film
 * with translated on-screen captions; its opener states the audio language.
 */
const FILM_LOCALES: readonly LocaleCode[] = [
  'en',
  'es',
  'pt',
  'fr',
  'de',
  'it',
  'ru',
  'zh',
  'ja',
  'hi',
];

export const featureFilmLocale = (locale: LocaleCode): LocaleCode =>
  FILM_LOCALES.includes(locale) ? locale : 'en';

export const featureFilmUrl = (id: string, locale: LocaleCode) =>
  `${OFFICIAL_SITE_URL}/video/whatsnew/${id}.${featureFilmLocale(locale)}.mp4`;

/**
 * Lines as the rig timed them (`<film>.cues.json`), keyed by the film's id,
 * which is also the id of the What's New slide it plays on, if it has one.
 */
export const FEATURE_FILMS: Readonly<Record<string, IFeatureFilm>> = {
  'compact-player': {
    width: 960,
    height: 1520,
    cues: [
      { key: 'tour.film.compact.intro', from: 0.5, to: 6.13 },
      { key: 'tour.film.compact.go', from: 6.13, to: 11.63 },
      { key: 'tour.film.compact.eq', from: 11.63, to: 17.17 },
      { key: 'tour.film.compact.back', from: 17.17, to: 21.8 },
    ],
  },
  'custom-looks': {
    width: 1520,
    height: 1280,
    cues: [
      { key: 'tour.film.looks.intro', from: 0.5, to: 5.63 },
      { key: 'tour.film.looks.open', from: 5.63, to: 10.33 },
      { key: 'tour.film.looks.forms', from: 10.33, to: 18.87 },
      { key: 'tour.film.looks.shape', from: 18.87, to: 27.2 },
      { key: 'tour.film.looks.save', from: 27.2, to: 34.5 },
    ],
  },
  'de-esser': {
    width: 1600,
    height: 1156,
    cues: [
      { key: 'tour.film.deesser.intro', from: 0.5, to: 6.5 },
      { key: 'tour.film.deesser.cuts', from: 6.5, to: 16.1 },
      { key: 'tour.film.deesser.isolate', from: 16.1, to: 22.73 },
    ],
  },
  'delete-import': {
    width: 840,
    height: 1080,
    cues: [
      { key: 'tour.film.deleteImport.intro', from: 0.5, to: 4.47 },
      { key: 'tour.film.deleteImport.asks', from: 4.47, to: 16.3 },
      { key: 'tour.film.deleteImport.oneEar', from: 16.3, to: 26.73 },
      { key: 'tour.film.deleteImport.otherEar', from: 26.73, to: 33.6 },
    ],
  },
  dsp: {
    width: 1200,
    height: 1200,
    cues: [
      { key: 'tour.film.dsp.intro', from: 0.5, to: 6.83 },
      { key: 'tour.film.dsp.preset', from: 6.83, to: 12 },
      { key: 'tour.film.dsp.stages', from: 12, to: 24.1 },
      { key: 'tour.film.dsp.meters', from: 24.1, to: 30.5 },
    ],
  },
  'each-ear': {
    width: 760,
    height: 1200,
    cues: [
      { key: 'tour.film.eachEar.intro', from: 0.5, to: 6.37 },
      { key: 'tour.film.eachEar.menu', from: 6.37, to: 10.83 },
      { key: 'tour.film.eachEar.split', from: 10.83, to: 18 },
      { key: 'tour.film.eachEar.lines', from: 18, to: 25.53 },
      { key: 'tour.film.eachEar.sliders', from: 25.53, to: 31.37 },
      { key: 'tour.film.eachEar.join', from: 31.37, to: 39.37 },
    ],
  },
  'engine-sound': {
    width: 840,
    height: 1080,
    cues: [
      { key: 'tour.film.sound.intro', from: 0.5, to: 6.07 },
      { key: 'tour.film.sound.glide', from: 6.07, to: 17.33 },
      { key: 'tour.film.sound.precise', from: 17.33, to: 28.33 },
      { key: 'tour.film.sound.classic', from: 28.33, to: 35.27 },
    ],
  },
  'every-output': {
    width: 920,
    height: 1200,
    cues: [
      { key: 'tour.film.outputs.intro', from: 0.5, to: 7.77 },
      { key: 'tour.film.outputs.each', from: 7.77, to: 16.53 },
      { key: 'tour.film.outputs.back', from: 16.53, to: 23.77 },
      { key: 'tour.film.outputs.second', from: 23.77, to: 29.37 },
      { key: 'tour.film.outputs.edit', from: 29.37, to: 39.53 },
    ],
  },
  'fluideq-engine': {
    width: 1920,
    height: 1200,
    cues: [
      { key: 'tour.film.engine.intro', from: 0.5, to: 10.23 },
      { key: 'tour.film.engine.choose', from: 10.23, to: 19.07 },
      { key: 'tour.film.engine.rack', from: 19.07, to: 28.1 },
    ],
  },
  'game-presets': {
    width: 1120,
    height: 760,
    cues: [
      { key: 'tour.film.games.intro', from: 0.5, to: 5.63 },
      { key: 'tour.film.games.add', from: 5.63, to: 11.07 },
      { key: 'tour.film.games.sound', from: 11.07, to: 17.57 },
      { key: 'tour.film.games.front', from: 17.57, to: 22.4 },
      { key: 'tour.film.games.closed', from: 22.4, to: 27.47 },
    ],
  },
  'headphone-presets': {
    width: 1624,
    height: 1080,
    cues: [
      { key: 'tour.film.headphones.intro', from: 0.5, to: 6.3 },
      { key: 'tour.film.headphones.search', from: 6.3, to: 11.93 },
      { key: 'tour.film.headphones.measure', from: 11.93, to: 18.67 },
      { key: 'tour.film.headphones.applied', from: 18.67, to: 26.27 },
      { key: 'tour.film.headphones.paste', from: 26.27, to: 30.1 },
      { key: 'tour.film.headphones.ears', from: 30.1, to: 35.3 },
      { key: 'tour.film.headphones.curve', from: 35.3, to: 39.53 },
    ],
  },
  karaoke: {
    width: 1760,
    height: 1280,
    cues: [
      { key: 'tour.film.karaoke.intro', from: 0.5, to: 6.07 },
      { key: 'tour.film.karaoke.open', from: 6.07, to: 12.07 },
      { key: 'tour.film.karaoke.words', from: 12.07, to: 17.33 },
      { key: 'tour.film.karaoke.pitch', from: 17.33, to: 27.07 },
    ],
  },
  'karaoke-maker': {
    width: 1760,
    height: 1280,
    cues: [
      { key: 'tour.film.maker.intro', from: 0.5, to: 5.5 },
      { key: 'tour.film.maker.timeline', from: 5.5, to: 12.37 },
      { key: 'tour.film.maker.play', from: 12.37, to: 22 },
      { key: 'tour.film.maker.use', from: 22, to: 32.13 },
    ],
  },
  library: {
    width: 1520,
    height: 1120,
    cues: [
      { key: 'tour.film.library.intro', from: 0.5, to: 6.1 },
      { key: 'tour.film.library.albums', from: 6.1, to: 13.5 },
      { key: 'tour.film.library.album', from: 13.5, to: 17.93 },
      { key: 'tour.film.library.play', from: 17.93, to: 26.63 },
    ],
  },
};

/** The line being said at `seconds` into a film, if any. */
export const filmCueAt = (
  cues: readonly IFilmCue[],
  seconds: number,
): IFilmCue | undefined =>
  cues.find((cue) => seconds >= cue.from && seconds < cue.to);
