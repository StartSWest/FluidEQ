/* Copyright (C) 2026 Ivan Carmenates Garcia. SPDX-License-Identifier: GPL-3.0-or-later */

import '@testing-library/jest-dom';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { ANALYSIS_STYLES, isAnalysisStyle } from 'common/graphAnalysis';
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
    screen.getByRole('heading', { name: 'A new window, in new colours' }),
  ).toBeInTheDocument();
});

it('names the new look’s controls by the labels the window gives them', () => {
  const { onOpenTab } = showTour();
  // Read from the app's own labels, so a renamed slider renames the slide.
  expect(
    screen.getByText(
      'Brightness sits in the menu behind the pulse icon, and beside Transparency under Window colours.',
    ),
  ).toBeInTheDocument();
  expect(
    screen.getByText(
      /open Window colours from the graph’s bar and choose Backdrop\.$/,
    ),
  ).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Open EQ' }));
  expect(onOpenTab).toHaveBeenCalledWith('eq');
});

it('lists every view the look picker has under Analysis, by the picker’s names', () => {
  showTour();
  goTo('A graph that reads sound like a studio');
  expect(
    screen.getByText(
      /^Analyzer, Spectrogram, Third-octave RTA, Waterfall, Oscilloscope and seven more, under Analysis/,
    ),
  ).toBeInTheDocument();
  // The picture draws the picker's own list; the words say "twelve" and
  // "seven more", so a thirteenth view has to change them too.
  const drawn = document.querySelectorAll('.analyser-visual__picker li');
  expect(drawn).toHaveLength(ANALYSIS_STYLES.length);
  expect(ANALYSIS_STYLES).toHaveLength(12);
});

it('turns the window into the Compact player from its slide, closing the tour as not done', () => {
  const { onClose } = showTour();
  goTo('FluidEQ, folded into a player');
  fireEvent.click(
    screen.getByRole('button', { name: 'Try the Compact player' }),
  );
  expect(onClose).toHaveBeenCalledWith(false);
  expect(setWindowMode).toHaveBeenCalledWith('player');
});

it('shows both players the switch opens, the classic amp and the glass one', () => {
  showTour();
  goTo('FluidEQ, folded into a player');
  expect(screen.getByText('Classic amp')).toBeInTheDocument();
  // The glass player's mode is named as Window colours names it.
  expect(screen.getByText('Glass, on Backdrop')).toBeInTheDocument();
  // The switch it is made with, ringed where the title bar has it.
  expect(
    document.querySelector('.titlebar-corner__switch.is-ringed'),
  ).not.toBeNull();
});

it('names the new looks on the visualizer engine slide as the picker does', () => {
  const { onOpenTab } = showTour();
  goTo('Every visualizer on your graphics card');
  expect(
    screen.getByText(
      /^Eighteen new looks under Scenes, among them Synthwave, Horizon, Glass towers and LED wall;/,
    ),
  ).toBeInTheDocument();
  expect(
    screen.getByText(/turn from night to day with Brightness;/),
  ).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Open EQ' }));
  expect(onOpenTab).toHaveBeenCalledWith('eq');
});

it('sends the reader to the Pointer sparks switch by its own label', () => {
  showTour();
  goTo('Visualizers that answer your mouse');
  expect(
    screen.getByText(
      'One switch for every visualizer: Pointer sparks, in Window colours under Rainbow mode.',
    ),
  ).toBeInTheDocument();
  expect(
    document.querySelector('.sparks-visual__row.is-ringed'),
  ).toHaveTextContent('Pointer sparks');
});

it('shows the engine’s treble choice where the EQ mode menu has it, with its measurements', () => {
  showTour();
  goTo('Sound exactly as you drew it');
  expect(
    screen.getByText(
      'Open EQ and press EQ mode. Under Treble, choose Precise or Classic, for your EQ and for corrections separately.',
    ),
  ).toBeInTheDocument();
  // The numbers the engine was measured at, in the reader's own decimals.
  expect(screen.getByText('−3.8 dB')).toBeInTheDocument();
  expect(screen.getByText('−26 dBFS')).toBeInTheDocument();
  expect(screen.getByText('−80 dBFS')).toBeInTheDocument();
});

it('tells what a minimized game keeps and what closing it gives back', () => {
  showTour();
  goTo('Every game, its own sound');
  expect(
    screen.getByText('Minimized or alt-tabbed: its sound stays on'),
  ).toBeInTheDocument();
  expect(
    screen.getByText('Closed: your own sound comes back'),
  ).toBeInTheDocument();
  // The cards say what the desktop card says, in its own words.
  expect(screen.getByText('Back to Pop')).toBeInTheDocument();
  expect(screen.getAllByText('for Counter-Strike 2')).toHaveLength(1);
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
