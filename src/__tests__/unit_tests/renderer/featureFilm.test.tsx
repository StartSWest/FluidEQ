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
import en from 'common/i18n/en';
import { prefersReducedMotion } from 'renderer/utils/bandReveal';

jest.mock('renderer/utils/bandReveal', () => ({
  prefersReducedMotion: jest.fn(() => false),
}));

const reduced = prefersReducedMotion as jest.MockedFunction<
  typeof prefersReducedMotion
>;

/** The video's clock, which jsdom does not run. */
const playTo = (video: HTMLVideoElement, seconds: number) => {
  Object.defineProperty(video, 'currentTime', {
    configurable: true,
    get: () => seconds,
  });
};

let frames: FrameRequestCallback[] = [];
let paused: HTMLMediaElement[] = [];
beforeEach(() => {
  frames = [];
  paused = [];
  jest
    .spyOn(window, 'requestAnimationFrame')
    .mockImplementation((callback) => frames.push(callback));
  jest.spyOn(window, 'cancelAnimationFrame').mockImplementation(() => {});
  // jsdom has no media pipeline: a pause is recorded, a play resolves.
  jest
    .spyOn(HTMLMediaElement.prototype, 'pause')
    .mockImplementation(function pause(this: HTMLMediaElement) {
      paused.push(this);
    });
  jest
    .spyOn(HTMLMediaElement.prototype, 'play')
    .mockImplementation(() => Promise.resolve());
  reduced.mockReturnValue(false);
  window.localStorage.removeItem('fluideq.tour.filmSound');
});
afterEach(() => {
  cleanup();
  jest.restoreAllMocks();
  window.localStorage.removeItem('fluideq.tour.filmSound');
});

/** One painted frame: every callback waiting on it runs once. */
const paint = () =>
  act(() => {
    const waiting = frames;
    frames = [];
    waiting.forEach((callback) => callback(performance.now()));
  });

const drawing = <span data-testid="drawing">the slide drawing</span>;
const subtitle = (container: HTMLElement) =>
  container.querySelector('.feature-film__subtitle');

it('keeps the drawing and fetches nothing for a slide with no film', () => {
  const { container } = render(
    <FeatureFilm id="song-sound">{drawing}</FeatureFilm>,
  );
  expect(screen.getByTestId('drawing')).toBeInTheDocument();
  expect(container.querySelector('video')).toBeNull();
});

it("plays the film in the reader's language from the site, the drawing standing in until it plays", () => {
  const { container } = render(
    <FeatureFilm id="each-ear">{drawing}</FeatureFilm>,
  );
  const video = container.querySelector('video');
  expect(video).toHaveAttribute('src', featureFilmUrl('each-ear', 'en'));
  expect(video?.getAttribute('src')).toBe(
    'https://fluideq.com/video/whatsnew/each-ear.en.mp4',
  );
  expect(video?.muted).toBe(true);
  expect(screen.getByTestId('drawing')).toBeInTheDocument();
  expect(container.querySelector('.feature-film__frame')).not.toHaveClass(
    'is-shown',
  );

  fireEvent.playing(video as HTMLVideoElement);
  expect(screen.queryByTestId('drawing')).toBeNull();
  expect(container.querySelector('.feature-film__frame')).toHaveClass(
    'is-shown',
  );
});

it('shows the line being said under the picture, and none before the first', () => {
  const { container } = render(
    <FeatureFilm id="each-ear">{drawing}</FeatureFilm>,
  );
  const video = container.querySelector('video') as HTMLVideoElement;
  fireEvent.playing(video);
  const [intro, menu] = FEATURE_FILMS['each-ear'].cues;

  playTo(video, intro.from / 2);
  paint();
  expect(subtitle(container)).toBeEmptyDOMElement();

  playTo(video, (intro.from + intro.to) / 2);
  paint();
  expect(subtitle(container)).toHaveTextContent(en[intro.key]);

  playTo(video, menu.from + 0.1);
  paint();
  expect(subtitle(container)).toHaveTextContent(en[menu.key]);
  expect(subtitle(container)).not.toHaveTextContent(en[intro.key]);
});

it('starts silent, and a press turns the sound on for this film and the next', () => {
  const first = render(<FeatureFilm id="each-ear">{drawing}</FeatureFilm>);
  const video = first.container.querySelector('video') as HTMLVideoElement;
  expect(video.muted).toBe(true);
  fireEvent.playing(video);
  const sound = screen.getByRole('button', { name: en['tour.film.soundOn'] });
  expect(sound).toHaveAttribute('aria-pressed', 'false');

  fireEvent.click(sound);
  expect(video.muted).toBe(false);
  expect(
    screen.getByRole('button', { name: en['tour.film.soundOff'] }),
  ).toHaveAttribute('aria-pressed', 'true');
  first.unmount();

  // The next slide's film comes in with the sound the reader chose.
  const next = render(<FeatureFilm id="each-ear">{drawing}</FeatureFilm>);
  expect(
    (next.container.querySelector('video') as HTMLVideoElement).muted,
  ).toBe(false);
});

it('opens larger from where it was, with its sound, and the slide waits paused', () => {
  const { container } = render(
    <FeatureFilm id="custom-looks">{drawing}</FeatureFilm>,
  );
  const small = container.querySelector('video') as HTMLVideoElement;
  fireEvent.playing(small);
  playTo(small, 7.5);

  fireEvent.click(
    screen.getByRole('button', { name: en['tour.film.enlarge'] }),
  );
  const large = screen.getByRole('dialog', {
    name: en[FEATURE_FILMS['custom-looks'].cues[0].key],
  });
  const video = large.querySelector('video') as HTMLVideoElement;
  expect(video.getAttribute('src')).toBe(featureFilmUrl('custom-looks', 'en'));
  // A press is the reader asking to watch it: heard, though the slide's
  // copy was silent.
  expect(video.muted).toBe(false);
  expect(paused).toContain(small);

  let resumedAt: number | undefined;
  Object.defineProperty(video, 'currentTime', {
    configurable: true,
    get: () => resumedAt ?? 0,
    set: (seconds: number) => {
      resumedAt = seconds;
    },
  });
  fireEvent.loadedMetadata(video);
  expect(resumedAt).toBe(7.5);
});

it('closes the larger film alone on Escape, and the slide plays on', () => {
  const tourEscape = jest.fn();
  document.addEventListener('keydown', tourEscape);
  const { container } = render(
    <FeatureFilm id="custom-looks">{drawing}</FeatureFilm>,
  );
  const small = container.querySelector('video') as HTMLVideoElement;
  fireEvent.playing(small);
  fireEvent.click(
    screen.getByRole('button', { name: en['tour.film.enlarge'] }),
  );
  const large = screen.getByRole('dialog');
  fireEvent.playing(large.querySelector('video') as HTMLVideoElement);
  const close = screen.getByRole('button', { name: en['tour.film.close'] });
  expect(close).toHaveFocus();

  const play = jest.mocked(HTMLMediaElement.prototype.play);
  play.mockClear();
  fireEvent.keyDown(close, { key: 'Escape' });
  expect(screen.queryByRole('dialog')).toBeNull();
  // Only the film: the What's New dialog's own Escape never heard it.
  expect(tourEscape).not.toHaveBeenCalled();
  expect(play.mock.contexts).toContain(small);
  expect(
    screen.getByRole('button', { name: en['tour.film.enlarge'] }),
  ).toHaveFocus();
  document.removeEventListener('keydown', tourEscape);
});

it('goes back to the drawing for good when the film cannot be had', () => {
  const { container } = render(
    <FeatureFilm id="each-ear">{drawing}</FeatureFilm>,
  );
  fireEvent.error(container.querySelector('video') as HTMLVideoElement);
  expect(screen.getByTestId('drawing')).toBeInTheDocument();
  expect(container.querySelector('video')).toBeNull();
});

it('keeps the drawing, which holds still, when motion is reduced', () => {
  reduced.mockReturnValue(true);
  const { container } = render(
    <FeatureFilm id="each-ear">{drawing}</FeatureFilm>,
  );
  expect(screen.getByTestId('drawing')).toBeInTheDocument();
  expect(container.querySelector('video')).toBeNull();
});

describe('every film in the catalogue', () => {
  it.each(Object.entries(FEATURE_FILMS))(
    '%s opens on what it is, then says only what the dictionary has, in order',
    (_id, film) => {
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
