/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * The EQ mode settings beside the graph (Ivan, 2026-10-06: "when that eq mode
 * windows is open I cannot see the curves", then mockup A, "it needs to open
 * the side menu if closed", and "I can see the modal there" when it was only
 * offered behind a pin). The EQ page's button and the sound panel's card are
 * mounted side by side here, as the shell mounts them.
 */

import '@testing-library/jest-dom';
import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { useRef } from 'react';
import EqModeCard from 'renderer/components/eqMode/EqModeCard';
import EqPageModeSelect from 'renderer/components/eqMode/EqPageModeSelect';
import {
  resetEqModePinForTesting,
  takeEqModeReveal,
} from 'renderer/utils/eqModePin';
import { subscribeSoundPaneRequests } from 'renderer/utils/soundPane';
import { refreshTrebleDesigns } from 'renderer/utils/useTrebleDesigns';

const mockSetMode = jest.fn().mockResolvedValue(undefined);
const mockRefresh = jest.fn().mockResolvedValue(undefined);

jest.mock('renderer/utils/trebleDesignApi', () => ({
  getTrebleDesigns: async () => ({ eq: 'precise', curves: 'precise' }),
  setTrebleDesign: jest.fn(),
}));
// Answered before any case renders, so no case's first mount re-renders
// outside act when the answer lands.
beforeAll(() => refreshTrebleDesigns());
jest.mock('renderer/utils/FluidEqContext', () => ({
  ...jest.requireActual('__tests__/utils/fluidEqHookMocks').eqHooksFrom(() => ({
    isEqDoubleOn: false,
    isBlockingError: false,
    refreshState: mockRefresh,
    setGlobalError: jest.fn(),
  })),
}));
jest.mock('renderer/utils/equalizerApi', () => ({
  resetEqMode: jest.fn().mockResolvedValue(undefined),
  setEqMode: (...args: unknown[]) => mockSetMode(...args),
  setEqShape: jest.fn().mockResolvedValue(undefined),
}));
jest.mock('renderer/utils/useCurvePhase', () => ({
  __esModule: true,
  default: () => ({ status: undefined, select: jest.fn() }),
}));

/** The panel's scroll, as `SoundPanel` hands it to the card. */
const Panel = ({
  isPaneShown,
  withButton = true,
}: {
  isPaneShown: boolean;
  withButton?: boolean;
}) => {
  const scrollRef = useRef<HTMLDivElement>(null);
  return (
    <>
      {withButton && <EqPageModeSelect />}
      <div ref={scrollRef} data-testid="panel">
        <EqModeCard isPaneShown={isPaneShown} scrollRef={scrollRef} />
      </div>
    </>
  );
};

const showButton = () =>
  screen.getByRole('button', { name: 'Show EQ mode beside the graph' });
const card = () => document.querySelector('.eq-mode-card');
const tab = (name: string) => screen.getByRole('tab', { name });
const panelOf = (name: string) =>
  document.getElementById(tab(name).getAttribute('aria-controls') ?? '');

let paneRequests = 0;
let stopListening: () => void;

beforeEach(() => {
  jest.clearAllMocks();
  window.localStorage.clear();
  resetEqModePinForTesting();
  takeEqModeReveal();
  paneRequests = 0;
  stopListening = subscribeSoundPaneRequests(() => {
    paneRequests += 1;
  });
});
afterEach(() => stopListening());

it('stands beside the graph, not in a menu, until somebody puts it back', () => {
  render(<Panel isPaneShown />);
  expect(showButton()).not.toHaveAttribute('aria-haspopup');
  expect(card()).toBeInTheDocument();
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  expect(screen.getByRole('tablist', { name: 'EQ mode' })).toBeInTheDocument();
  expect(tab('Your EQ')).toHaveAttribute('aria-selected', 'true');
  expect(tab('Corrections')).toHaveAttribute('aria-selected', 'false');
});

it('stands only while the EQ page’s button is on screen', () => {
  const { rerender } = render(<Panel isPaneShown withButton={false} />);
  expect(card()).not.toBeInTheDocument();
  // CONTROL: the same panel with the page's button beside it.
  rerender(<Panel isPaneShown />);
  expect(card()).toBeInTheDocument();
  rerender(<Panel isPaneShown withButton={false} />);
  expect(card()).not.toBeInTheDocument();
});

it('shows one group at a time and keeps the other out of reach', () => {
  render(<Panel isPaneShown />);
  const yours = panelOf('Your EQ');
  const corrections = panelOf('Corrections');
  expect(yours).not.toHaveAttribute('inert');
  expect(corrections).toHaveAttribute('inert');
  // Smoothing is a Corrections row only.
  expect(
    within(corrections as HTMLElement).getByRole('group', {
      name: 'Corrections · Curve smoothing',
    }),
  ).toBeInTheDocument();
  expect(
    within(yours as HTMLElement).queryByRole('group', {
      name: /Curve smoothing/,
    }),
  ).not.toBeInTheDocument();
  fireEvent.click(tab('Corrections'));
  expect(tab('Corrections')).toHaveAttribute('aria-selected', 'true');
  expect(corrections).not.toHaveAttribute('inert');
  expect(yours).toHaveAttribute('inert');
});

it('moves between the groups with the arrows, as a tab row does', () => {
  render(<Panel isPaneShown />);
  tab('Your EQ').focus();
  fireEvent.keyDown(tab('Your EQ'), { key: 'ArrowRight' });
  expect(tab('Corrections')).toHaveAttribute('aria-selected', 'true');
  expect(tab('Corrections')).toHaveFocus();
  fireEvent.keyDown(tab('Corrections'), { key: 'ArrowRight' });
  expect(tab('Your EQ')).toHaveFocus();
  fireEvent.keyDown(tab('Your EQ'), { key: 'End' });
  expect(tab('Corrections')).toHaveFocus();
  fireEvent.keyDown(tab('Corrections'), { key: 'Home' });
  expect(tab('Your EQ')).toHaveFocus();
  // Only the group on show is a stop on Tab.
  expect(tab('Your EQ')).toHaveAttribute('tabindex', '0');
  expect(tab('Corrections')).toHaveAttribute('tabindex', '-1');
});

it('writes a choice as the menu does', async () => {
  render(<Panel isPaneShown />);
  await act(async () =>
    fireEvent.click(
      within(
        screen.getByRole('group', { name: 'Your EQ' }) as HTMLElement,
      ).getByRole('button', { name: 'Studio · ×1.5' }),
    ),
  );
  expect(mockSetMode).toHaveBeenCalledWith('studio', 'eq');
  expect(mockRefresh).toHaveBeenCalled();
});

it('asks for the panel, and brings the card into view once the panel is on screen', () => {
  const { rerender } = render(<Panel isPaneShown={false} />);
  expect(card()).not.toHaveClass('is-arriving');
  fireEvent.click(showButton());
  expect(paneRequests).toBe(1);
  // The panel is still folded: nothing to look at, nothing focused yet.
  expect(tab('Your EQ')).not.toHaveFocus();
  expect(card()).not.toHaveClass('is-arriving');
  rerender(<Panel isPaneShown />);
  expect(tab('Your EQ')).toHaveFocus();
  expect(card()).toHaveClass('is-arriving');
});

it('opens the card again when it was folded away', () => {
  render(<Panel isPaneShown />);
  const header = () => screen.getByRole('button', { name: /^EQ mode/ });
  fireEvent.click(header());
  expect(header()).toHaveAttribute('aria-expanded', 'false');
  fireEvent.click(showButton());
  expect(header()).toHaveAttribute('aria-expanded', 'true');
});

it('goes back into the menu, its button taking the focus, and pins from there', () => {
  render(<Panel isPaneShown />);
  fireEvent.click(screen.getByRole('button', { name: 'Put back in the menu' }));
  expect(card()).not.toBeInTheDocument();
  const menuButton = screen.getByRole('button', { name: 'EQ mode' });
  expect(menuButton).toHaveAttribute('aria-haspopup', 'dialog');
  expect(menuButton).toHaveFocus();
  expect(window.localStorage.getItem('fluideq.eqModePinned')).toBe('false');
  expect(paneRequests).toBe(0);

  fireEvent.click(menuButton);
  fireEvent.click(
    within(screen.getByRole('dialog')).getByRole('button', {
      name: 'Pin beside the graph',
    }),
  );
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  expect(card()).toBeInTheDocument();
  expect(tab('Your EQ')).toHaveFocus();
  expect(paneRequests).toBe(1);
  expect(window.localStorage.getItem('fluideq.eqModePinned')).toBe('true');
});
