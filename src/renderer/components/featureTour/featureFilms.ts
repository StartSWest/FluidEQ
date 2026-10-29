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
  /**
   * The languages its voice was recorded in, when they are fewer than every
   * film's: a film recorded in English alone must not ask the site for a
   * Spanish file nobody made.
   */
  locales?: readonly LocaleCode[];
  /**
   * Its lines' timings come from the site, beside the film
   * (`featureFilmTimingUrl`), and `cues` are what plays until they arrive or
   * if they never do. For a film recorded after the build that shows it: the
   * walkthrough shipped before its recording was finished (Ivan, 2026-10-29:
   * "upload the video later and the app should be able to pick up"), and two
   * recordings of the same tour timed its lines up to a second apart.
   */
  timedOnSite?: boolean;
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
  // The whole app, on What's New's first page (`WalkthroughSlide`), voiced in
  // English alone so far; every language reads its lines as subtitles.
  walkthrough: {
    width: 1920,
    height: 1080,
    locales: ['en'],
    timedOnSite: true,
    cues: [
      { key: 'tour.film.walkthrough.intro', from: 0.5, to: 8.7 },
      { key: 'tour.film.walkthrough.graph', from: 8.7, to: 18.63 },
      { key: 'tour.film.walkthrough.sliders', from: 18.63, to: 29 },
      { key: 'tour.film.walkthrough.tone', from: 29, to: 39.23 },
      { key: 'tour.film.walkthrough.ears', from: 39.23, to: 53.3 },
      { key: 'tour.film.walkthrough.eqmode', from: 53.3, to: 62.63 },
      { key: 'tour.film.walkthrough.headphones', from: 62.63, to: 78.23 },
      { key: 'tour.film.walkthrough.mycurves', from: 78.23, to: 88.6 },
      { key: 'tour.film.walkthrough.outputs', from: 88.6, to: 105.67 },
      { key: 'tour.film.walkthrough.songs', from: 105.67, to: 113.63 },
      { key: 'tour.film.walkthrough.games', from: 113.63, to: 131.9 },
      { key: 'tour.film.walkthrough.dsp', from: 131.9, to: 142.57 },
      { key: 'tour.film.walkthrough.deesser', from: 142.57, to: 149.87 },
      { key: 'tour.film.walkthrough.character', from: 149.87, to: 159.73 },
      { key: 'tour.film.walkthrough.room', from: 159.73, to: 166.17 },
      { key: 'tour.film.walkthrough.maximizer', from: 166.17, to: 173.5 },
      { key: 'tour.film.walkthrough.library', from: 173.5, to: 185.23 },
      { key: 'tour.film.walkthrough.compact', from: 185.23, to: 200.73 },
      { key: 'tour.film.walkthrough.oneline', from: 200.73, to: 229.13 },
      { key: 'tour.film.walkthrough.looks', from: 229.13, to: 251.17 },
      { key: 'tour.film.walkthrough.gallery', from: 251.17, to: 264.77 },
      { key: 'tour.film.walkthrough.studio', from: 264.77, to: 278.53 },
      { key: 'tour.film.walkthrough.karaoke', from: 278.53, to: 286.87 },
      { key: 'tour.film.walkthrough.share', from: 286.87, to: 300.03 },
      { key: 'tour.film.walkthrough.help', from: 300.03, to: 309.8 },
      { key: 'tour.film.walkthrough.outro', from: 309.8, to: 317.2 },
    ],
  },
};

/** The language a film's voice is heard in: the reader's, or English. */
export const featureFilmLocale = (
  locale: LocaleCode,
  film?: IFeatureFilm,
): LocaleCode =>
  (film?.locales ?? FILM_LOCALES).includes(locale) ? locale : 'en';

export const featureFilmUrl = (id: string, locale: LocaleCode) =>
  `${OFFICIAL_SITE_URL}/video/whatsnew/${id}.${featureFilmLocale(locale, FEATURE_FILMS[id])}.mp4`;

/**
 * Where a film timed on the site keeps its timings: WebVTT beside the film,
 * one cue per line, each cue's id the line's key. Served from the same
 * folder, so the same cross-origin grant that lets the window read the film
 * lets it read these.
 */
export const featureFilmTimingUrl = (id: string, locale: LocaleCode) =>
  `${OFFICIAL_SITE_URL}/video/whatsnew/${id}.${featureFilmLocale(locale, FEATURE_FILMS[id])}.cues.vtt`;

/** What a timing track's cue offers, as the browser's `TextTrackCue` does. */
interface ITimedCue {
  id: string;
  startTime: number;
  endTime: number;
}

/**
 * The lines a film's timing track times, in the order they are said. Only
 * lines the film already has: the site can move a line, never put up one the
 * app does not know. Nothing usable, and the film keeps its own timings.
 */
export const siteCues = (
  film: IFeatureFilm,
  track: ArrayLike<ITimedCue> | null | undefined,
): readonly IFilmCue[] | undefined => {
  const lines = new Map<string, TranslationKey>(
    film.cues.map((cue) => [cue.key, cue.key]),
  );
  const timed = Array.from(track ?? []).flatMap((cue) => {
    const key = lines.get(cue.id);
    return key && cue.endTime > cue.startTime
      ? [{ key, from: cue.startTime, to: cue.endTime }]
      : [];
  });
  return timed.length > 0
    ? timed.sort((one, other) => one.from - other.from)
    : undefined;
};

/** The line being said at `seconds` into a film, if any. */
export const filmCueAt = (
  cues: readonly IFilmCue[],
  seconds: number,
): IFilmCue | undefined =>
  cues.find((cue) => seconds >= cue.from && seconds < cue.to);
