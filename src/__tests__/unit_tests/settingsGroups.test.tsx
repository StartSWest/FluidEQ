/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import '@testing-library/jest-dom';
import type { ComponentProps } from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import en from 'common/i18n/en';
import {
  OWN_GROUP_TITLE,
  SETTINGS_GROUPS,
  SETTINGS_GROUP_TITLE,
  SETTINGS_ROWS,
  rowsFor,
} from 'common/settingsGroups';
import GraphViewMenu from 'renderer/graph/GraphViewMenu';

/**
 * The settings a visualizer has are offered in two places, and they are now
 * offered in one order — see `common/settingsGroups.ts` for why.
 *
 * This holds the list honest and holds the graph's View menu to it. The
 * Studio's own card is held by its own tests; what neither can catch on its
 * own is the two drifting apart, which is what these first cases are for.
 */

const renderMenu = (
  overrides: Partial<ComponentProps<typeof GraphViewMenu>> = {},
) =>
  render(
    <GraphViewMenu
      view="normal"
      onChangeView={jest.fn()}
      onCycleLook={jest.fn()}
      isWaveHidden={false}
      onToggleWave={jest.fn()}
      curveToggles={[]}
      hiddenCurves={[]}
      onToggleCurve={jest.fn()}
      contents="everything"
      onCycleContents={jest.fn()}
      isGridHidden={false}
      onToggleGrid={jest.fn()}
      isCoverageHidden={false}
      onToggleCoverage={jest.fn()}
      isMeterHidden={false}
      onToggleMeter={jest.fn()}
      isTitlebarWaveHidden={false}
      onToggleTitlebarWave={jest.fn()}
      waveHeight={1}
      onChangeWaveHeight={jest.fn()}
      wavePosition={0}
      onChangeWavePosition={jest.fn()}
      waveOrientation="up"
      onCycleOrientation={jest.fn()}
      overlayOpacity={1}
      onChangeOverlayOpacity={jest.fn()}
      overlayBlur={0}
      onChangeOverlayBlur={jest.fn()}
      minOverlayOpacity={0}
      maxOverlayBlur={40}
      hasTopBar
      onToggleTopBar={jest.fn()}
      // eslint-disable-next-line react/jsx-props-no-spreading -- a test's overrides of a thirty-prop component
      {...overrides}
    />,
  );

const openMenu = () => {
  fireEvent.click(screen.getByRole('button', { expanded: false }));
};

/** The group headings the menu draws, top to bottom. */
const headingsShown = (): string[] =>
  Array.from(document.querySelectorAll('.graph-view-menu__group')).map(
    (el) => el.textContent ?? '',
  );

describe('the settings order both surfaces follow', () => {
  it('puts every row in a known group, once', () => {
    const ids = SETTINGS_ROWS.map((row) => row.id);
    expect(new Set(ids).size).toBe(ids.length);
    SETTINGS_ROWS.forEach((row) => {
      expect(SETTINGS_GROUPS).toContain(row.group);
    });
  });

  it(`keeps each group's rows together, so a group is one run and not two`, () => {
    // A row filed into a group that has already been passed would draw
    // under the wrong heading on both surfaces at once.
    // The groups in the order they first appear; a group that appears
    // twice lands in this list twice and fails the comparison below.
    const runs = SETTINGS_ROWS.reduce<string[]>(
      (list, row) =>
        list[list.length - 1] === row.group ? list : [...list, row.group],
      [],
    );
    expect(runs).toEqual([...SETTINGS_GROUPS]);
  });

  it('gives both surfaces the same shared rows in the same order', () => {
    // The point of the file: what the two have in common reads the same way
    // down each of them, whatever else either one adds around it.
    const shared = (surface: 'graph' | 'studio') =>
      SETTINGS_ROWS.filter(
        (row) => row.on === 'both' && (row.on === 'both' || row.on === surface),
      ).map((row) => row.id);
    expect(shared('graph')).toEqual(shared('studio'));
    // And the shared rows are not all of either surface, or there would be
    // nothing to separate — the Studio's preview audio, the graph's modes.
    expect(rowsFor('graph', 'own').length).toBeGreaterThan(0);
    expect(rowsFor('studio', 'own').length).toBeGreaterThan(0);
  });

  it('names the shared groups once, and the surface-only group per surface', () => {
    expect(SETTINGS_GROUP_TITLE.picture).toBe('settings.group.picture');
    expect(en[SETTINGS_GROUP_TITLE.picture]).toBeTruthy();
    expect(en[SETTINGS_GROUP_TITLE.visualizer]).toBeTruthy();
    expect(en[SETTINGS_GROUP_TITLE.drawing]).toBeTruthy();
    // The one group whose rows differ by surface, so its name does too.
    expect(OWN_GROUP_TITLE.graph).not.toBe(OWN_GROUP_TITLE.studio);
    expect(en[OWN_GROUP_TITLE.graph]).toBeTruthy();
    expect(en[OWN_GROUP_TITLE.studio]).toBeTruthy();
  });
});

describe('the graph View menu', () => {
  it('heads its groups in the shared order, its own first', () => {
    renderMenu();
    openMenu();
    expect(headingsShown()).toEqual([
      en[OWN_GROUP_TITLE.graph],
      en[SETTINGS_GROUP_TITLE.picture],
      en[SETTINGS_GROUP_TITLE.visualizer],
      // No visualizer on the plot, so nothing is drawn under "How it is
      // drawn" and the heading stays away rather than heading nothing.
    ]);
  });

  it('adds how it is drawn once a visualizer is on the plot', () => {
    renderMenu({ sceneLookId: 'aurora' });
    openMenu();
    expect(headingsShown()).toEqual([
      en[OWN_GROUP_TITLE.graph],
      en[SETTINGS_GROUP_TITLE.picture],
      en[SETTINGS_GROUP_TITLE.visualizer],
      en[SETTINGS_GROUP_TITLE.drawing],
    ]);
  });

  it('folds a group away on its heading, and remembers it', () => {
    // The menu is long and most of it is set once, so a group somebody is
    // done with can be put away — and stay away, since the menu is opened
    // dozens of times a session.
    // With a visualizer on the plot, so the group has its sliders: they
    // are the rows a fold has to take away.
    renderMenu({ sceneLookId: 'aurora' });
    openMenu();
    const heading = screen.getByRole('button', {
      name: en[SETTINGS_GROUP_TITLE.picture],
    });
    expect(heading).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByText(en['graph.waveHeight'])).toBeInTheDocument();

    fireEvent.click(heading);
    expect(heading).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByText(en['graph.waveHeight'])).not.toBeInTheDocument();
    // The heading itself never goes: a folded group must stay reachable.
    expect(heading).toBeInTheDocument();

    // A second opening of the menu, in a second window, finds it folded.
    cleanup();
    renderMenu({ sceneLookId: 'aurora' });
    openMenu();
    expect(
      screen.getByRole('button', { name: en[SETTINGS_GROUP_TITLE.picture] }),
    ).toHaveAttribute('aria-expanded', 'false');
  });
});
