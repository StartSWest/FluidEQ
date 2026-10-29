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
  featureFilmTimingUrl,
  featureFilmUrl,
  filmCueAt,
  siteCues,
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

it('says so when the site cannot send the film, and its key puts the slide back as it was', () => {
  render(<FeatureFilm id="each-ear">{drawing}</FeatureFilm>);
  const { dialog, video } = openFilm();
  fireEvent.error(video);
  // Still open, on the film's own frame: a press that shut again at once
  // looked like Watch had done nothing.
  expect(screen.getByRole('dialog')).toBe(dialog);
  expect(screen.getByRole('status')).toHaveTextContent(
    en['tour.film.unavailable'],
  );
  expect(video).toHaveAttribute('poster', FILM_POSTERS['each-ear']);
  // Nothing to hear, so no sound key; the close key has the focus.
  expect(
    screen.queryByRole('button', { name: en['tour.film.soundOff'] }),
  ).toBeNull();
  const close = screen.getByRole('button', { name: en['tour.film.close'] });
  expect(close).toHaveFocus();

  fireEvent.click(close);
  expect(screen.queryByRole('dialog')).toBeNull();
  expect(screen.getByTestId('drawing')).toBeInTheDocument();
  expect(watchKey()).toHaveFocus();
});

describe('a film timed on the site', () => {
  const { walkthrough } = FEATURE_FILMS;
  const timingTrack = (video: HTMLVideoElement) =>
    video.querySelector('track') as HTMLTrackElement;
  /** The track as the browser hands it over once loaded. */
  const loadTrack = (
    track: HTMLTrackElement,
    cues: { id: string; startTime: number; endTime: number }[],
  ) => {
    Object.defineProperty(track, 'track', { value: { cues } });
    fireEvent.load(track);
  };

  it('asks the site for its timings beside the film, across origins', () => {
    render(<FeatureFilm id="walkthrough">{drawing}</FeatureFilm>);
    const { video } = openFilm();
    const track = timingTrack(video);
    expect(track).toHaveAttribute('kind', 'metadata');
    expect(track).toHaveAttribute(
      'src',
      featureFilmTimingUrl('walkthrough', 'en'),
    );
    expect(track.getAttribute('src')).toBe(
      'https://fluideq.com/video/whatsnew/walkthrough.en.cues.vtt',
    );
    expect(track).toHaveAttribute('default');
    // Without it the browser refuses a track from another origin.
    expect(video).toHaveAttribute('crossorigin', 'anonymous');
  });

  it('says its lines on the site’s timings once they arrive, and on its own until then', () => {
    render(<FeatureFilm id="walkthrough">{drawing}</FeatureFilm>);
    const { dialog, video } = openFilm();
    fireEvent.playing(video);
    const subtitle = () => dialog.querySelector('.feature-film__subtitle');
    const [intro] = walkthrough.cues;
    const late = intro.to + 40;
    const bundled = filmCueAt(walkthrough.cues, late);
    if (!bundled) {
      throw new Error('the walkthrough says nothing at that moment');
    }

    playTo(video, late);
    paint();
    expect(subtitle()).toHaveTextContent(en[bundled.key]);

    // The recording put the opening line later than the build knew.
    loadTrack(timingTrack(video), [
      { id: intro.key, startTime: late - 1, endTime: late + 1 },
    ]);
    paint();
    expect(subtitle()).toHaveTextContent(en[intro.key]);
  });

  it('keeps its own timings when the track has nothing it knows', () => {
    render(<FeatureFilm id="walkthrough">{drawing}</FeatureFilm>);
    const { dialog, video } = openFilm();
    fireEvent.playing(video);
    const [intro] = walkthrough.cues;
    loadTrack(timingTrack(video), [
      { id: 'tour.film.walkthrough.secret', startTime: 0, endTime: 300 },
    ]);
    playTo(video, (intro.from + intro.to) / 2);
    paint();
    expect(dialog.querySelector('.feature-film__subtitle')).toHaveTextContent(
      en[intro.key],
    );
  });

  it('is the only kind that asks: a film timed in the build fetches no track', () => {
    render(<FeatureFilm id="each-ear">{drawing}</FeatureFilm>);
    const { video } = openFilm();
    expect(video.querySelector('track')).toBeNull();
    expect(video).not.toHaveAttribute('crossorigin');
  });
});

describe('a film with a stand-in, while it is not on the site', () => {
  const { walkthrough } = FEATURE_FILMS;

  it('plays the stand-in in its place, with its own captions and none of the film’s lines', () => {
    const { standIn } = walkthrough;
    if (!standIn) {
      throw new Error('the walkthrough has no stand-in');
    }
    render(<FeatureFilm id="walkthrough">{drawing}</FeatureFilm>);
    const { dialog, video } = openFilm();
    fireEvent.error(video);

    // The tutorial, not a notice: Watch plays something.
    expect(video).toHaveAttribute('src', standIn.src);
    expect(video.getAttribute('src')).toBe(
      'https://fluideq.com/video/first-steps.mp4',
    );
    expect(screen.queryByRole('status')).toBeNull();
    const track = video.querySelector('track');
    expect(track).toHaveAttribute('kind', 'captions');
    expect(track).toHaveAttribute('src', standIn.captions);
    expect(video).toHaveAttribute('crossorigin', 'anonymous');

    // The walkthrough's lines would be another film's words over this one.
    fireEvent.playing(video);
    const [intro] = walkthrough.cues;
    playTo(video, (intro.from + intro.to) / 2);
    paint();
    const subtitle = dialog.querySelector('.feature-film__subtitle');
    expect(subtitle).toBeEmptyDOMElement();

    // Its own captions are said there instead, as each one starts.
    Object.defineProperty(track, 'track', {
      value: { mode: 'hidden', activeCues: [{ text: 'In a few minutes,' }] },
    });
    act(() => {
      track?.dispatchEvent(new Event('cuechange'));
    });
    expect(subtitle).toHaveTextContent('In a few minutes,');
  });

  it('says it cannot play only once the stand-in cannot either', () => {
    render(<FeatureFilm id="walkthrough">{drawing}</FeatureFilm>);
    const { video } = openFilm();
    fireEvent.error(video);
    expect(screen.queryByRole('status')).toBeNull();
    fireEvent.error(video);
    expect(screen.getByRole('status')).toHaveTextContent(
      en['tour.film.unavailable'],
    );
  });
});

describe('the timings a site track gives', () => {
  const { walkthrough } = FEATURE_FILMS;
  const [intro, graph] = walkthrough.cues;

  it('times only lines the film has, in the order they are said', () => {
    expect(
      siteCues(walkthrough, [
        { id: graph.key, startTime: 9, endTime: 19 },
        { id: 'tour.film.walkthrough.secret', startTime: 1, endTime: 2 },
        { id: intro.key, startTime: 0.4, endTime: 9 },
        // A cue with no length is no line.
        { id: intro.key, startTime: 30, endTime: 30 },
      ]),
    ).toEqual([
      { key: intro.key, from: 0.4, to: 9 },
      { key: graph.key, from: 9, to: 19 },
    ]);
  });

  it('gives nothing for a track that is missing or says nothing usable', () => {
    expect(siteCues(walkthrough, null)).toBeUndefined();
    expect(siteCues(walkthrough, [])).toBeUndefined();
    expect(
      siteCues(walkthrough, [{ id: 'not.a.line', startTime: 0, endTime: 5 }]),
    ).toBeUndefined();
  });
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
