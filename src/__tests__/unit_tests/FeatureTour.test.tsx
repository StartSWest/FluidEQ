/* Copyright (C) 2026 Ivan Carmenates Garcia. SPDX-License-Identifier: GPL-3.0-or-later */

import '@testing-library/jest-dom';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import FeatureTour from 'renderer/components/featureTour/FeatureTour';
import { featureTourFor } from 'renderer/components/featureTour/slides';
import { requestHelpGuide } from 'renderer/help/helpGuideRequests';
import { setWindowMode } from 'renderer/player/windowModeStore';

jest.mock('renderer/player/windowModeStore', () => ({
  setWindowMode: jest.fn(() => Promise.resolve()),
}));
jest.mock('renderer/help/helpGuideRequests', () => ({
  requestHelpGuide: jest.fn(),
}));

afterEach(() => {
  cleanup();
  jest.clearAllMocks();
});

const showTour = () => {
  const onClose = jest.fn();
  const onOpenTab = jest.fn();
  render(
    <FeatureTour
      version="1.8.0"
      slides={featureTourFor('1.8.0')}
      onClose={onClose}
      onShowReleaseNotes={jest.fn()}
      onOpenTab={onOpenTab}
      isCovered={false}
    />,
  );
  return { onClose, onOpenTab };
};

/** The rail entry whose title is `title` (its name also holds its number). */
const goTo = (title: string) =>
  fireEvent.click(screen.getByRole('button', { name: new RegExp(title) }));

it('heads each release it shows as new with its own number, then the rest', () => {
  showTour();
  const headings = Array.from(
    document.querySelectorAll('.feature-tour__rail-heading'),
    (heading) => heading.textContent,
  );
  expect(headings).toEqual(['NEW IN 1.8', 'NEW IN 1.7', 'ALSO IN FLUIDEQ']);
  expect(
    screen.getByRole('heading', { name: 'FluidEQ, folded into a player' }),
  ).toBeInTheDocument();
});

it('turns the window into the Compact player from its slide, closing the tour as not done', () => {
  const { onClose } = showTour();
  fireEvent.click(
    screen.getByRole('button', { name: 'Try the Compact player' }),
  );
  expect(onClose).toHaveBeenCalledWith(false);
  expect(setWindowMode).toHaveBeenCalledWith('player');
});

it('opens the guide from the Help slide', () => {
  const { onClose } = showTour();
  goTo('Ask the guide in your own words');
  fireEvent.click(screen.getByRole('button', { name: 'Open Help' }));
  expect(onClose).toHaveBeenCalledWith(false);
  expect(requestHelpGuide).toHaveBeenCalledTimes(1);
});

it('lands on the Game presets page from its slide', () => {
  const { onOpenTab } = showTour();
  goTo('Every game, its own sound');
  fireEvent.click(screen.getByRole('button', { name: 'Open Game presets' }));
  expect(onOpenTab).toHaveBeenCalledWith('games');
});

it('quotes the catalogue’s own counts on the presets slide', () => {
  showTour();
  goTo('Presets that sound like the music');
  // Counted from the catalogue, never typed: a number in a sentence is how
  // "nine stages" outlived the tenth.
  expect(
    screen.getByText(/^\d+ chains, \d+ of them music styles/),
  ).toBeInTheDocument();
});
