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
  let Menu: (() => ReactElement) | undefined;
  let Tiles: (() => ReactElement) | undefined;
  jest.isolateModules(() => {
    /* eslint-disable global-require */
    library = require('@testing-library/react/pure');
    store = require('../../../renderer/utils/sceneTintStore');
    Menu = require('../../../renderer/graph/SceneTintMenu').default;
    Tiles = require('../../../renderer/studio/StudioTintSwitch').default;
    /* eslint-enable global-require */
  });
  if (!store || !Menu || !Tiles || !library) {
    throw new Error('the tint modules did not load');
  }
  return { store, Menu, Tiles, library };
};

/** The four modes, apart from the menu's other choices (what Daylight follows). */
const modeChoices = (fresh: typeof TestingLibrary) =>
  fresh
    .within(
      fresh.screen.getByRole('radiogroup', { name: 'graph.sceneTint.label' }),
    )
    .getAllByRole('radio');

describe('the modes a launch starts in', () => {
  it('starts the whole app on the Backdrop, the Studio included, for somebody new', () => {
    const { store, library: fresh } = load();
    const { result } = fresh.renderHook(() => store.useSceneTintMode());
    expect(result.current).toBe('cover');
  });

  it('keeps a mode chosen before the default changed', () => {
    const { store, library: fresh } = load({ 'fluideq.sceneTintMode': 'tint' });
    const { result } = fresh.renderHook(() => store.useSceneTintMode());
    expect(result.current).toBe('tint');
  });

  it.each([
    ['true', 'tint'],
    ['false', 'off'],
  ])('keeps the old graph switch set to %s as %s', (legacy, mode) => {
    const { store, library: fresh } = load({ 'fluideq.sceneTint': legacy });
    const { result } = fresh.renderHook(() => store.useSceneTintMode());
    expect(result.current).toBe(mode);
  });

  // The Studio once kept a mode of its own, which started on the theme; it
  // follows the app's one mode now, and what an earlier version stored for it
  // is not read.
  it('ignores a mode an earlier version stored for the Studio alone', () => {
    const { store, library: fresh } = load({
      'fluideq.studioTintMode': 'off',
      'fluideq.studioTint': 'false',
    });
    const { result } = fresh.renderHook(() => store.useSceneTintMode());
    expect(result.current).toBe('cover');
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

describe('the graph’s menu', () => {
  // Named, because a glyph walking four modes kept Ambient and the Backdrop
  // out of sight (Ivan, 2026-09-25: "a tiny icon that can pass desapercibido").
  it('names the mode on its button and offers all four, each said in a line', async () => {
    const { Menu, library: fresh } = load({ 'fluideq.sceneTintMode': 'pulse' });
    fresh.render(<Menu />);
    const button = fresh.screen.getByRole('button', {
      name: 'graph.sceneTint.label',
    });
    expect(button).toHaveTextContent('graph.sceneTint.short.pulse');
    expect(fresh.screen.queryByRole('radio')).toBeNull();

    await userEvent.click(button);
    const choices = modeChoices(fresh);
    expect(choices).toHaveLength(4);
    expect(choices[0]).toHaveTextContent('graph.sceneTint.short.off');
    expect(choices[3]).toHaveTextContent('graph.sceneTint.short.cover');
    expect(choices[3]).toHaveTextContent('graph.sceneTint.about.cover');
    expect(choices[2]).toHaveAttribute('aria-checked', 'true');
  });

  it('puts the window in the mode picked, remembers it, and stays open', async () => {
    const {
      Menu,
      store,
      library: fresh,
    } = load({
      'fluideq.sceneTintMode': 'off',
    });
    fresh.render(<Menu />);
    const { result } = fresh.renderHook(() => store.useSceneTintMode());
    await userEvent.click(
      fresh.screen.getByRole('button', { name: 'graph.sceneTint.label' }),
    );
    await userEvent.click(modeChoices(fresh)[3]);
    expect(result.current).toBe('cover');
    expect(window.localStorage.getItem('fluideq.sceneTintMode')).toBe('cover');
    expect(
      fresh.screen.getByRole('button', { name: 'graph.sceneTint.label' }),
    ).toHaveTextContent('graph.sceneTint.short.cover');
    // Open still: the chosen mode's sliders are what comes next.
    expect(modeChoices(fresh)[3]).toHaveAttribute('aria-checked', 'true');
  });

  // Two sliders at the head of the menu in every mode, Brightness and
  // Transparency (Ivan, 2026-09-25: "in total I want only two options
  // brightness and transparency"), and Transparency only moves under the
  // Backdrop with a Plus visualizer chosen: the one arrangement with a scene
  // behind the panes to see through to (`useIsBackdrop`).
  it.each([
    ['off', false],
    ['tint', false],
    ['pulse', false],
    ['cover', true],
  ])(
    'under %s with a Plus visualizer offers Brightness, Daylight, and Transparency live: %s',
    async (mode, isLive) => {
      const { Menu, library: fresh } = load({
        'fluideq.sceneTintMode': mode,
        'fluideq-graph-style': 'premium:bloom',
      });
      fresh.render(<Menu />);
      await userEvent.click(
        fresh.screen.getByRole('button', { name: 'graph.sceneTint.label' }),
      );
      expect(
        fresh.screen
          .queryAllByRole('slider')
          .map((slider) => slider.getAttribute('aria-label')),
      ).toEqual([
        'graph.sceneTint.brightness',
        'graph.backdropVeil',
        'graph.sceneTint.daylight',
      ]);
      expect(
        fresh.screen.getByRole('slider', {
          name: 'graph.sceneTint.brightness',
        }),
      ).toBeEnabled();
      // The scene's time of day follows Brightness until its switch is
      // turned off, and its slider stands still while it does.
      expect(
        fresh.screen.getByRole('slider', { name: 'graph.sceneTint.daylight' }),
      ).toBeDisabled();
      expect(
        fresh.screen
          .getByRole('slider', { name: 'graph.backdropVeil' })
          .matches(':disabled'),
      ).toBe(!isLive);
    },
  );

  // With a standard visualizer there is nothing behind the panes to see
  // through to, so Transparency's place holds the window's Tint, live in
  // every mode (Ivan, 2026-10-25: "instead of showing transparency disabled
  // we show the tint").
  it.each(['off', 'cover'])(
    'under %s with a standard visualizer offers the Tint in Transparency’s place',
    async (mode) => {
      const { Menu, library: fresh } = load({ 'fluideq.sceneTintMode': mode });
      fresh.render(<Menu />);
      await userEvent.click(
        fresh.screen.getByRole('button', { name: 'graph.sceneTint.label' }),
      );
      expect(
        fresh.screen
          .queryAllByRole('slider')
          .map((slider) => slider.getAttribute('aria-label')),
      ).toEqual([
        'graph.sceneTint.brightness',
        'graph.windowTint',
        'graph.sceneTint.daylight',
      ]);
      expect(
        fresh.screen.getByRole('slider', { name: 'graph.windowTint' }),
      ).toBeEnabled();
    },
  );

  // One row of three under the Daylight slider, where two switches stood
  // that were only ever on one at a time (Ivan, 2026-10-25: "too many
  // options", "let's simplify this on both sides").
  it('says what the time of day follows in one choice of three, and frees its slider on Off', async () => {
    const { Menu, library: fresh } = load({
      'fluideq-graph-style': 'premium:bloom',
    });
    fresh.render(<Menu />);
    await userEvent.click(
      fresh.screen.getByRole('button', { name: 'graph.sceneTint.label' }),
    );
    const daylight = () =>
      fresh.screen.getByRole('slider', { name: 'graph.sceneTint.daylight' });
    const sources = () =>
      fresh.within(
        fresh.screen.getByRole('radiogroup', {
          name: 'graph.sceneTint.daylightSource',
        }),
      );
    const source = (name: string) => sources().getByRole('radio', { name });
    expect(sources().getAllByRole('radio')).toHaveLength(3);
    expect(source('graph.sceneTint.daylightSourceBrightness')).toHaveAttribute(
      'aria-checked',
      'true',
    );
    expect(daylight()).toBeDisabled();

    await userEvent.click(source('graph.sceneTint.daylightSourceClock'));
    expect(source('graph.sceneTint.daylightSourceClock')).toHaveAttribute(
      'aria-checked',
      'true',
    );
    expect(source('graph.sceneTint.daylightSourceBrightness')).toHaveAttribute(
      'aria-checked',
      'false',
    );
    expect(daylight()).toBeDisabled();

    await userEvent.click(source('graph.sceneTint.daylightSourceOwn'));
    expect(daylight()).toBeEnabled();
    // Left where the clock had put it, as a whole percent.
    const value = Number(daylight().getAttribute('aria-valuenow'));
    expect(Number.isInteger(value)).toBe(true);
  });
});

describe('the Studio’s tiles', () => {
  // The Studio's own choice, never the app's (Ivan, 2026-09-27: "the studio
  // options are independent of the global ones"): Theme, and the app's
  // Colours and Ambient with the project on the bench as the scene — not its
  // Backdrop, which has no graph to stand behind there (2026-09-28: "remove
  // backdrop option from studio only"). Neither sets the other.
  it('shows all three at once, the Studio’s own mode pressed, each named in a word', async () => {
    const { Tiles, library: fresh } = load();
    fresh.render(<Tiles />);
    const tiles = fresh.screen.getAllByRole('button');
    expect(tiles.map((tile) => tile.textContent)).toEqual([
      'studio.tint.theme',
      'graph.sceneTint.short.tint',
      'graph.sceneTint.short.pulse',
    ]);
    // Theme for somebody new, whatever the app's mode is (Ambient).
    expect(tiles.map((tile) => tile.getAttribute('aria-pressed'))).toEqual([
      'true',
      'false',
      'false',
    ]);
    await userEvent.click(
      fresh.screen.getByRole('button', { name: 'graph.sceneTint.mode.tint' }),
    );
    expect(
      fresh.screen.getByRole('button', { name: 'graph.sceneTint.mode.tint' }),
    ).toHaveAttribute('aria-pressed', 'true');
    expect(window.localStorage.getItem('fluideq.studioWindowMode')).toBe(
      'tint',
    );
    // The app's own mode is left as it was.
    expect(window.localStorage.getItem('fluideq.sceneTintMode')).not.toBe(
      'tint',
    );
  });

  it('never shows the app’s mode as the Studio’s', () => {
    const { Tiles, library: fresh } = load({
      'fluideq.sceneTintMode': 'pulse',
    });
    fresh.render(<Tiles />);
    expect(
      fresh.screen.getByRole('button', { name: 'graph.sceneTint.mode.pulse' }),
    ).toHaveAttribute('aria-pressed', 'false');
    expect(
      fresh.screen.getByRole('button', { name: 'studio.tint.theme' }),
    ).toHaveAttribute('aria-pressed', 'true');
  });

  it('offers no Backdrop, which the graph keeps', () => {
    const { Tiles, library: fresh } = load({
      'fluideq.sceneTintMode': 'cover',
    });
    fresh.render(<Tiles />);
    expect(
      fresh.screen.queryByRole('button', {
        name: 'graph.sceneTint.mode.cover',
      }),
    ).toBeNull();
    // POSITIVE CONTROL: the tiles are there, the Studio's own on Theme.
    expect(
      fresh.screen.getByRole('button', { name: 'studio.tint.theme' }),
    ).toHaveAttribute('aria-pressed', 'true');
  });
});
