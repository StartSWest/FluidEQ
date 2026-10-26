/* Copyright (C) 2026 Ivan Carmenates Garcia. SPDX-License-Identifier: GPL-3.0-or-later */

import '@testing-library/jest-dom';
import {
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from '@testing-library/react';
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

const showTour = (version = '2.0.0') => {
  const onClose = jest.fn();
  const onOpenTab = jest.fn();
  render(
    <FeatureTour
      version={version}
      slides={featureTourFor(version)}
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

it('opens 2.1 on every output keeping its own sound, with 2.0 still new', () => {
  showTour('2.1.0');
  const headings = Array.from(
    document.querySelectorAll('.feature-tour__rail-heading'),
    (heading) => heading.textContent,
  );
  expect(headings).toEqual(['NEW IN 2.1', 'NEW IN 2.0', 'ALSO IN FLUIDEQ']);
  expect(
    screen.getByRole('heading', { name: 'Every output keeps its own sound' }),
  ).toBeInTheDocument();
});

it('names 2.1’s controls by the labels the window gives them', () => {
  const { onOpenTab } = showTour('2.1.0');
  expect(
    screen.getByText(
      'Open EQ and pick an output under Output on the right: whatever you set from then on stays with it. For a second one, switch it on under Second output and press Edit sound.',
    ),
  ).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Open EQ' }));
  expect(onOpenTab).toHaveBeenCalledWith('eq');

  goTo('Every band’s numbers, right on the graph');
  expect(
    screen.getByText(
      'Open EQ, choose View → Everything above the graph (or press Ctrl+W) and move a band: its numbers follow it. EQ mode waits at the top of the panel on the right.',
    ),
  ).toBeInTheDocument();
  expect(
    screen.getByText(
      'EQ mode is the first card of the side panel, with Your EQ and Corrections a tab each. Its button above the graph brings the card into view.',
    ),
  ).toBeInTheDocument();

  goTo('Songs that remember how you like them');
  expect(
    screen.getByText(
      'Open EQ and switch on Remember each song’s sound in Output on the right. Play a song, pick a preset or turn the Tone, then let it finish or skip it.',
    ),
  ).toBeInTheDocument();
  expect(
    screen.getByText(
      'It comes back with a notice that names the song and what it brought, with Undo and Forget this song right there.',
    ),
  ).toBeInTheDocument();
});

it('sends the reader to each ear’s split by the band menu’s own words', () => {
  const { onOpenTab } = showTour('2.1.0');
  goTo('Tune each ear on its own');
  expect(
    screen.getByText(
      'Open EQ, right-click a band on the graph and choose Left + right. The DSP rack’s EQ has the same menu while it applies to Stereo.',
    ),
  ).toBeInTheDocument();
  expect(
    screen.getByText(
      'Both ears joins the two again in their middle, halfway in frequency and gain. Reset band and Clear EQ join them too.',
    ),
  ).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Open EQ' }));
  expect(onOpenTab).toHaveBeenCalledWith('eq');
});

it('shows My curves with the page’s own parts and lands on EQ Presets', () => {
  const { onOpenTab } = showTour('2.1.0');
  goTo('Your own list of curves, beside OPRA’s');
  expect(
    screen.getByText(
      'Open EQ Presets under EQ, choose My curves and press Add curve.',
    ),
  ).toBeInTheDocument();
  expect(
    screen.getByText(
      'Apply as curve plays a curve as the headphone correction, with its own strength and switch; Apply as EQ puts its bands in your EQ instead.',
    ),
  ).toBeInTheDocument();
  expect(
    screen.getByText(
      'The Squiglink shortcut in My curves opens the import preview; Save to My curves keeps your curve for later.',
    ),
  ).toBeInTheDocument();
  // The picture is the page's own rows, each drawing its own curve: the
  // list before and the list after a curve is saved from Squiglink.
  const picture = screen.getByRole('img', {
    name: /The EQ Presets page on My curves/,
  });
  expect(picture).toHaveAttribute('inert');
  const turns = Array.from(picture.querySelectorAll('.my-curves-visual__turn'));
  // Each row draws its own curve, and one of them is playing.
  expect(
    turns.map((turn) => [
      turn.querySelectorAll('.my-curve').length,
      turn.querySelectorAll('.my-curve__line').length,
      turn.querySelectorAll('.my-curve.is-playing').length,
      turn.querySelector('.autoeq-panel__tab-count')?.textContent,
    ]),
  ).toEqual([
    [4, 4, 1, '4'],
    [5, 5, 1, '5'],
  ]);
  // After: the curve just saved is at the head of the list, and playing.
  const after = turns[1].querySelector('.my-curve');
  expect(after).toHaveClass('is-playing');
  expect(after).toHaveTextContent(/^Squiglink curve, /);
  fireEvent.click(screen.getByRole('button', { name: 'Open EQ Presets' }));
  expect(onOpenTab).toHaveBeenCalledWith('presets');
});

it('names the De-esser and the chains that switch it on as the rack does', () => {
  const { onOpenTab } = showTour('2.1.0');
  goTo('A De-esser in the DSP rack');
  expect(
    screen.getByText(
      'Speech, Podcast and Audiobook switch it on. Every filter of the rack can now save profiles of your own.',
    ),
  ).toBeInTheDocument();
  expect(
    screen.getByText(
      'Open DSP and choose De-esser in the list on the left, or pick Podcast. Start from a profile, then raise Sensitivity until each S is caught.',
    ),
  ).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Open DSP' }));
  expect(onOpenTab).toHaveBeenCalledWith('dsp');
});

it('reads each band out as the graph does, a cut with a real minus', () => {
  showTour('2.1.0');
  goTo('Every band’s numbers, right on the graph');
  // The 250 Hz band is a cut, and its label hangs below its point.
  const cut = screen.getByText('250 Hz').closest('.bands-visual__band');
  expect(cut).toHaveClass('is-below');
  expect(cut).toHaveTextContent('250 HzQ 1.2−2.0 dB');
});

it('sends a second output’s sound to the button that changes it', () => {
  showTour('2.1.0');
  goTo('Second-output profiles');
  expect(
    screen.getByText(
      'Choose one of its saved profiles under the device, or press Edit sound beside it to change its sound without switching the main output. The main output keeps its tuning.',
    ),
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
  // The words say "twelve" and "seven more", and the slide's photograph shows
  // the picker listing twelve, so a thirteenth view has to change the words
  // and retake the picture too.
  expect(ANALYSIS_STYLES).toHaveLength(12);
  expect(
    screen.getByRole('img', {
      name: /^The graph’s Analyzer on a playing song/,
    }),
  ).toBeInTheDocument();
});

it('turns the window into the Compact player from its slide, closing the tour as not done', () => {
  const { onClose } = showTour();
  goTo('The whole app in one column');
  fireEvent.click(
    screen.getByRole('button', { name: 'Try the Compact player' }),
  );
  expect(onClose).toHaveBeenCalledWith(false);
  expect(setWindowMode).toHaveBeenCalledWith('player');
});

// One player since 2.1 (Ivan, 2026-10-25), shown twice: over a scene and
// with a standard visualizer, its parts named as the player names them.
it('shows the one player the switch opens, over a scene and over a standard visualizer', () => {
  showTour();
  goTo('The whole app in one column');
  // The Backdrop is named as Window colours names it.
  expect(screen.getByText('With a scene, on Backdrop')).toBeInTheDocument();
  expect(screen.getByText('With a standard visualizer')).toBeInTheDocument();
  expect(
    screen.getByRole('img', { name: /and the Compact player twice:/ }),
  ).toBeInTheDocument();
  expect(
    screen.getByText(/^Sound holds the Bass, Mid and Treble knobs/),
  ).toBeInTheDocument();
  expect(
    screen.getByText(/^Up next and Playlists wait at the foot\./),
  ).toBeInTheDocument();
  // No film: the one it had shows the two players this one replaced.
  expect(screen.queryByRole('button', { name: 'Watch the video' })).toBeNull();
  // The switch it is made with, ringed where the title bar has it.
  expect(
    document.querySelector('.titlebar-corner__switch.is-ringed'),
  ).not.toBeNull();
});

// Drawn by the player's own parts, not photographed (Ivan, 2026-10-26:
// "make help use the app code for UI instead of pictures so it's easy to
// update"): its words are the reader's language and its levels its own
// faders' and knobs', and nothing in it can be reached.
it('draws the player from its own parts, out of reach of the keyboard and of screen readers', () => {
  showTour();
  goTo('The whole app in one column');
  const amps = document.querySelector('.player-pair__amps') as HTMLElement;
  expect(amps).toHaveAttribute('inert');
  expect(amps).toHaveAttribute('aria-hidden', 'true');
  const players = amps.querySelectorAll('.player-picture > .mini-player');
  expect(players).toHaveLength(2);
  // Over a scene on the Backdrop, and with a standard look in its panel.
  expect(players[0]).toHaveClass('is-backdrop');
  expect(players[1]).not.toHaveClass('is-backdrop');
  const scene = within(players[0] as HTMLElement);
  const look = within(players[1] as HTMLElement);
  // The player's own words, as the player reads them out.
  expect(scene.getByText('Sound')).toBeInTheDocument();
  expect(scene.getByText('Up next')).toBeInTheDocument();
  expect(scene.getByText('FluidEQ Engine on')).toBeInTheDocument();
  // Its faders, printing their own levels, and its Tone knobs.
  expect(scene.getByText('+3.5')).toBeInTheDocument();
  expect(
    scene.getByRole('slider', { hidden: true, name: '32 Hz' }),
  ).toHaveAttribute('aria-valuenow', '3.5');
  expect(look.getByText('Bass')).toBeInTheDocument();
  expect(look.getByText('Treble')).toBeInTheDocument();
  // The made-up song playing, in both.
  expect(scene.getAllByText('Afterglow Avenue').length).toBeGreaterThan(0);
  expect(look.getAllByText('Afterglow Avenue').length).toBeGreaterThan(0);
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
      'One switch for every visualizer: Pointer sparks, in Window colours under Colourful mode.',
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
