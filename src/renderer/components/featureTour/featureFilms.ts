/* Copyright (C) 2026 Ivan Carmenates Garcia. SPDX-License-Identifier: GPL-3.0-or-later */

import { OFFICIAL_SITE_URL } from '../../../common/branding';
import type { LocaleCode, TranslationKey } from '../../../common/i18n';
import overviewEnglish from './films/gaming-lab-overview.en.mp4';
import overviewSpanish from './films/gaming-lab-overview.es.mp4';
import overviewEnglishCaptions from './films/gaming-lab-overview.en.vtt';
import overviewSpanishCaptions from './films/gaming-lab-overview.es.vtt';

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
   * Its subtitles are the site's, word for word (`featureFilmCaptionUrls`),
   * and `cues` names the film and is never drawn. For a film that can be
   * recorded again after the build that shows it: a new take put up at the
   * same link brings its own words with it, where lines kept in the app
   * would name what the old take said (2.5, Ivan: the published versions
   * must "carguen el nuevo video ... el mismo enlace").
   */
  spokenCaptions?: boolean;
  /** Offline Help recordings are shipped with the renderer, one per voice. */
  bundled?: Partial<Record<LocaleCode, { src: string; captions: string }>>;
  /**
   * What plays in its place while the film itself is not on the site, with
   * its own captions (WebVTT, English) drawn on the picture and none of the
   * film's lines under it. The walkthrough shipped before its recording was
   * finished, and the first-steps tutorial Help already streams stands in
   * until it is uploaded (Ivan, 2026-10-29: "put the old walkthrough in the
   * app", "saying the video can't play").
   */
  standIn?: { src: string; captions: string };
}

/**
 * Voices are published independently of interface dictionaries. A new UI
 * locale must not create a URL for a film nobody recorded. Until Korean and
 * Traditional Chinese films are supplied, use the existing English film
 * with translated on-screen captions; its opener states the audio language.
 */
/** The Visualizers' own What's New film: Library to Studio, in one take. */
export const VISUALS_FILM = 'visuals';

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
  // The Gaming Lab (2026-11-04). Not `game-presets`: that name still plays,
  // from the site, in every app that bundles its five old captions.
  'gaming-lab': {
    width: 1920,
    height: 1200,
    cues: [
      { key: 'tour.film.games.intro', from: 0.5, to: 7.8 },
      { key: 'tour.film.games.add', from: 7.8, to: 17.73 },
      { key: 'tour.film.games.profile', from: 17.73, to: 24.53 },
      { key: 'tour.film.games.try', from: 24.53, to: 31.77 },
      { key: 'tour.film.games.tune', from: 31.77, to: 43.83 },
      { key: 'tour.film.games.presets', from: 43.83, to: 51.17 },
      { key: 'tour.film.games.save', from: 51.17, to: 60.3 },
      { key: 'tour.film.games.front', from: 60.3, to: 64.87 },
      { key: 'tour.film.games.eqPage', from: 64.87, to: 70 },
      { key: 'tour.film.games.closed', from: 70, to: 74.67 },
    ],
  },
  // A new name preserves the older recording and its bundled captions in
  // released apps. This overview has its own English and Spanish narration.
  'gaming-lab-overview': {
    width: 1920,
    height: 1080,
    locales: ['en', 'es'],
    spokenCaptions: true,
    bundled: {
      en: {
        src: overviewEnglish,
        captions: `data:text/vtt;charset=utf-8,${encodeURIComponent(overviewEnglishCaptions)}`,
      },
      es: {
        src: overviewSpanish,
        captions: `data:text/vtt;charset=utf-8,${encodeURIComponent(overviewSpanishCaptions)}`,
      },
    },
    cues: [{ key: 'tour.film.games.intro', from: 0, to: 58.2 }],
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
  // The whole app, on What's New's first page (`WalkthroughSlide`) and Help's
  // first chapter, voiced in English alone so far. Recorded again for every
  // release at the same link, so its subtitles are the site's: the reader's
  // language when the site has it (`walkthrough.<locale>.vtt`), else the
  // English. Its one cue is its name, Help's title and the player's label.
  walkthrough: {
    width: 1920,
    height: 1080,
    locales: ['en'],
    spokenCaptions: true,
    standIn: {
      src: `${OFFICIAL_SITE_URL}/video/first-steps.mp4`,
      captions: `${OFFICIAL_SITE_URL}/video/first-steps.en.vtt`,
    },
    cues: [{ key: 'tour.film.walkthrough.intro', from: 0, to: 1 }],
  },
  // Everything visual in one film, behind the Watch key of the Visualizers'
  // own What's New (`VisualsFilmSection`; Ivan, 2026-11-12: "we will put in
  // the whats new"). Recorded after 2.5 was built, so nothing about it is in
  // the app but its name: its subtitles are the site's, word for word
  // (`featureFilmCaptionUrls`), and until it is uploaded a press on Watch
  // says it is coming (`tour.v25.film.soon`). Its one cue names the larger
  // view for a screen reader; no line of it is drawn from the app.
  [VISUALS_FILM]: {
    width: 1920,
    height: 1080,
    locales: ['en'],
    spokenCaptions: true,
    // Never drawn (its subtitles are the site's); it names the film for the
    // catalogue and a screen reader, so it spans the film's first second.
    cues: [{ key: 'tour.film.visuals.intro', from: 0, to: 1 }],
  },
};

/** The language a film's voice is heard in: the reader's, or English. */
export const featureFilmLocale = (
  locale: LocaleCode,
  film?: IFeatureFilm,
): LocaleCode =>
  (film?.locales ?? FILM_LOCALES).includes(locale) ? locale : 'en';

export const featureFilmUrl = (id: string, locale: LocaleCode) => {
  const voice = featureFilmLocale(locale, FEATURE_FILMS[id]);
  return (
    FEATURE_FILMS[id]?.bundled?.[voice]?.src ??
    `${OFFICIAL_SITE_URL}/video/whatsnew/${id}.${voice}.mp4`
  );
};

/** Verbatim subtitles follow the selected voice, including its English fallback. */
export const featureFilmCaptionUrl = (id: string, locale: LocaleCode) => {
  const voice = featureFilmLocale(locale, FEATURE_FILMS[id]);
  return (
    FEATURE_FILMS[id]?.bundled?.[voice]?.captions ??
    `${OFFICIAL_SITE_URL}/video/whatsnew/${id}.${voice}.vtt`
  );
};

/**
 * Where a film's verbatim subtitles may be, in the order to try them. A film
 * streamed from the site asks first for the reader's own language, which can
 * be put up beside the film at any time without a release, and then for its
 * voice's; a bundled film keeps to its bundled captions, so Help's offline
 * films never reach for the site.
 */
export const featureFilmCaptionUrls = (
  id: string,
  locale: LocaleCode,
): readonly string[] => {
  const film = FEATURE_FILMS[id];
  const voiced = featureFilmCaptionUrl(id, locale);
  if (film?.bundled?.[featureFilmLocale(locale, film)]) {
    return [voiced];
  }
  const own = `${OFFICIAL_SITE_URL}/video/whatsnew/${id}.${locale}.vtt`;
  return own === voiced ? [voiced] : [own, voiced];
};

/** The line being said at `seconds` into a film, if any. */
export const filmCueAt = (
  cues: readonly IFilmCue[],
  seconds: number,
): IFilmCue | undefined =>
  cues.find((cue) => seconds >= cue.from && seconds < cue.to);
