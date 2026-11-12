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
import { loadLocale, translate } from 'common/i18n';

/**
 * The Visualizers' own film (2.5): recorded after the build, so nothing is
 * asked of the site before Watch and a film not yet uploaded is "coming
 * soon"; its subtitles are the site's, the reader's language first and the
 * voice's after.
 */

/** Everything on the page that would make the browser ask the site. */
const fromTheSite = () =>
  Array.from(document.querySelectorAll('[src]'), (element) =>
    element.getAttribute('src'),
  ).filter((src) => src?.startsWith(OFFICIAL_SITE_URL));

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

// German is loaded on demand; without this, `translate('de', …)` answers in
// English and a German case passes on English text.
beforeAll(() => loadLocale('de'));

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

  it.each(['en', 'de'] as const)(
    'shows its key and asks the site for nothing until Watch is pressed, in %s',
    async (locale) => {
      await renderSlide(locale);
      expect(
        screen.getByRole('heading', {
          name: translate(locale, 'tour.film.visuals.intro'),
        }),
      ).toBeInTheDocument();
      const watch = screen.getByRole('button', { name: watchName(locale) });
      // The terms: "nothing is fetched until you press Play or Watch".
      expect(fromTheSite()).toEqual([]);

      // The control: the press is what asks for the film.
      fireEvent.click(watch);
      expect(fromTheSite()).toContain(featureFilmUrl(VISUALS_FILM, locale));
    },
  );

  it('says the film is coming, calmly, while the site does not have it', async () => {
    await renderSlide('de');
    fireEvent.click(screen.getByRole('button', { name: watchName('de') }));
    const dialog = screen.getByRole('dialog', {
      name: translate('de', 'tour.film.visuals.intro'),
    });
    fireEvent.error(dialog.querySelector('video') as HTMLVideoElement);

    expect(screen.getByRole('status')).toHaveTextContent(
      translate('de', 'tour.v25.film.soon'),
    );
    expect(dialog).not.toHaveTextContent(
      translate('de', 'tour.film.unavailable'),
    );
    // And it closes as any film does.
    fireEvent.click(
      screen.getByRole('button', { name: translate('de', 'tour.film.close') }),
    );
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it("opens large, with the reader's subtitles, then the voice's when the site has none", async () => {
    await renderSlide('de');
    fireEvent.click(screen.getByRole('button', { name: watchName('de') }));

    const dialog = screen.getByRole('dialog', {
      name: translate('de', 'tour.film.visuals.intro'),
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
