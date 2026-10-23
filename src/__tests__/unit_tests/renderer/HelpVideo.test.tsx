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

describe("Help's film", () => {
  // The Plus tour walked through upgrading and paying monthly, and Plus is
  // not sold any more: the first steps are Help's one film.
  it('is the first steps, in the first chapter, alone', () => {
    expect(
      HELP_CHAPTERS.filter((chapter) => chapter.video).map(({ id }) => id),
    ).toEqual(['start']);
  });

  /**
   * The site serves the film and its captions from /video/ and shows it in a
   * section of its home page; Help asks for exactly these addresses, so none
   * of them may move on either side.
   */
  it("streams from the site's /video/ beside English captions, and opens the site's own section", () => {
    expect(filmOf('start')).toMatchObject({
      src: `${OFFICIAL_SITE_URL}/video/first-steps.mp4`,
      captions: {
        src: `${OFFICIAL_SITE_URL}/video/first-steps.en.vtt`,
        lang: 'en',
      },
      page: `${OFFICIAL_SITE_URL}/#first-steps`,
    });
  });

  it('says its own length on its card', () => {
    render(<HelpVideo video={filmOf('start')} />);
    expect(
      screen.getByRole('button', {
        name: 'Play the video: First steps with FluidEQ',
      }),
    ).toBeInTheDocument();
    expect(screen.getByText(/^About four minutes\./)).toBeInTheDocument();
  });

  it('asks the site for nothing until play is pressed, then for the film and its captions', () => {
    const film = filmOf('start');
    const { container } = render(<HelpVideo video={film} />);
    expect(container.querySelector('video')).toBeNull();
    expect(container.querySelector('track')).toBeNull();

    fireEvent.click(
      screen.getByRole('button', {
        name: 'Play the video: First steps with FluidEQ',
      }),
    );
    expect(container.querySelector('video')).toHaveAttribute('src', film.src);
    expect(container.querySelector('track')).toHaveAttribute(
      'src',
      film.captions.src,
    );
  });
});
