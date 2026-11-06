/* Copyright (C) 2026 Ivan Carmenates Garcia. SPDX-License-Identifier: GPL-3.0-or-later */

import '@testing-library/jest-dom';
import fs from 'fs';
import path from 'path';
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
} from '@testing-library/react';
import HelpChapter from 'renderer/help/HelpChapter';
import HelpFilm from 'renderer/help/HelpFilm';
import HELP_FILMS, { FILMS_AWAY } from 'renderer/help/helpFilms';
import { WALKTHROUGH_FILM } from 'renderer/components/featureTour/WalkthroughSlide';
import FILM_POSTERS from 'renderer/components/featureTour/filmPosters';
import {
  FEATURE_FILMS,
  featureFilmCaptionUrl,
  featureFilmLocale,
  featureFilmUrl,
} from 'renderer/components/featureTour/featureFilms';
import { HELP_CHAPTERS } from 'common/helpGuide';
import en from 'common/i18n/en';

afterEach(cleanup);

const intro = en[FEATURE_FILMS['each-ear'].cues[0].key];

const filmsOnSlides = () =>
  new Set(
    fs
      .readdirSync(
        path.join(__dirname, '../../../renderer/components/featureTour'),
      )
      .filter((file) => file.endsWith('.tsx'))
      .flatMap((file) =>
        Array.from(
          fs
            .readFileSync(
              path.join(
                __dirname,
                '../../../renderer/components/featureTour',
                file,
              ),
              'utf8',
            )
            .matchAll(/\bfilm="([a-z0-9-]+)"/g),
          (match) => match[1],
        ),
      ),
  );

it('is a bundled picture until pressed, and fetches nothing before', () => {
  const { container } = render(<HelpFilm id="each-ear" />);
  expect(container.querySelector('video')).toBeNull();
  const card = screen.getByRole('button', {
    name: en['help.video.play'].replace('{title}', intro),
  });
  expect(card.querySelector('img')).toHaveAttribute(
    'src',
    FILM_POSTERS['each-ear'],
  );
  expect(card).toHaveTextContent(intro);
});

it("plays in the reader's language once pressed, its first line under it", () => {
  const { container } = render(<HelpFilm id="each-ear" />);
  fireEvent.click(screen.getByRole('button'));
  const video = container.querySelector('video');
  expect(video).toHaveAttribute('src', featureFilmUrl('each-ear', 'en'));
  expect(video).toHaveAttribute('controls');
  expect(container.querySelector('figcaption')).toHaveTextContent(intro);
});

it('says so and offers to try again when the site cannot be reached', () => {
  const { container } = render(<HelpFilm id="each-ear" />);
  fireEvent.click(screen.getByRole('button'));
  fireEvent.error(container.querySelector('video') as HTMLVideoElement);
  expect(screen.getByRole('status')).toHaveTextContent(en['help.video.failed']);
  fireEvent.click(screen.getByRole('button', { name: en['help.video.retry'] }));
  expect(container.querySelector('video')).toHaveAttribute(
    'src',
    featureFilmUrl('each-ear', 'en'),
  );
});

it('draws nothing for a film the catalogue does not have', () => {
  const { container } = render(<HelpFilm id="no-such-film" />);
  expect(container).toBeEmptyDOMElement();
});

it('places only films that exist, under topics the guide has', () => {
  const topics = new Set(HELP_CHAPTERS.map((chapter) => chapter.id));
  Object.entries(HELP_FILMS).forEach(([topic, films]) => {
    expect(topics.has(topic as (typeof HELP_CHAPTERS)[number]['id'])).toBe(
      true,
    );
    films.forEach((id) => {
      expect(FEATURE_FILMS[id]).toBeDefined();
      expect(FILM_POSTERS[id]).toBeTruthy();
    });
  });
  // Help may select a newer recording than What's New. Every catalogue
  // entry still has an actual reader, or is explicitly held away.
  const placed = new Set(Object.values(HELP_FILMS).flat());
  const onSlides = filmsOnSlides();
  Object.keys(FEATURE_FILMS).forEach((id) =>
    expect(
      placed.has(id) ||
        FILMS_AWAY.includes(id) ||
        onSlides.has(id) ||
        id === WALKTHROUGH_FILM,
    ).toBe(true),
  );
});

// A film of something the app no longer has plays nowhere: not under a Help
// topic, and not on a What's New slide, whose films are named in its source.
it('plays a film held away nowhere, until it is recorded again', () => {
  expect(FILMS_AWAY).toContain('compact-player');
  const placed = new Set(Object.values(HELP_FILMS).flat());
  const onSlides = filmsOnSlides();
  // The positive control: the slides do name their films this way.
  expect(onSlides.has('custom-looks')).toBe(true);
  FILMS_AWAY.forEach((id) => {
    expect(FEATURE_FILMS[id]).toBeDefined();
    expect(placed.has(id)).toBe(false);
    expect(onSlides.has(id)).toBe(false);
  });
});

it('uses the new full-window Gaming overview with its own spoken captions', () => {
  expect(HELP_FILMS.games).toEqual(['gaming-lab-overview']);
  expect(filmsOnSlides()).toContain('gaming-lab');
  const { container } = render(<HelpFilm id="gaming-lab-overview" />);
  expect(container.querySelector('video')).toBeNull();
  fireEvent.click(screen.getByRole('button'));
  const video = container.querySelector('video') as HTMLVideoElement;
  expect(video).toHaveAttribute(
    'src',
    featureFilmUrl('gaming-lab-overview', 'en'),
  );
  expect(video).not.toHaveAttribute('crossorigin');
  const track = video.querySelector('track') as HTMLTrackElement;
  expect(track).toHaveAttribute('kind', 'captions');
  expect(track).toHaveAttribute(
    'src',
    featureFilmCaptionUrl('gaming-lab-overview', 'en'),
  );
  Object.defineProperty(track, 'track', {
    value: {
      mode: 'hidden',
      activeCues: [{ text: 'This is a development preview.' }],
    },
  });
  act(() => track.dispatchEvent(new Event('cuechange')));
  expect(container.querySelector('figcaption')).toHaveTextContent(
    'This is a development preview.',
  );
});

it('requests only recorded Gaming voices and matching verbatim subtitles', () => {
  const film = FEATURE_FILMS['gaming-lab-overview'];
  expect(Object.keys(film.bundled ?? {})).toEqual(['en', 'es']);
  expect(featureFilmLocale('es', film)).toBe('es');
  expect(featureFilmLocale('ja', film)).toBe('en');
  expect(featureFilmUrl('gaming-lab-overview', 'es')).toBe(
    film.bundled?.es?.src,
  );
  expect(featureFilmUrl('gaming-lab-overview', 'ja')).toBe(
    film.bundled?.en?.src,
  );
  const spanish = featureFilmCaptionUrl('gaming-lab-overview', 'es');
  expect(spanish).toMatch(/^data:text\/vtt;charset=utf-8,/);
  expect(decodeURIComponent(spanish)).toContain(
    'Así se ve el nuevo Laboratorio gaming',
  );
  expect(
    decodeURIComponent(featureFilmCaptionUrl('gaming-lab-overview', 'ja')),
  ).toContain("Here's a first look");
});

it("comes after the topic's pictures and before its steps, so a film the site cannot send leaves the topic whole", () => {
  const topic = HELP_CHAPTERS.find((chapter) => chapter.id === 'looks');
  if (!topic) {
    throw new Error('the guide has no custom looks topic');
  }
  expect(topic.figures.length).toBeGreaterThan(0);
  const { container } = render(
    <HelpChapter
      chapter={{
        id: topic.id,
        group: topic.group,
        figures: topic.figures,
        number: 6,
        title: 'Custom looks',
        intro: 'Intro',
        steps: ['A step'],
        tip: 'A tip',
      }}
      onEnlarge={() => undefined}
    />,
  );
  const section = container.querySelector('section') as HTMLElement;
  const order = [...section.children].map((child) => {
    if (child.matches('.help-film')) {
      return `film:${child.getAttribute('data-film')}`;
    }
    if (child.matches('figure')) {
      return 'picture';
    }
    return child.tagName.toLowerCase();
  });
  const films = HELP_FILMS.looks.map((id) => `film:${id}`);
  const firstFilm = order.indexOf(films[0]);
  expect(order.slice(firstFilm, firstFilm + films.length)).toEqual(films);
  expect(order.lastIndexOf('picture')).toBeLessThan(firstFilm);
  expect(order.indexOf('h3')).toBe(firstFilm + films.length);
});
