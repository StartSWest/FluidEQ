/* Copyright (C) 2026 Ivan Carmenates Garcia. SPDX-License-Identifier: GPL-3.0-or-later */

import '@testing-library/jest-dom';
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
} from '@testing-library/react';
import { EditSlide } from 'renderer/components/featureTour/release25';
import {
  FEATURE_FILMS,
  featureFilmCaptionUrl,
  featureFilmCaptionUrls,
  featureFilmUrl,
  VISUALS_FILM,
} from 'renderer/components/featureTour/featureFilms';
import type { ISlideActions } from 'renderer/components/featureTour/slides';
import { I18nProvider } from 'renderer/utils/I18nContext';
import { OFFICIAL_SITE_URL } from 'common/branding';
import { translate } from 'common/i18n';

/**
 * The Visualizers' own film (2.5): recorded after the build, so its key
 * waits for the site to have it, and its subtitles are the site's, the
 * reader's language first and the voice's after.
 */

const actions = { openTab: jest.fn() } as unknown as ISlideActions;

// Waits for the language's dictionary, which loads on its own: the slide's
// title in that language says it has.
const renderSlide = async (locale: 'en' | 'de') => {
  window.localStorage.setItem('fluideq.locale', locale);
  const view = render(
    <I18nProvider>
      <EditSlide actions={actions} />
    </I18nProvider>,
  );
  await screen.findByRole('heading', {
    name: translate(locale, 'tour.edit.title'),
  });
  return view;
};

afterEach(() => {
  cleanup();
  window.localStorage.removeItem('fluideq.locale');
});

const watchName = (locale: 'en' | 'de') =>
  locale === 'en'
    ? translate('en', 'tour.film.watch')
    : `${translate('de', 'tour.film.watch')} · ${translate('de', 'tour.film.englishAudio')}`;

describe("the Visualizers' film", () => {
  it('is streamed from the site under its own name', () => {
    expect(VISUALS_FILM).toBe('visuals');
    expect(featureFilmUrl(VISUALS_FILM, 'de')).toBe(
      `${OFFICIAL_SITE_URL}/video/whatsnew/visuals.en.mp4`,
    );
    expect(FEATURE_FILMS[VISUALS_FILM].spokenCaptions).toBe(true);
  });

  it('shows no key, player or error while the site is asked, nor after a no', async () => {
    const { container } = await renderSlide('en');
    const probe = container.querySelector('video');
    expect(probe).toHaveAttribute('src', featureFilmUrl(VISUALS_FILM, 'en'));
    expect(probe).toHaveAttribute('preload', 'metadata');
    expect(probe).not.toBeVisible();
    expect(
      screen.queryByRole('button', { name: watchName('en') }),
    ).not.toBeInTheDocument();

    fireEvent.error(probe as HTMLVideoElement);
    expect(container.querySelector('video')).toBeNull();
    expect(
      screen.queryByRole('button', { name: watchName('en') }),
    ).not.toBeInTheDocument();
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
    // The slide itself is all there.
    expect(
      screen.getByRole('heading', { name: translate('en', 'tour.edit.title') }),
    ).toBeInTheDocument();
  });

  it.each(['en', 'de'] as const)(
    'shows the key once the site has the film, in %s',
    async (locale) => {
      const { container } = await renderSlide(locale);
      fireEvent.loadedMetadata(container.querySelector('video') as Element);
      // The probe is gone, so nothing more of the film is fetched.
      expect(container.querySelector('video')).toBeNull();
      expect(
        screen.getByRole('heading', {
          name: translate(locale, 'tour.v25.film.title'),
        }),
      ).toBeInTheDocument();
      expect(
        screen.getByRole('button', { name: watchName(locale) }),
      ).toBeInTheDocument();
    },
  );

  it("opens large, with the reader's subtitles, then the voice's when the site has none", async () => {
    await renderSlide('de');
    fireEvent.loadedMetadata(document.querySelector('video') as Element);
    fireEvent.click(screen.getByRole('button', { name: watchName('de') }));

    const dialog = screen.getByRole('dialog', {
      name: translate('de', 'tour.v25.film.title'),
    });
    const track = () => dialog.querySelector('track') as HTMLTrackElement;
    expect(dialog.querySelector('video')).toHaveAttribute(
      'src',
      featureFilmUrl(VISUALS_FILM, 'de'),
    );
    expect(track()).toHaveAttribute(
      'src',
      `${OFFICIAL_SITE_URL}/video/whatsnew/visuals.de.vtt`,
    );
    expect(track()).toHaveAttribute('srclang', 'de');

    act(() => {
      track().dispatchEvent(new Event('error'));
    });
    expect(track()).toHaveAttribute(
      'src',
      featureFilmCaptionUrl(VISUALS_FILM, 'de'),
    );
    expect(track()).toHaveAttribute('srclang', 'en');

    // The voice's own refused too: nothing further to ask for.
    act(() => {
      track().dispatchEvent(new Event('error'));
    });
    expect(track()).toHaveAttribute(
      'src',
      `${OFFICIAL_SITE_URL}/video/whatsnew/visuals.en.vtt`,
    );
  });
});

describe('where verbatim subtitles are looked for', () => {
  it("asks for the reader's language first, then the voice's", () => {
    expect(featureFilmCaptionUrls(VISUALS_FILM, 'ja')).toEqual([
      `${OFFICIAL_SITE_URL}/video/whatsnew/visuals.ja.vtt`,
      `${OFFICIAL_SITE_URL}/video/whatsnew/visuals.en.vtt`,
    ]);
    expect(featureFilmCaptionUrls(VISUALS_FILM, 'en')).toEqual([
      `${OFFICIAL_SITE_URL}/video/whatsnew/visuals.en.vtt`,
    ]);
  });

  it('keeps a bundled film to its bundled captions, never the site', () => {
    const urls = featureFilmCaptionUrls('gaming-lab-overview', 'ko');
    expect(urls).toEqual([featureFilmCaptionUrl('gaming-lab-overview', 'ko')]);
    expect(urls[0]).toMatch(/^data:text\/vtt/);
  });
});
