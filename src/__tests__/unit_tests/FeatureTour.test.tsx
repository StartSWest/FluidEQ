/* Copyright (C) 2026 Ivan Carmenates Garcia. SPDX-License-Identifier: GPL-3.0-or-later */

import '@testing-library/jest-dom';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { isAnalysisStyle } from 'common/graphAnalysis';
import { SELECTABLE_GRAPH_STYLES } from 'common/graphStyles';
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
      version="2.0.0"
      slides={featureTourFor('2.0.0')}
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
  expect(headings).toEqual(['NEW IN 2.0', 'NEW IN 1.7', 'ALSO IN FLUIDEQ']);
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

it('counts the graph picker’s own looks on the visualizer and Custom looks slides', () => {
  // Counted here from the picker's list rather than read from the slides'
  // helper, so a helper that counted the wrong thing would fail. The words
  // said 28 until nineteen drawn scenes joined the list.
  const free = SELECTABLE_GRAPH_STYLES.length;
  const drawn = SELECTABLE_GRAPH_STYLES.filter(
    (style) => !isAnalysisStyle(style),
  ).length;
  expect(drawn).toBeLessThan(free);

  showTour();
  goTo('Scenes that move with your music');
  expect(
    screen.getByText(new RegExp(`: ${free} free styles to shape and colour`)),
  ).toBeInTheDocument();

  goTo('Custom looks for the graph');
  expect(
    screen.getByText(new RegExp(`^${drawn} forms, each with its own controls`)),
  ).toBeInTheDocument();
  expect(
    screen.getByText(new RegExp(`Pick one of ${drawn} forms, from LED`)),
  ).toBeInTheDocument();
});

describe('the keyboard', () => {
  const tour = (isCovered: boolean) => (
    <FeatureTour
      version="2.0.0"
      slides={featureTourFor('2.0.0')}
      onClose={jest.fn()}
      onShowReleaseNotes={jest.fn()}
      onOpenTab={jest.fn()}
      isCovered={isCovered}
    />
  );

  // Marked modal, the tour used to let Tab walk out into the window behind.
  it('keeps Tab inside the tour', () => {
    render(tour(false));
    const dialog = screen.getByRole('dialog');
    const stops = dialog.querySelectorAll('button, a[href], input').length;
    for (let press = 0; press <= stops; press += 1) {
      const allowed = fireEvent.keyDown(
        document.activeElement ?? document.body,
        { key: 'Tab' },
      );
      expect(allowed).toBe(false);
      expect(dialog.contains(document.activeElement)).toBe(true);
    }
  });

  it('leaves Tab to the changelog while it stands on top', () => {
    render(tour(true));
    expect(
      fireEvent.keyDown(document.activeElement ?? document.body, {
        key: 'Tab',
      }),
    ).toBe(true);
  });

  it('gives focus back to what opened it', () => {
    const opener = document.createElement('button');
    document.body.append(opener);
    opener.focus();
    const view = render(tour(false));
    expect(opener).not.toHaveFocus();
    view.unmount();
    expect(opener).toHaveFocus();
    opener.remove();
  });
});
