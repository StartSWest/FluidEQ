/* Copyright (C) 2026 Ivan Carmenates Garcia. SPDX-License-Identifier: GPL-3.0-or-later */

import '@testing-library/jest-dom';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { loadLocale, translate } from 'common/i18n';
import FeatureFilm from 'renderer/components/featureTour/FeatureFilm';
import {
  featureFilmLocale,
  featureFilmUrl,
} from 'renderer/components/featureTour/featureFilms';
import HelpFilm from 'renderer/help/HelpFilm';
import { I18nProvider } from 'renderer/utils/I18nContext';

const locales = ['ko', 'zh-Hant'] as const;
beforeAll(() => Promise.all(locales.map(loadLocale)));
beforeEach(() => {
  jest.spyOn(window, 'requestAnimationFrame').mockReturnValue(1);
  jest
    .spyOn(window, 'cancelAnimationFrame')
    .mockImplementation(() => undefined);
  // jsdom has no media decoder; these tests verify language and URL selection.
  jest.spyOn(HTMLMediaElement.prototype, 'play').mockResolvedValue(undefined);
  jest
    .spyOn(HTMLMediaElement.prototype, 'pause')
    .mockImplementation(() => undefined);
});
afterEach(() => {
  cleanup();
  jest.restoreAllMocks();
  window.localStorage.clear();
});

it.each(locales)(
  'uses an existing English film for %s and discloses its voice before playing',
  (code) => {
    window.localStorage.setItem('fluideq.locale', code);
    const { container } = render(
      <I18nProvider>
        <FeatureFilm id="each-ear">
          <span>Artwork</span>
        </FeatureFilm>
      </I18nProvider>,
    );
    expect(container.querySelector('video')).toBeNull();
    const opener = screen.getByRole('button', {
      name: `${translate(code, 'tour.film.watch')} · ${translate(code, 'tour.film.englishAudio')}`,
    });
    fireEvent.click(opener);
    expect(screen.getByRole('dialog').querySelector('video')).toHaveAttribute(
      'src',
      'https://fluideq.com/video/whatsnew/each-ear.en.mp4',
    );
    expect(featureFilmLocale(code)).toBe('en');
  },
);

it.each(locales)(
  'includes the English-voice notice in the accessible Help opener in %s',
  (code) => {
    window.localStorage.setItem('fluideq.locale', code);
    const { container } = render(
      <I18nProvider>
        <HelpFilm id="each-ear" />
      </I18nProvider>,
    );
    const opener = screen.getByRole('button');
    expect(opener).toHaveAccessibleName(
      expect.stringContaining(translate(code, 'tour.film.englishAudio')),
    );
    expect(opener).toHaveTextContent(translate(code, 'tour.film.englishAudio'));
    fireEvent.click(opener);
    expect(container.querySelector('video')).toHaveAttribute(
      'src',
      featureFilmUrl('each-ear', 'en'),
    );
  },
);

it.each(['en', 'zh', 'ja', 'es', 'pt', 'fr', 'de', 'it', 'ru', 'hi'] as const)(
  'keeps the existing published voice mapping for %s',
  (code) => {
    expect(featureFilmLocale(code)).toBe(code);
    expect(featureFilmUrl('each-ear', code)).toBe(
      `https://fluideq.com/video/whatsnew/each-ear.${code}.mp4`,
    );
  },
);
