/* Copyright (C) 2026 Ivan Carmenates Garcia. SPDX-License-Identifier: GPL-3.0-or-later */

/**
 * The chosen scene's three window colours under the Window colours menu
 * (Ivan, 2026-11-14: "implement that", the tuning mockup): each one
 * changeable for that scene on this computer, a dot on a changed one, the
 * badge saying whose they are, and "Use the scene's colours" back to the
 * scene's own, greyed out while there is nothing to undo.
 *
 * Each colour is a button that opens FluidEQ's own colour picker (Ivan,
 * 2026-11-18: "que maché con el estilo de Fluid ... y que tenga un botón de
 * aceptar"): the window follows the picker while it moves, Accept keeps the
 * colour, and Cancel or Escape put back the one it opened with. A press
 * outside closes nothing (c4789af21, Ivan, 2026-11-18: "it only closes with
 * Accept or Cancel").
 *
 * A scene has one set, kept at its day's point (58d70ea7e,
 * `SCENE_COLOURS_STOP`), so that is where a choice is kept.
 */

import '@testing-library/jest-dom';
import { fireEvent, render, screen, within } from '@testing-library/react';
import SceneWindowColours from 'renderer/graph/SceneWindowColours';
import { SCENE_COLOURS_STOP } from 'renderer/utils/sceneDayColours';
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

const swatch = (role: string) =>
  screen.getByRole('button', {
    name: `graph.sceneColours.pick:graph.sceneColours.${role}`,
  });

/** The colour a swatch shows, as its hex line says it. */
const shownOn = (role: string) =>
  swatch(role).querySelector('.window-colour-swatch__hex')?.textContent;

/** Opens `role`'s picker and types `hex` into it; the picker is returned. */
const pickInto = (role: string, hex: string) => {
  fireEvent.click(swatch(role));
  const picker = screen.getByRole('dialog', {
    name: `graph.sceneColours.${role}`,
  });
  fireEvent.change(within(picker).getByLabelText('graph.sceneColours.hex'), {
    target: { value: hex },
  });
  return picker;
};

beforeEach(() => {
  mockLookId = LOOK;
  window.localStorage.clear();
  resetChosenWindowColoursForTesting();
  Reflect.deleteProperty(window, 'EyeDropper');
});

it("shows the scene's own three, its badge, and nothing to undo", () => {
  render(<SceneWindowColours />);
  expect(
    screen.getByText('graph.sceneColours.title:Aurora'),
  ).toBeInTheDocument();
  expect(screen.getByText('graph.sceneColours.own')).toBeInTheDocument();
  expect(shownOn('surface')).toBe(OWN.surface.toUpperCase());
  expect(shownOn('accent')).toBe(OWN.accent.toUpperCase());
  expect(shownOn('glow')).toBe(OWN.glow.toUpperCase());
  expect(
    screen.getByRole('button', { name: 'graph.sceneColours.reset' }),
  ).toBeDisabled();
});

it('keeps the colour the picker is accepted on for this scene, and marks it yours', () => {
  render(<SceneWindowColours />);
  const picker = pickInto('accent', '#ffd23f');
  // The picker moving changes only what is shown; Accept keeps it.
  expect(shownOn('accent')).toBe('#FFD23F');
  expect(getChosenWindowColours(LOOK, SCENE_COLOURS_STOP)).toBeUndefined();
  fireEvent.click(
    within(picker).getByRole('button', { name: 'graph.sceneColours.accept' }),
  );
  expect(getChosenWindowColours(LOOK, SCENE_COLOURS_STOP)).toEqual({
    ...OWN,
    accent: '#ffd23f',
  });
  expect(screen.getByText('graph.sceneColours.yours')).toBeInTheDocument();
  expect(swatch('accent')).toHaveClass('is-changed');
  expect(swatch('surface')).not.toHaveClass('is-changed');
  // Kept across a launch, on this computer, under the day's point.
  const stored: unknown = JSON.parse(
    window.localStorage.getItem('fluideq.sceneWindowColours') ?? '{}',
  );
  expect(stored).toEqual({ [`${LOOK}@100`]: { ...OWN, accent: '#ffd23f' } });
});

it.each([
  [
    'Cancel',
    (picker: HTMLElement) =>
      fireEvent.click(
        within(picker).getByRole('button', {
          name: 'graph.sceneColours.cancel',
        }),
      ),
  ],
  ['Escape', () => fireEvent.keyDown(document, { key: 'Escape' })],
])('puts back the colour it opened with on %s', (_name, leave) => {
  render(<SceneWindowColours />);
  const picker = pickInto('accent', '#ffd23f');
  // The control: the swatch had followed the picker.
  expect(shownOn('accent')).toBe('#FFD23F');
  leave(picker);
  expect(shownOn('accent')).toBe(OWN.accent.toUpperCase());
  expect(getChosenWindowColours(LOOK, SCENE_COLOURS_STOP)).toBeUndefined();
  expect(screen.queryByRole('dialog')).toBeNull();
});

it('keeps the picker and its colour through a press outside', () => {
  render(<SceneWindowColours />);
  pickInto('accent', '#ffd23f');
  fireEvent.mouseDown(document.body);
  fireEvent.click(document.body);
  expect(
    screen.getByRole('dialog', { name: 'graph.sceneColours.accent' }),
  ).toBeInTheDocument();
  expect(shownOn('accent')).toBe('#FFD23F');
  // Nothing kept until Accept.
  expect(getChosenWindowColours(LOOK, SCENE_COLOURS_STOP)).toBeUndefined();
});

it('offers the screen’s eyedropper only where the window has one', () => {
  render(<SceneWindowColours />);
  fireEvent.click(swatch('glow'));
  expect(
    screen.queryByRole('button', { name: 'graph.sceneColours.dropper' }),
  ).toBeNull();
  fireEvent.keyDown(document, { key: 'Escape' });
  // The control: with Chromium's EyeDropper there, it is offered.
  Object.assign(window, {
    EyeDropper: jest.fn(() => ({
      open: () => Promise.resolve({ sRGBHex: '#123456' }),
    })),
  });
  fireEvent.click(swatch('glow'));
  expect(
    screen.getByRole('button', { name: 'graph.sceneColours.dropper' }),
  ).toBeInTheDocument();
});

it("goes back to the scene's own with one press", () => {
  render(<SceneWindowColours />);
  const picker = pickInto('surface', '#402020');
  fireEvent.click(
    within(picker).getByRole('button', { name: 'graph.sceneColours.accept' }),
  );
  const reset = screen.getByRole('button', {
    name: 'graph.sceneColours.reset',
  });
  expect(reset).toBeEnabled();
  fireEvent.click(reset);
  expect(getChosenWindowColours(LOOK, SCENE_COLOURS_STOP)).toBeUndefined();
  expect(screen.getByText('graph.sceneColours.own')).toBeInTheDocument();
  expect(shownOn('surface')).toBe(OWN.surface.toUpperCase());
});

it('says when a glow is too close to red to mean "on", and that the accent says it', () => {
  render(<SceneWindowColours />);
  expect(screen.queryByText('graph.sceneColours.glowUnusedAccent')).toBeNull();
  // The scene names its colours, so they are worn as named, where the
  // accent stands in for "on" (`pickedWindow`) - not FluidEQ's own.
  pickInto('glow', '#ff3030');
  expect(
    screen.getByText('graph.sceneColours.glowUnusedAccent'),
  ).toBeInTheDocument();
  expect(screen.queryByText('graph.sceneColours.glowUnused')).toBeNull();
});

it('shows nothing for a look that is not a scene', () => {
  mockLookId = 'horizon-auto';
  const { container } = render(<SceneWindowColours />);
  expect(container).toBeEmptyDOMElement();
  clearChosenWindowColours(LOOK);
});
