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
  featureFilmTimingUrl,
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
    featureFilmTimingUrl('walkthrough', 'en'),
  );
});

it('uses the recording’s site timings after they load, and bundled timings when they fail', () => {
  const { video, subtitle } = openFilm();
  fireEvent.playing(video);
  const bundled = filmCueAt(FEATURE_FILMS.walkthrough.cues, 50);
  if (!bundled) {
    throw new Error('The recording has no bundled line at 50 seconds');
  }
  playTo(video, 50);
  expect(subtitle()).toHaveTextContent(en[bundled.key]);
  const track = trackOf(video);
  fireEvent.error(track);
  playTo(video, 50);
  expect(subtitle()).toHaveTextContent(en[bundled.key]);
  Object.defineProperty(track, 'track', {
    value: {
      cues: [
        { id: 'tour.film.walkthrough.footsteps', startTime: 49, endTime: 51 },
      ],
    },
  });
  fireEvent.load(track);
  paint();
  expect(subtitle()).toHaveTextContent(en['tour.film.walkthrough.footsteps']);
  expect(subtitle()).not.toHaveTextContent(en[bundled.key]);
});

it('plays the old tutorial with its own captions if the walkthrough is unavailable, then offers a fresh retry if both fail', () => {
  const { video, subtitle, container } = openFilm();
  fireEvent.playing(video);
  playTo(video, 362);
  expect(subtitle()).toHaveTextContent(en['tour.film.walkthrough.footsteps']);
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
  Object.defineProperty(track, 'track', {
    value: { activeCues: [{ text: 'The tutorial’s own line' }] },
  });
  fireEvent(track, new Event('cuechange'));
  expect(subtitle()).toHaveTextContent('The tutorial’s own line');
  expect(subtitle()).not.toHaveTextContent(
    en['tour.film.walkthrough.footsteps'],
  );
  fireEvent.error(video);
  expect(screen.getByRole('status')).toHaveTextContent(en['help.video.failed']);
  fireEvent.click(screen.getByRole('button', { name: en['help.video.retry'] }));
  expect(container.querySelector('video')).not.toBe(video);
  expect(container.querySelector('video')).toHaveAttribute(
    'src',
    featureFilmUrl('walkthrough', 'en'),
  );
  expect(container.querySelector('track')).toHaveAttribute('kind', 'metadata');
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
