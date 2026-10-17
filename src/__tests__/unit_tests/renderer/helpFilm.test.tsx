/* Copyright (C) 2026 Ivan Carmenates Garcia. SPDX-License-Identifier: GPL-3.0-or-later */

import '@testing-library/jest-dom';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import HelpFilm from 'renderer/help/HelpFilm';
import { HELP_FILMS } from 'renderer/help/helpFilms';
import {
  FEATURE_FILMS,
  featureFilmUrl,
} from 'renderer/components/featureTour/featureFilms';
import { HELP_CHAPTERS } from 'common/helpGuide';
import en from 'common/i18n/en';

afterEach(cleanup);

const intro = en[FEATURE_FILMS['each-ear'].cues[0].key];

it('is a bundled picture until pressed, and fetches nothing before', () => {
  const { container } = render(<HelpFilm id="each-ear" poster="poster.jpg" />);
  expect(container.querySelector('video')).toBeNull();
  const card = screen.getByRole('button', {
    name: en['help.video.play'].replace('{title}', intro),
  });
  expect(card.querySelector('img')).toHaveAttribute('src', 'poster.jpg');
  expect(card).toHaveTextContent(intro);
});

it("plays in the reader's language once pressed, its first line under it", () => {
  const { container } = render(<HelpFilm id="each-ear" poster="poster.jpg" />);
  fireEvent.click(screen.getByRole('button'));
  const video = container.querySelector('video');
  expect(video).toHaveAttribute('src', featureFilmUrl('each-ear', 'en'));
  expect(video).toHaveAttribute('controls');
  expect(container.querySelector('figcaption')).toHaveTextContent(intro);
});

it('says so and offers to try again when the site cannot be reached', () => {
  const { container } = render(<HelpFilm id="each-ear" poster="poster.jpg" />);
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
  const { container } = render(<HelpFilm id="no-such-film" poster="x.jpg" />);
  expect(container).toBeEmptyDOMElement();
});

it('places only films that exist, under topics the guide has', () => {
  const topics = new Set(HELP_CHAPTERS.map((chapter) => chapter.id));
  Object.entries(HELP_FILMS).forEach(([topic, films]) => {
    expect(topics.has(topic as (typeof HELP_CHAPTERS)[number]['id'])).toBe(
      true,
    );
    films.forEach((film) => expect(FEATURE_FILMS[film.id]).toBeDefined());
  });
  // Every film is somewhere in Help.
  const placed = new Set(
    Object.values(HELP_FILMS).flatMap((films) => films.map((film) => film.id)),
  );
  Object.keys(FEATURE_FILMS).forEach((id) => expect(placed.has(id)).toBe(true));
});
