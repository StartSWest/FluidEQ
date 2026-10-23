/* Copyright (C) 2026 Ivan Carmenates Garcia. SPDX-License-Identifier: GPL-3.0-or-later */

import '@testing-library/jest-dom';
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
} from '@testing-library/react';
import FeatureFilm from 'renderer/components/featureTour/FeatureFilm';
import {
  FEATURE_FILMS,
  featureFilmUrl,
  filmCueAt,
} from 'renderer/components/featureTour/featureFilms';
import FILM_POSTERS from 'renderer/components/featureTour/filmPosters';
import en from 'common/i18n/en';

/** The video's clock, which jsdom does not run. */
const playTo = (video: HTMLVideoElement, seconds: number) => {
  Object.defineProperty(video, 'currentTime', {
    configurable: true,
    get: () => seconds,
  });
};

let frames: FrameRequestCallback[] = [];
beforeEach(() => {
  frames = [];
  jest
    .spyOn(window, 'requestAnimationFrame')
    .mockImplementation((callback) => frames.push(callback));
  jest.spyOn(window, 'cancelAnimationFrame').mockImplementation(() => {});
  // jsdom has no media pipeline: a play resolves, a pause does nothing.
  jest
    .spyOn(HTMLMediaElement.prototype, 'pause')
    .mockImplementation(() => undefined);
  jest
    .spyOn(HTMLMediaElement.prototype, 'play')
    .mockImplementation(() => Promise.resolve());
});
afterEach(() => {
  cleanup();
  jest.restoreAllMocks();
});

/** One painted frame: every callback waiting on it runs once. */
const paint = () =>
  act(() => {
    const waiting = frames;
    frames = [];
    waiting.forEach((callback) => callback(performance.now()));
  });

const drawing = <span data-testid="drawing">the slide drawing</span>;
const watchKey = () =>
  screen.getByRole('button', { name: en['tour.film.watch'] });
const openFilm = () => {
  fireEvent.click(watchKey());
  const dialog = screen.getByRole('dialog');
  return {
    dialog,
    video: dialog.querySelector('video') as HTMLVideoElement,
  };
};

it('keeps the drawing alone and offers nothing for a slide with no film', () => {
  render(<FeatureFilm id="song-sound">{drawing}</FeatureFilm>);
  expect(screen.getByTestId('drawing')).toBeInTheDocument();
  expect(
    screen.queryByRole('button', { name: en['tour.film.watch'] }),
  ).toBeNull();
});

it('shows the drawing whole with a key under it, and fetches nothing until the key is pressed', () => {
  const { container } = render(
    <FeatureFilm id="each-ear">{drawing}</FeatureFilm>,
  );
  expect(screen.getByTestId('drawing')).toBeInTheDocument();
  // No film is drawn in the slide: it was a cropped strip under the picture.
  expect(container.querySelector('video')).toBeNull();
  expect(
    screen.getByTestId('drawing').compareDocumentPosition(watchKey()),
  ).toBe(Node.DOCUMENT_POSITION_FOLLOWING);
});

it("opens the film large, from its start, in the reader's language, with its sound and a frame of it until it plays", () => {
  render(<FeatureFilm id="each-ear">{drawing}</FeatureFilm>);
  const { dialog, video } = openFilm();
  expect(dialog).toHaveAccessibleName(
    en[FEATURE_FILMS['each-ear'].cues[0].key],
  );
  expect(video.getAttribute('src')).toBe(
    'https://fluideq.com/video/whatsnew/each-ear.en.mp4',
  );
  expect(video).toHaveAttribute('src', featureFilmUrl('each-ear', 'en'));
  expect(video).toHaveAttribute('poster', FILM_POSTERS['each-ear']);
  // A press is the reader asking to watch it: heard.
  expect(video.muted).toBe(false);
  // The slide's picture stays where it was, under the larger film.
  expect(screen.getByTestId('drawing')).toBeInTheDocument();
});

it('shows the line being said under the film, and none before the first', () => {
  render(<FeatureFilm id="each-ear">{drawing}</FeatureFilm>);
  const { dialog, video } = openFilm();
  fireEvent.playing(video);
  const subtitle = () => dialog.querySelector('.feature-film__subtitle');
  const [intro, menu] = FEATURE_FILMS['each-ear'].cues;

  playTo(video, intro.from / 2);
  paint();
  expect(subtitle()).toBeEmptyDOMElement();

  playTo(video, (intro.from + intro.to) / 2);
  paint();
  expect(subtitle()).toHaveTextContent(en[intro.key]);

  playTo(video, menu.from + 0.1);
  paint();
  expect(subtitle()).toHaveTextContent(en[menu.key]);
  expect(subtitle()).not.toHaveTextContent(en[intro.key]);
});

it('turns the sound off and on again from its own key', () => {
  render(<FeatureFilm id="each-ear">{drawing}</FeatureFilm>);
  const { video } = openFilm();
  fireEvent.playing(video);
  fireEvent.click(
    screen.getByRole('button', { name: en['tour.film.soundOff'] }),
  );
  expect(video.muted).toBe(true);
  fireEvent.click(
    screen.getByRole('button', { name: en['tour.film.soundOn'] }),
  );
  expect(video.muted).toBe(false);
});

it('closes alone on Escape and gives the focus back to the key', () => {
  const tourEscape = jest.fn();
  document.addEventListener('keydown', tourEscape);
  render(<FeatureFilm id="custom-looks">{drawing}</FeatureFilm>);
  const { video } = openFilm();
  fireEvent.playing(video);
  const close = screen.getByRole('button', { name: en['tour.film.close'] });
  expect(close).toHaveFocus();

  fireEvent.keyDown(close, { key: 'Escape' });
  expect(screen.queryByRole('dialog')).toBeNull();
  // Only the film: the What's New dialog's own Escape never heard it.
  expect(tourEscape).not.toHaveBeenCalled();
  expect(watchKey()).toHaveFocus();
  document.removeEventListener('keydown', tourEscape);
});

it('closes when the site cannot send the film, and the slide is as it was', () => {
  render(<FeatureFilm id="each-ear">{drawing}</FeatureFilm>);
  const { video } = openFilm();
  fireEvent.error(video);
  expect(screen.queryByRole('dialog')).toBeNull();
  expect(screen.getByTestId('drawing')).toBeInTheDocument();
  expect(watchKey()).toBeInTheDocument();
});

describe('every film in the catalogue', () => {
  it.each(Object.entries(FEATURE_FILMS))(
    '%s has a bundled frame, opens on what it is, then says only what the dictionary has, in order',
    (id, film) => {
      expect(FILM_POSTERS[id]).toBeTruthy();
      expect(film.width).toBeGreaterThan(0);
      expect(film.height).toBeGreaterThan(0);
      expect(film.cues[0].key.endsWith('.intro')).toBe(true);
      let previousEnd = 0;
      film.cues.forEach((cue) => {
        expect(en[cue.key]).toBeTruthy();
        expect(cue.from).toBeGreaterThanOrEqual(previousEnd);
        expect(cue.to).toBeGreaterThan(cue.from);
        previousEnd = cue.to;
      });
      expect(filmCueAt(film.cues, film.cues[0].from)).toBe(film.cues[0]);
      expect(filmCueAt(film.cues, previousEnd)).toBeUndefined();
    },
  );
});
