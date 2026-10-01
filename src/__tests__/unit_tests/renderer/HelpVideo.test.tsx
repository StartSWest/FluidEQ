/* Copyright (C) 2026 Ivan Carmenates Garcia. SPDX-License-Identifier: GPL-3.0-or-later */

import '@testing-library/jest-dom';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { OFFICIAL_SITE_URL } from 'common/branding';
import { HELP_CHAPTERS } from 'common/helpGuide';
import HelpVideo from 'renderer/help/HelpVideo';

const filmOf = (chapter: string) => {
  const film = HELP_CHAPTERS.find(({ id }) => id === chapter)?.video;
  if (!film) {
    throw new Error(`the ${chapter} chapter carries no film`);
  }
  return film;
};

afterEach(cleanup);

describe("Help's films", () => {
  it('are the first steps in the first chapter and the Plus tour in the Plus chapter', () => {
    expect(
      HELP_CHAPTERS.filter((chapter) => chapter.video).map(({ id }) => id),
    ).toEqual(['start', 'plus']);
  });

  /**
   * The site serves each film and its captions from /video/ and shows it in a
   * section of its home page; Help asks for exactly these addresses, so none
   * of them may move on either side.
   */
  it("stream from the site's /video/ beside English captions, and open the site's own section", () => {
    expect(filmOf('start')).toMatchObject({
      src: `${OFFICIAL_SITE_URL}/video/first-steps.mp4`,
      captions: {
        src: `${OFFICIAL_SITE_URL}/video/first-steps.en.vtt`,
        lang: 'en',
      },
      page: `${OFFICIAL_SITE_URL}/#first-steps`,
    });
    expect(filmOf('plus')).toMatchObject({
      src: `${OFFICIAL_SITE_URL}/video/plus-tour.mp4`,
      captions: {
        src: `${OFFICIAL_SITE_URL}/video/plus-tour.en.vtt`,
        lang: 'en',
      },
      page: `${OFFICIAL_SITE_URL}/#plus-tour`,
    });
  });

  /**
   * The note under the title used to be one line for every film, which said
   * "about four minutes" of a tour that runs four and a half.
   */
  it('each say their own length on their card', () => {
    render(<HelpVideo video={filmOf('plus')} />);
    expect(
      screen.getByRole('button', {
        name: 'Play the video: A tour of FluidEQ Plus',
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/^About four and a half minutes\./),
    ).toBeInTheDocument();
    cleanup();

    render(<HelpVideo video={filmOf('start')} />);
    expect(
      screen.getByRole('button', {
        name: 'Play the video: First steps with FluidEQ',
      }),
    ).toBeInTheDocument();
    expect(screen.getByText(/^About four minutes\./)).toBeInTheDocument();
    expect(screen.queryByText(/four and a half/)).not.toBeInTheDocument();
  });

  it('ask the site for nothing until play is pressed, then for the film and its captions', () => {
    const film = filmOf('plus');
    const { container } = render(<HelpVideo video={film} />);
    expect(container.querySelector('video')).toBeNull();
    expect(container.querySelector('track')).toBeNull();

    fireEvent.click(
      screen.getByRole('button', {
        name: 'Play the video: A tour of FluidEQ Plus',
      }),
    );
    expect(container.querySelector('video')).toHaveAttribute('src', film.src);
    expect(container.querySelector('track')).toHaveAttribute(
      'src',
      film.captions.src,
    );
  });
});
