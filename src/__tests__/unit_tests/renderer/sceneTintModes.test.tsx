/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * What a scene does to the window — the theme, its colours, or its colours
 * with its elements around it — chosen in the actions menu's tray and in the
 * Studio, and what somebody who had the old on/off switch, or the Backdrop
 * when it was a mode, gets on their first launch with it.
 *
 * The graph's own Window colours menu and the app's Backdrop were taken out
 * on 2026-11-16 (Ivan: "we can remove the options from the graph since they
 * will exist only on the app main menu", "I didn't like the scene backdrop
 * experiment so remove that"): the choice is three, in the tray.
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

/** The store, the controls and a renderer, from a registry loaded after `stored`. */
const load = (stored: Record<string, string> = {}) => {
  Object.entries(stored).forEach(([key, value]) =>
    window.localStorage.setItem(key, value),
  );
  let store: TStore | undefined;
  let Choice: (() => ReactElement) | undefined;
  let Section: (() => ReactElement) | undefined;
  let Tiles: (() => ReactElement) | undefined;
  jest.isolateModules(() => {
    /* eslint-disable global-require */
    library = require('@testing-library/react/pure');
    store = require('../../../renderer/utils/sceneTintStore');
    Choice = require('../../../renderer/graph/WindowColourChoice').default;
    Section = require('../../../renderer/components/WindowLookSection').default;
    Tiles = require('../../../renderer/studio/StudioTintSwitch').default;
    /* eslint-enable global-require */
  });
  if (!store || !Choice || !Section || !Tiles || !library) {
    throw new Error('the tint modules did not load');
  }
  return { store, Choice, Section, Tiles, library };
};

/** The window colour's three choices, apart from the tray's other rows. */
const modeChoices = (fresh: typeof TestingLibrary) =>
  fresh
    .within(
      fresh.screen.getByRole('radiogroup', { name: 'graph.sceneTint.label' }),
    )
    .getAllByRole('radio');

const sliderNames = (fresh: typeof TestingLibrary) =>
  fresh.screen
    .queryAllByRole('slider')
    .map((slider) => slider.getAttribute('aria-label'));

describe('the modes a launch starts in', () => {
  it('starts somebody new on Ambient', () => {
    const { store, library: fresh } = load();
    const { result } = fresh.renderHook(() => store.useSceneTintMode());
    expect(result.current).toBe('pulse');
  });

  it('keeps a mode chosen before the default changed', () => {
    const { store, library: fresh } = load({ 'fluideq.sceneTintMode': 'tint' });
    const { result } = fresh.renderHook(() => store.useSceneTintMode());
    expect(result.current).toBe('tint');
  });

  // The Backdrop was Ambient with the scene behind the window; with the
  // scene gone from behind it, what is left of it is Ambient. Read so and
  // never written back.
  it('reads a Backdrop chosen when it was a mode as Ambient, and leaves the word', () => {
    const { store, library: fresh } = load({
      'fluideq.sceneTintMode': 'cover',
    });
    const { result } = fresh.renderHook(() => store.useSceneTintMode());
    expect(result.current).toBe('pulse');
    expect(window.localStorage.getItem('fluideq.sceneTintMode')).toBe('cover');
  });

  it.each([
    ['true', 'tint'],
    ['false', 'off'],
  ])('keeps the old graph switch set to %s as %s', (legacy, mode) => {
    const { store, library: fresh } = load({ 'fluideq.sceneTint': legacy });
    const { result } = fresh.renderHook(() => store.useSceneTintMode());
    expect(result.current).toBe(mode);
  });

  // The Studio once kept a mode of its own, which started on the theme; what
  // an earlier version stored for it is not read as the app's.
  it('ignores a mode an earlier version stored for the Studio alone', () => {
    const { store, library: fresh } = load({
      'fluideq.studioTintMode': 'off',
      'fluideq.studioTint': 'false',
    });
    const { result } = fresh.renderHook(() => store.useSceneTintMode());
    expect(result.current).toBe('pulse');
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

describe('the window’s colours in the tray', () => {
  it('offers three, Original, Colours and Ambient, each said in a word and a line', () => {
    const { Choice, library: fresh } = load({
      'fluideq.sceneTintMode': 'tint',
    });
    fresh.render(<Choice />);
    const choices = modeChoices(fresh);
    expect(choices.map((choice) => choice.textContent)).toEqual([
      'graph.sceneTint.short.off',
      'graph.sceneTint.short.tint',
      'graph.sceneTint.short.pulse',
    ]);
    expect(choices[2]).toHaveAttribute('title', 'graph.sceneTint.about.pulse');
    expect(
      choices.map((choice) => choice.getAttribute('aria-checked')),
    ).toEqual(['false', 'true', 'false']);
  });

  it('puts the window in the mode picked and remembers it', async () => {
    const {
      Choice,
      store,
      library: fresh,
    } = load({ 'fluideq.sceneTintMode': 'off' });
    fresh.render(<Choice />);
    const { result } = fresh.renderHook(() => store.useSceneTintMode());
    await userEvent.click(modeChoices(fresh)[2]);
    expect(result.current).toBe('pulse');
    expect(window.localStorage.getItem('fluideq.sceneTintMode')).toBe('pulse');
    expect(modeChoices(fresh)[2]).toHaveAttribute('aria-checked', 'true');
  });

  // With a Plus visualizer: the colours, Brightness, the app's own Tint only
  // while the window is Original, and the scene's time of day.
  it.each([
    ['off', true],
    ['tint', false],
  ])(
    'under %s with a Plus visualizer offers Brightness and Daylight, and the Tint: %s',
    (mode, hasTint) => {
      const { Section, library: fresh } = load({
        'fluideq.sceneTintMode': mode,
        'fluideq-graph-style': 'premium:bloom',
      });
      fresh.render(<Section />);
      expect(sliderNames(fresh)).toEqual([
        'graph.sceneTint.brightness',
        ...(hasTint ? ['graph.windowTint'] : []),
        'graph.sceneTint.daylight',
      ]);
      expect(
        fresh.screen.getByRole('radiogroup', { name: 'graph.sceneTint.label' }),
      ).toBeInTheDocument();
      expect(
        fresh.screen.getByRole('slider', {
          name: 'graph.sceneTint.brightness',
        }),
      ).toBeEnabled();
      // The scene's time of day follows Brightness until told otherwise,
      // and its slider stands still while it does.
      expect(
        fresh.screen.getByRole('slider', { name: 'graph.sceneTint.daylight' }),
      ).toBeDisabled();
    },
  );

  // A standard look has no colours or picture of its own: Brightness and the
  // window's Tint, and no choice of the scene's colours or time of day.
  it('offers a standard look Brightness and the Tint alone', () => {
    const { Section, library: fresh } = load({
      'fluideq.sceneTintMode': 'pulse',
    });
    fresh.render(<Section />);
    expect(sliderNames(fresh)).toEqual([
      'graph.sceneTint.brightness',
      'graph.windowTint',
    ]);
    expect(
      fresh.screen.getByRole('slider', { name: 'graph.windowTint' }),
    ).toBeEnabled();
    expect(
      fresh.screen.queryByRole('radiogroup', { name: 'graph.sceneTint.label' }),
    ).toBeNull();
  });

  // One row of three under the Daylight slider, where two switches stood
  // that were only ever on one at a time (Ivan, 2026-10-25: "too many
  // options", "let's simplify this on both sides").
  it('says what the time of day follows in one choice of three, and frees its slider on Off', async () => {
    const { Section, library: fresh } = load({
      'fluideq.sceneTintMode': 'off',
      'fluideq-graph-style': 'premium:bloom',
    });
    fresh.render(<Section />);
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
  // options are independent of the global ones"): the app's Colours and
  // Ambient with the project on the bench as the scene — never a Backdrop
  // (2026-09-28: "remove backdrop option from studio only"), and no Theme
  // since 1219791c4 (2026-11-18: "the Studio always tints as the scene").
  // Neither sets the other.
  it('shows both at once, the Studio’s own mode pressed, each named in a word', async () => {
    const { Tiles, library: fresh } = load();
    fresh.render(<Tiles />);
    // The tiles' own group: the card's head carries an info button too
    // (2026-11-17, the Tune tab's even columns).
    const tiles = fresh
      .within(fresh.screen.getByRole('group', { name: 'studio.tint.label' }))
      .getAllByRole('button');
    expect(tiles.map((tile) => tile.textContent)).toEqual([
      'graph.sceneTint.short.tint',
      'graph.sceneTint.short.pulse',
    ]);
    // Ambient for somebody new (2026-11-18: "Ambient should be selected by
    // default in the Studio").
    expect(tiles.map((tile) => tile.getAttribute('aria-pressed'))).toEqual([
      'false',
      'true',
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
      'fluideq.sceneTintMode': 'tint',
    });
    fresh.render(<Tiles />);
    expect(
      fresh.screen.getByRole('button', { name: 'graph.sceneTint.mode.tint' }),
    ).toHaveAttribute('aria-pressed', 'false');
    expect(
      fresh.screen.getByRole('button', { name: 'graph.sceneTint.mode.pulse' }),
    ).toHaveAttribute('aria-pressed', 'true');
  });

  it('reads a Theme an earlier version stored as Ambient, and keeps a stored Colours', () => {
    const first = load({ 'fluideq.studioWindowMode': 'theme' });
    expect(first.store.STUDIO_TINT_MODES).toEqual(['tint', 'pulse']);
    first.library.render(<first.Tiles />);
    expect(
      first.library.screen.getByRole('button', {
        name: 'graph.sceneTint.mode.pulse',
      }),
    ).toHaveAttribute('aria-pressed', 'true');
    first.library.cleanup();
    window.localStorage.clear();
    // CONTROL: a mode the tiles still offer is read as stored.
    const second = load({ 'fluideq.studioWindowMode': 'tint' });
    second.library.render(<second.Tiles />);
    expect(
      second.library.screen.getByRole('button', {
        name: 'graph.sceneTint.mode.tint',
      }),
    ).toHaveAttribute('aria-pressed', 'true');
  });

  it('offers no Backdrop', () => {
    const { Tiles, library: fresh } = load({
      'fluideq.sceneTintMode': 'cover',
    });
    fresh.render(<Tiles />);
    expect(
      fresh.screen.queryByRole('button', {
        name: 'graph.sceneTint.mode.cover',
      }),
    ).toBeNull();
    // POSITIVE CONTROL: the tiles are there, the Studio's own on Ambient.
    expect(
      fresh.screen.getByRole('button', { name: 'graph.sceneTint.mode.pulse' }),
    ).toHaveAttribute('aria-pressed', 'true');
    expect(
      fresh.screen.getByRole('button', { name: 'graph.sceneTint.mode.tint' }),
    ).toHaveAttribute('aria-pressed', 'false');
  });
});
