/* Copyright (C) 2026 Ivan Carmenates Garcia. SPDX-License-Identifier: GPL-3.0-or-later */

import '@testing-library/jest-dom';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { loadLocale, translate } from 'common/i18n';
import { featureTourFor } from 'renderer/components/featureTour/slides';
import WalkthroughSlide, {
  WALKTHROUGH_FILM,
} from 'renderer/components/featureTour/WalkthroughSlide';
import {
  FEATURE_FILMS,
  featureFilmUrl,
} from 'renderer/components/featureTour/featureFilms';
import FILM_POSTERS from 'renderer/components/featureTour/filmPosters';
import { I18nProvider } from 'renderer/utils/I18nContext';

beforeAll(() => loadLocale('es'));
beforeEach(() => {
  jest.spyOn(window, 'requestAnimationFrame').mockReturnValue(1);
  jest
    .spyOn(window, 'cancelAnimationFrame')
    .mockImplementation(() => undefined);
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

const renderIn = (code: string) => {
  window.localStorage.setItem('fluideq.locale', code);
  return render(
    <I18nProvider>
      <WalkthroughSlide />
    </I18nProvider>,
  );
};

it("is What's New's first page for anyone arriving at 2.2", () => {
  expect(featureTourFor('2.2.0')[0].id).toBe(WALKTHROUGH_FILM);
  // The positive control: the page after it is still 2.2's own.
  expect(featureTourFor('2.2.0')[1].id).toBe('karaoke-background');
});

it('shows a frame of the film and fetches nothing until it is pressed', () => {
  const { container } = renderIn('en');
  expect(container.querySelector('video')).toBeNull();
  expect(container.querySelector('img')).toHaveAttribute(
    'src',
    FILM_POSTERS[WALKTHROUGH_FILM],
  );
});

it('plays the English voice to a Spanish reader, says so on the key, and captions it in Spanish', () => {
  expect(FEATURE_FILMS[WALKTHROUGH_FILM].locales).toEqual(['en']);
  renderIn('es');
  fireEvent.click(
    screen.getByRole('button', {
      name: `${translate('es', 'tour.film.watch')} · ${translate('es', 'tour.film.englishAudio')}`,
    }),
  );
  const dialog = screen.getByRole('dialog');
  expect(dialog.querySelector('video')).toHaveAttribute(
    'src',
    featureFilmUrl(WALKTHROUGH_FILM, 'en'),
  );
  expect(featureFilmUrl(WALKTHROUGH_FILM, 'es')).toBe(
    featureFilmUrl(WALKTHROUGH_FILM, 'en'),
  );
  // Another film with a Spanish voice still asks for it: the control.
  expect(featureFilmUrl('custom-looks', 'es')).toMatch(
    /custom-looks\.es\.mp4$/,
  );
  expect(dialog).toHaveAccessibleName(
    translate('es', FEATURE_FILMS[WALKTHROUGH_FILM].cues[0].key),
  );
});

it('opens the same film from a press on its frame', () => {
  const { container } = renderIn('en');
  const poster = container.querySelector('.tour-walkthrough__poster');
  if (!poster) {
    throw new Error('the slide has no frame');
  }
  fireEvent.click(poster);
  expect(screen.getByRole('dialog').querySelector('video')).toHaveAttribute(
    'src',
    featureFilmUrl(WALKTHROUGH_FILM, 'en'),
  );
});
