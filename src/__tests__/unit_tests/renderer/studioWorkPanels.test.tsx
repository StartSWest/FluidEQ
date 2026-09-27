/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * What the Studio's side card held, where layout A put it (Ivan, 2026-09-27):
 * the settings a scene is tuned with in the Tune tab, how it is drawn in the
 * Performance tab, and the groups "What it hears now" still folds one at a
 * time.
 *
 * The folds are CSS — the contents stay in the page, because the height
 * transition needs them there — so what a test can hold is that a folded
 * group says so, that Tab and a screen reader are kept out of it, and that
 * each group remembers how it was left.
 */

import '@testing-library/jest-dom';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import StudioCardGroup from '../../../renderer/studio/StudioCardGroup';
import StudioDrawing from '../../../renderer/studio/StudioDrawing';
import StudioTune from '../../../renderer/studio/StudioTune';
import { DEFAULT_STUDIO_WAVE } from '../../../renderer/studio/studioWave';

jest.mock('../../../renderer/utils/I18nContext', () => ({
  useTranslation: () => ({
    locale: 'en',
    t: (key: string, vars?: Record<string, string | number>) =>
      vars ? `${key}:${Object.values(vars).join(',')}` : key,
  }),
}));

/** What the head opens and closes, by the id the head points at. */
const foldedAway = (head: HTMLElement) => {
  const id = head.getAttribute('aria-controls');
  const reveal = id ? document.getElementById(id) : null;
  if (!reveal) {
    throw new Error('the head controls nothing');
  }
  return reveal.hasAttribute('inert');
};

const groups = () =>
  render(
    <>
      <StudioCardGroup group="sound" title="Sound">
        <p>the sound meters</p>
      </StudioCardGroup>
      <StudioCardGroup group="rhythm" title="Rhythm">
        <p>the rhythm meters</p>
      </StudioCardGroup>
    </>,
  );

beforeEach(() => {
  window.localStorage.clear();
});

describe('the groups "What it hears now" folds', () => {
  // First on purpose: a fold is remembered in the module as well as in
  // storage, so a group folded below stays folded for the rest of the file.
  it('opens every group the first time, so nothing has to be found', () => {
    groups();
    ['Sound', 'Rhythm'].forEach((name) => {
      const head = screen.getByRole('button', { name });
      expect(head).toHaveAttribute('aria-expanded', 'true');
      expect(foldedAway(head)).toBe(false);
    });
  });

  it('folds one by its own name, its rows with it, and leaves the other', async () => {
    groups();
    const sound = screen.getByRole('button', { name: 'Sound' });
    await userEvent.click(sound);
    expect(sound).toHaveAttribute('aria-expanded', 'false');
    // Folded, its contents are still in the page for the height transition
    // to work on — but nothing can tab into them or read them out.
    expect(foldedAway(sound)).toBe(true);
    // POSITIVE CONTROL: the other group is as it was.
    expect(foldedAway(screen.getByRole('button', { name: 'Rhythm' }))).toBe(
      false,
    );
  });

  it('remembers each group on its own, across a fresh page', async () => {
    const { unmount } = groups();
    const rhythmWas = foldedAway(
      screen.getByRole('button', { name: 'Rhythm' }),
    );
    const sound = screen.getByRole('button', { name: 'Sound' });
    if (!foldedAway(sound)) {
      await userEvent.click(sound);
    }
    unmount();

    groups();
    expect(screen.getByRole('button', { name: 'Sound' })).toHaveAttribute(
      'aria-expanded',
      'false',
    );
    expect(foldedAway(screen.getByRole('button', { name: 'Rhythm' }))).toBe(
      rhythmWas,
    );
  });
});

describe('the Tune tab', () => {
  it('reads across in the order the graph’s menu shares, the scene’s own settings last', () => {
    const { container } = render(
      <StudioTune
        wave={DEFAULT_STUDIO_WAVE}
        onWave={jest.fn()}
        onWaveCommit={jest.fn()}
        onWaveReset={jest.fn()}
        canResetWave={false}
        idle={false}
        settings={<p>the settings of the scene</p>}
      />,
    );
    // The graph's View menu and this tab name the same groups the same way
    // (`common/settingsGroups.ts`).
    expect(
      screen.getByRole('region', { name: 'settings.group.picture' }),
    ).toBeInTheDocument();
    const visualizer = screen.getByRole('region', {
      name: 'settings.group.visualizer',
    });
    expect(
      within(visualizer).getByText('the settings of the scene'),
    ).toBeInTheDocument();
    const boxes = [...container.querySelectorAll('.studio-tune__box')];
    expect(boxes).toHaveLength(3);
    expect(boxes[2]).toBe(visualizer);
  });
});

describe('the Performance tab', () => {
  it('holds how the scene is drawn as a group of the menu’s own rows, and how it is keeping up', () => {
    render(
      <StudioDrawing
        cost="studio.cost.full"
        percent={100}
        readingRef={{ current: null }}
      />,
    );
    // A group, not a menu: nothing here floats, and everything the app calls
    // a menu is given a surface of its own to float on.
    const rows = within(
      screen.getByRole('group', { name: 'studio.performance.title' }),
    ).getAllByRole('menuitem');
    expect(rows.length).toBeGreaterThan(3);
    expect(screen.getByText('studio.cost.full:100')).toBeInTheDocument();
  });

  it('says nothing about keeping up while nothing plays', () => {
    render(<StudioDrawing percent={100} readingRef={{ current: null }} />);
    expect(screen.queryByText(/studio\.cost\./)).toBeNull();
    // POSITIVE CONTROL: the rows are there all the same.
    expect(
      screen.getByRole('group', { name: 'studio.performance.title' }),
    ).toBeInTheDocument();
  });
});
