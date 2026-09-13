/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * What a scene does to the window — the theme, its colours, or its colours
 * with its light around it — chosen on the graph and in the Studio, and what
 * somebody who had the old on/off switch gets on their first launch with it.
 */

import '@testing-library/jest-dom';
import type * as TestingLibrary from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ReactElement } from 'react';

jest.mock('../../../renderer/utils/I18nContext', () => ({
  useTranslation: () => ({
    locale: 'en',
    t: (key: string, vars?: Record<string, string>) =>
      vars ? `${key}(${Object.values(vars).join('|')})` : key,
  }),
}));

type TStore = typeof import('../../../renderer/utils/sceneTintStore');

let library: typeof TestingLibrary | undefined;

afterEach(() => {
  library?.cleanup();
  library = undefined;
  window.localStorage.clear();
});

/** The store, the switches and a renderer, from a registry loaded after `stored`. */
const load = (stored: Record<string, string> = {}) => {
  Object.entries(stored).forEach(([key, value]) =>
    window.localStorage.setItem(key, value),
  );
  let store: TStore | undefined;
  let Toggle: (() => ReactElement) | undefined;
  let Tiles: (() => ReactElement) | undefined;
  jest.isolateModules(() => {
    /* eslint-disable global-require */
    library = require('@testing-library/react/pure');
    store = require('../../../renderer/utils/sceneTintStore');
    Toggle = require('../../../renderer/graph/SceneTintToggle').default;
    Tiles = require('../../../renderer/studio/StudioTintSwitch').default;
    /* eslint-enable global-require */
  });
  if (!store || !Toggle || !Tiles || !library) {
    throw new Error('the tint modules did not load');
  }
  return { store, Toggle, Tiles, library };
};

describe('the modes a launch starts in', () => {
  it('lends the graph’s scene its colours and leaves the Studio on the theme, for somebody new', () => {
    const { store, library: fresh } = load();
    const { result } = fresh.renderHook(() => ({
      graph: store.useSceneTintMode(),
      studio: store.useStudioTintMode(),
    }));
    expect(result.current).toEqual({ graph: 'tint', studio: 'off' });
  });

  it.each([
    ['true', 'tint'],
    ['false', 'off'],
  ])('keeps the old graph switch set to %s as %s', (legacy, mode) => {
    const { store, library: fresh } = load({ 'fluideq.sceneTint': legacy });
    const { result } = fresh.renderHook(() => store.useSceneTintMode());
    expect(result.current).toBe(mode);
  });

  it('keeps the old Studio switch that was on as the colours', () => {
    const { store, library: fresh } = load({ 'fluideq.studioTint': 'true' });
    const { result } = fresh.renderHook(() => store.useStudioTintMode());
    expect(result.current).toBe('tint');
  });

  it('prefers a mode chosen since over the old switch, and remembers a new choice', () => {
    const { store, library: fresh } = load({
      'fluideq.sceneTint': 'false',
      'fluideq.sceneTintMode': 'pulse',
    });
    const { result } = fresh.renderHook(() => store.useSceneTintMode());
    expect(result.current).toBe('pulse');
    fresh.act(() => store.setSceneTintMode('tint'));
    expect(result.current).toBe('tint');
    expect(window.localStorage.getItem('fluideq.sceneTintMode')).toBe('tint');
  });
});

describe('the graph’s button', () => {
  it('walks the three modes in order, naming the one it is in and the next', async () => {
    const { Toggle, library: fresh } = load({ 'fluideq.sceneTintMode': 'off' });
    fresh.render(<Toggle />);
    const button = () => fresh.screen.getByRole('button');
    expect(button()).toHaveAttribute('aria-pressed', 'false');
    expect(button()).toHaveAccessibleName(
      'graph.sceneTint.cycle(graph.sceneTint.mode.off|graph.sceneTint.mode.tint)',
    );
    await userEvent.click(button());
    expect(button()).toHaveAttribute('aria-pressed', 'true');
    expect(button().querySelector('svg')).toHaveAttribute('data-mode', 'tint');
    await userEvent.click(button());
    expect(button()).toHaveAccessibleName(
      'graph.sceneTint.cycle(graph.sceneTint.mode.pulse|graph.sceneTint.mode.off)',
    );
    expect(button().querySelector('svg')).toHaveAttribute('data-mode', 'pulse');
    await userEvent.click(button());
    expect(button()).toHaveAttribute('aria-pressed', 'false');
    expect(window.localStorage.getItem('fluideq.sceneTintMode')).toBe('off');
  });
});

describe('the Studio’s tiles', () => {
  it('shows all three at once, the chosen one pressed, each named in a word', async () => {
    const { Tiles, library: fresh } = load();
    fresh.render(<Tiles />);
    const tiles = fresh.screen.getAllByRole('button');
    expect(tiles.map((tile) => tile.textContent)).toEqual([
      'graph.sceneTint.short.off',
      'graph.sceneTint.short.tint',
      'graph.sceneTint.short.pulse',
    ]);
    expect(tiles.map((tile) => tile.getAttribute('aria-pressed'))).toEqual([
      'true',
      'false',
      'false',
    ]);
    await userEvent.click(
      fresh.screen.getByRole('button', { name: 'graph.sceneTint.mode.pulse' }),
    );
    expect(
      fresh.screen.getByRole('button', { name: 'graph.sceneTint.mode.pulse' }),
    ).toHaveAttribute('aria-pressed', 'true');
    expect(window.localStorage.getItem('fluideq.studioTintMode')).toBe('pulse');
  });
});
