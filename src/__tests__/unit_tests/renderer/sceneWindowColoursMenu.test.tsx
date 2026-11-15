/* Copyright (C) 2026 Ivan Carmenates Garcia. SPDX-License-Identifier: GPL-3.0-or-later */

/**
 * The chosen scene's three window colours under the Window colours menu
 * (Ivan, 2026-11-14: "implement that", the tuning mockup): each one
 * changeable for that scene on this computer, a dot on a changed one, the
 * badge saying whose they are, and "Use the scene's colours" back to the
 * scene's own, greyed out while there is nothing to undo.
 */

import '@testing-library/jest-dom';
import { act, fireEvent, render, screen } from '@testing-library/react';
import SceneWindowColours from 'renderer/graph/SceneWindowColours';
import {
  clearChosenWindowColours,
  getChosenWindowColours,
  resetChosenWindowColoursForTesting,
} from 'renderer/utils/sceneWindowColourStore';

const LOOK = 'premium:aurora';
const OWN = { surface: '#1d3a33', accent: '#f3a6e5', glow: '#3f7fd0' };
let mockLookId = LOOK;

jest.mock('renderer/utils/graphStyle', () => ({
  useSelectedLookId: () => mockLookId,
}));
jest.mock('renderer/utils/scenePacks', () => ({
  useUsableScenes: () => [
    {
      id: 'aurora',
      lookId: 'premium:aurora',
      version: 3,
      names: { en: 'Aurora' },
      swatch: ['#004a2e', '#009864'],
      windowColours: {
        surface: '#1d3a33',
        accent: '#f3a6e5',
        glow: '#3f7fd0',
      },
    },
  ],
}));
jest.mock('renderer/utils/memberScenes', () => ({
  useUsableMemberScenes: () => [],
}));
jest.mock('renderer/utils/I18nContext', () => ({
  useTranslation: () => ({
    locale: 'en',
    t: (key: string, vars?: Record<string, string>) =>
      vars ? `${key}:${Object.values(vars).join(',')}` : key,
  }),
}));

const picker = (role: string) =>
  screen.getByLabelText(`graph.sceneColours.pick:graph.sceneColours.${role}`);

beforeEach(() => {
  mockLookId = LOOK;
  window.localStorage.clear();
  resetChosenWindowColoursForTesting();
});

it("shows the scene's own three, its badge, and nothing to undo", () => {
  render(<SceneWindowColours />);
  expect(
    screen.getByText('graph.sceneColours.title:Aurora'),
  ).toBeInTheDocument();
  expect(screen.getByText('graph.sceneColours.own')).toBeInTheDocument();
  expect((picker('surface') as HTMLInputElement).value).toBe(OWN.surface);
  expect((picker('accent') as HTMLInputElement).value).toBe(OWN.accent);
  expect((picker('glow') as HTMLInputElement).value).toBe(OWN.glow);
  expect(
    screen.getByRole('button', { name: 'graph.sceneColours.reset' }),
  ).toBeDisabled();
});

it('keeps a colour the picker settles on for this scene, and marks it yours', () => {
  render(<SceneWindowColours />);
  const accent = picker('accent') as HTMLInputElement;
  // The picker moving changes only what is shown; settling keeps it.
  fireEvent.input(accent, { target: { value: '#ffd23f' } });
  expect(getChosenWindowColours(LOOK)).toBeUndefined();
  act(() => {
    accent.dispatchEvent(new Event('change'));
  });
  expect(getChosenWindowColours(LOOK)).toEqual({ ...OWN, accent: '#ffd23f' });
  expect(screen.getByText('graph.sceneColours.yours')).toBeInTheDocument();
  expect(accent.closest('label')).toHaveClass('is-changed');
  expect(picker('surface').closest('label')).not.toHaveClass('is-changed');
  // Kept across a launch, on this computer.
  expect(window.localStorage.getItem('fluideq.sceneWindowColours')).toContain(
    '#ffd23f',
  );
});

it("goes back to the scene's own with one press", () => {
  render(<SceneWindowColours />);
  const surface = picker('surface') as HTMLInputElement;
  fireEvent.input(surface, { target: { value: '#402020' } });
  act(() => {
    surface.dispatchEvent(new Event('change'));
  });
  const reset = screen.getByRole('button', {
    name: 'graph.sceneColours.reset',
  });
  expect(reset).toBeEnabled();
  fireEvent.click(reset);
  expect(getChosenWindowColours(LOOK)).toBeUndefined();
  expect(screen.getByText('graph.sceneColours.own')).toBeInTheDocument();
  expect((picker('surface') as HTMLInputElement).value).toBe(OWN.surface);
});

it('says when a glow is too close to red to mean "on"', () => {
  render(<SceneWindowColours />);
  expect(screen.queryByText('graph.sceneColours.glowUnused')).toBeNull();
  const glow = picker('glow') as HTMLInputElement;
  fireEvent.input(glow, { target: { value: '#ff3030' } });
  expect(screen.getByText('graph.sceneColours.glowUnused')).toBeInTheDocument();
});

it('shows nothing for a look that is not a scene', () => {
  mockLookId = 'horizon-auto';
  const { container } = render(<SceneWindowColours />);
  expect(container).toBeEmptyDOMElement();
  clearChosenWindowColours(LOOK);
});
