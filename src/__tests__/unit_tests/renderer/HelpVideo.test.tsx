/* Copyright (C) 2026 Ivan Carmenates Garcia. SPDX-License-Identifier: GPL-3.0-or-later */

import '@testing-library/jest-dom';
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
} from '@testing-library/react';
import { HELP_CHAPTERS } from 'common/helpGuide';
import { loadLocale, translate } from 'common/i18n';
import HelpChapter from 'renderer/help/HelpChapter';
import HelpFilm from 'renderer/help/HelpFilm';
import HELP_FILMS from 'renderer/help/helpFilms';
import { I18nProvider } from 'renderer/utils/I18nContext';
import {
  FEATURE_FILMS,
  featureFilmUrl,
  filmCueAt,
} from 'renderer/components/featureTour/featureFilms';
import en from 'common/i18n/en';

let frames: FrameRequestCallback[] = [];
beforeAll(() =>
  Promise.all(['es', 'ja'].map((locale) => loadLocale(locale as 'es' | 'ja'))),
);
beforeEach(() => {
  frames = [];
  jest
    .spyOn(window, 'requestAnimationFrame')
    .mockImplementation((callback) => frames.push(callback));
  jest
    .spyOn(window, 'cancelAnimationFrame')
    .mockImplementation(() => undefined);
});
afterEach(() => {
  cleanup();
  jest.restoreAllMocks();
  window.localStorage.clear();
});
const paint = () =>
  act(() => {
    const waiting = frames;
    frames = [];
    waiting.forEach((callback) => callback(performance.now()));
  });
const playTo = (video: HTMLVideoElement, seconds: number) => {
  video.currentTime = seconds;
  paint();
};
const openFilm = () => {
  const { container } = render(<HelpFilm id="walkthrough" />);
  fireEvent.click(screen.getByRole('button'));
  const video = container.querySelector('video');
  if (!video) {
    throw new Error('Help did not mount its film');
  }
  return {
    container,
    video,
    subtitle: () => container.querySelector('figcaption'),
  };
};
const trackOf = (video: HTMLVideoElement) => {
  const track = video.querySelector('track');
  if (!track) {
    throw new Error('Help did not mount a timing or caption track');
  }
  return track;
};

it('places one walkthrough in the first chapter, with no old tutorial card beside it', () => {
  const topic = HELP_CHAPTERS.find((chapter) => chapter.id === 'start');
  if (!topic) {
    throw new Error('Help has no first chapter');
  }
  expect(HELP_FILMS.start).toEqual(['walkthrough']);
  const { container } = render(
    <HelpChapter
      chapter={{
        ...topic,
        number: 1,
        title: en['help.start.title'],
        intro: en['help.start.intro'],
        steps: ['Try it'],
        tip: en['help.start.tip'],
      }}
      onEnlarge={() => undefined}
    />,
  );
  expect(container.querySelectorAll('[data-film="walkthrough"]')).toHaveLength(
    1,
  );
  expect(container.querySelector('.help-video')).toBeNull();
});

it('keeps a bundled poster and fetches neither film nor track before Play', () => {
  const { container } = render(<HelpFilm id="walkthrough" />);
  expect(container.querySelector('video')).toBeNull();
  expect(container.querySelector('track')).toBeNull();
  expect(container.querySelector('img')?.getAttribute('src')).not.toMatch(
    /^https?:/,
  );
  fireEvent.click(screen.getByRole('button'));
  const video = container.querySelector('video');
  expect(video).toHaveAttribute('src', featureFilmUrl('walkthrough', 'en'));
  expect(video).toHaveAttribute('controls');
  expect(video).toHaveAttribute('crossorigin', 'anonymous');
  expect(video?.querySelector('track')).toHaveAttribute(
    'src',
    'https://fluideq.com/video/whatsnew/walkthrough.en.vtt',
  );
});

/** The caption track saying `text`, as the browser does when a cue starts. */
const say = (track: HTMLTrackElement, text: string) => {
  Object.defineProperty(track, 'track', {
    configurable: true,
    value: { activeCues: [{ text }] },
  });
  fireEvent(track, new Event('cuechange'));
};

it('says the site’s words under the walkthrough, never a line of its own', () => {
  const { video, subtitle } = openFilm();
  fireEvent.playing(video);
  const [name] = FEATURE_FILMS.walkthrough.cues;
  expect(filmCueAt(FEATURE_FILMS.walkthrough.cues, name.from)).toBe(name);
  playTo(video, (name.from + name.to) / 2);
  // Until the site says something the line holds the film's name, as it did
  // before Play: its one cue is never said as a line.
  expect(subtitle()).toHaveTextContent(en['tour.walkthrough.title']);
  say(trackOf(video), 'Whatever the take on the site says');
  expect(subtitle()).toHaveTextContent('Whatever the take on the site says');
  expect(subtitle()).not.toHaveTextContent(en['tour.walkthrough.title']);
});

it('plays the old tutorial with its own captions if the walkthrough is unavailable, then offers a fresh retry if both fail', () => {
  const { video, subtitle, container } = openFilm();
  fireEvent.playing(video);
  say(trackOf(video), 'The walkthrough’s own line');
  expect(subtitle()).toHaveTextContent('The walkthrough’s own line');
  fireEvent.error(video);
  expect(video).toHaveAttribute(
    'src',
    'https://fluideq.com/video/first-steps.mp4',
  );
  const track = trackOf(video);
  expect(track).toHaveAttribute('kind', 'captions');
  expect(track).toHaveAttribute(
    'src',
    'https://fluideq.com/video/first-steps.en.vtt',
  );
  say(track, 'The tutorial’s own line');
  expect(subtitle()).toHaveTextContent('The tutorial’s own line');
  expect(subtitle()).not.toHaveTextContent('The walkthrough’s own line');
  fireEvent.error(video);
  expect(screen.getByRole('status')).toHaveTextContent(en['help.video.failed']);
  fireEvent.click(screen.getByRole('button', { name: en['help.video.retry'] }));
  expect(container.querySelector('video')).not.toBe(video);
  expect(container.querySelector('video')).toHaveAttribute(
    'src',
    featureFilmUrl('walkthrough', 'en'),
  );
  expect(container.querySelector('track')).toHaveAttribute(
    'src',
    'https://fluideq.com/video/whatsnew/walkthrough.en.vtt',
  );
});

it.each(['es', 'ja'] as const)(
  'discloses English audio in %s before Play and keeps the note under the playing film',
  (locale) => {
    window.localStorage.setItem('fluideq.locale', locale);
    const { container } = render(
      <I18nProvider>
        <HelpFilm id="walkthrough" />
      </I18nProvider>,
    );
    const note = translate(locale, 'tour.film.englishAudio');
    expect(screen.getByRole('button')).toHaveAccessibleName(
      expect.stringContaining(note),
    );
    expect(screen.getByRole('button')).toHaveTextContent(note);
    fireEvent.click(screen.getByRole('button'));
    const video = container.querySelector('video');
    expect(video).toHaveAttribute('src', featureFilmUrl('walkthrough', 'en'));
    expect(container.querySelector('figcaption')).toHaveTextContent(note);
  },
);
