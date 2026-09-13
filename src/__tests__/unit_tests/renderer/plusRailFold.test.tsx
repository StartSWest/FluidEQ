/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * The Plus tab's rail, pinned beside the place or folded to its pictures.
 *
 * The press and the memory are checked on the component; how the fold moves
 * — which jsdom neither lays out nor animates — on the compiled stylesheet,
 * where the three things that went wrong while it was built can be seen: a
 * narrow panel's strip of pills folding too, reduced motion making the width
 * jump, and a pass of the pointer on the way to the place opening the rail.
 */

import '@testing-library/jest-dom';
import { screen } from '@testing-library/react';
import type * as TestingLibrary from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type CommunityPanelModule from '../../../renderer/community/CommunityPanel';
import { resetAccountStore } from '../../../renderer/account/accountStore';
import { resetEntitlementStore } from '../../../renderer/account/entitlementStore';
import { resetPlusNavigation } from '../../../renderer/plus/plusNavigation';
import { resetProfileStore } from '../../../renderer/plus/profileStore';
import { resetLeaderboardStore } from '../../../renderer/usage/leaderboardStore';
import { compileStylesheet, styleRules } from '../../utils/stylesheetRules';

jest.mock('../../../renderer/utils/I18nContext', () => ({
  useTranslation: () => ({
    locale: 'en',
    t: (key: string) => key,
  }),
}));

jest.mock('../../../renderer/plus/VisualizersView', () => ({
  __esModule: true,
  default: () => <div>visualizers view</div>,
}));
jest.mock('../../../renderer/studio/StudioPanel', () => ({
  __esModule: true,
  default: () => <div>studio view</div>,
}));
jest.mock('../../../renderer/community/LeaderboardView', () => ({
  __esModule: true,
  default: () => <div>board view</div>,
}));

const PINNED_KEY = 'fluideq.plusRailPinned';

const bridge = {
  getAccountState: jest.fn(),
  onAccountState: jest.fn(() => () => {}),
  getEntitlementStatus: jest.fn(),
  onEntitlementChanged: jest.fn(() => () => {}),
  plusProfile: jest.fn(),
};

beforeEach(() => {
  jest.clearAllMocks();
  window.localStorage.clear();
  resetAccountStore();
  resetEntitlementStore();
  resetProfileStore();
  resetLeaderboardStore();
  resetPlusNavigation();
  bridge.getAccountState.mockResolvedValue({
    status: 'signed-in',
    identity: { id: 'acct-1', email: 'me@example.com', name: 'Me' },
  });
  bridge.getEntitlementStatus.mockResolvedValue({ state: 'active' });
  bridge.plusProfile.mockResolvedValue({ ok: true, value: null });
  Object.defineProperty(window, 'electron', {
    configurable: true,
    value: { ipcRenderer: bridge },
  });
});

/** The fresh registry's renderer, whose renders its own cleanup unmounts. */
let library: typeof TestingLibrary | undefined;

afterEach(() => {
  library?.cleanup();
  library = undefined;
});

/**
 * The panel from a fresh module registry, so the remembered setting is read
 * the way a launch reads it — once, when the module loads.
 */
const renderFreshPanel = async () => {
  let Panel: typeof CommunityPanelModule | undefined;
  // React and the renderer come from the same fresh registry as the panel;
  // a panel from a new registry rendered by the old React has no hooks.
  jest.isolateModules(() => {
    // eslint-disable-next-line global-require
    library = require('@testing-library/react/pure');
    // eslint-disable-next-line global-require
    Panel = require('../../../renderer/community/CommunityPanel').default;
  });
  const fresh = library;
  if (!Panel || !fresh) {
    throw new Error('CommunityPanel did not load');
  }
  const view = fresh.render(
    <Panel onSignIn={jest.fn()} onShowGraph={jest.fn()} />,
  );
  await fresh.act(async () => {});
  return view;
};

const panelOf = (container: HTMLElement) =>
  container.querySelector('.community') as HTMLElement;

describe('the Plus rail', () => {
  it('starts pinned, as the rail always was, with the press offered as collapsing it', async () => {
    const { container } = await renderFreshPanel();
    const pin = screen.getByRole('button', { name: 'plus.rail.collapse' });
    expect(pin).toHaveAttribute('aria-pressed', 'true');
    expect(panelOf(container)).toHaveClass('community--plus');
    expect(panelOf(container)).not.toHaveClass('community--rail-folded');
  });

  it('folds on a press, pins again on the next, and remembers each', async () => {
    const { container } = await renderFreshPanel();
    await userEvent.click(
      screen.getByRole('button', { name: 'plus.rail.collapse' }),
    );
    const pin = screen.getByRole('button', { name: 'plus.rail.pin' });
    expect(pin).toHaveAttribute('aria-pressed', 'false');
    expect(panelOf(container)).toHaveClass('community--rail-folded');
    expect(window.localStorage.getItem(PINNED_KEY)).toBe('false');

    await userEvent.click(pin);
    expect(
      screen.getByRole('button', { name: 'plus.rail.collapse' }),
    ).toHaveAttribute('aria-pressed', 'true');
    expect(panelOf(container)).not.toHaveClass('community--rail-folded');
    expect(window.localStorage.getItem(PINNED_KEY)).toBe('true');
  });

  it('opens folded when it was left folded', async () => {
    window.localStorage.setItem(PINNED_KEY, 'false');
    const { container } = await renderFreshPanel();
    expect(panelOf(container)).toHaveClass('community--rail-folded');
    expect(screen.getByRole('button', { name: 'plus.rail.pin' })).toBeVisible();
    // Folded is still the whole rail: every place and the account are there
    // to open it over the place.
    expect(screen.getByTitle('account.menu')).toBeInTheDocument();
    expect(container.querySelectorAll('.community__channel')).toHaveLength(3);
  });
});

describe('how the rail folds', () => {
  const css = compileStylesheet('PlusRail.scss');
  const rules = styleRules(css);
  const PANEL_WITH_RAIL = '@container eq-panel (min-width: 601px)';

  it('folds only a panel wide enough to have a rail, never the narrow strip of pills', () => {
    const moving = rules.filter(
      ({ selectors, declarations }) =>
        selectors.some((selector) =>
          /community__rail-slot|community--rail-folded|community--plus/.test(
            selector,
          ),
        ) &&
        (declarations.has('width') || declarations.has('transition')),
    );
    expect(moving.length).toBeGreaterThan(3);
    moving.forEach(({ within }) => expect(within[0]).toBe(PANEL_WITH_RAIL));
  });

  it('still slides under reduced motion, shorter, instead of jumping', () => {
    const reduced = rules.filter(({ within }) =>
      within.some((rule) => rule.includes('prefers-reduced-motion: reduce')),
    );
    const move = reduced
      .map(({ declarations }) => declarations.get('--rail-move'))
      .find(Boolean);
    expect(move).toMatch(/^[1-9]\d*ms$/);
    reduced.forEach(({ declarations }) => {
      expect(declarations.get('transition')).not.toBe('none');
    });
  });

  it('waits a moment before opening over the place, so a pass on the way there opens nothing', () => {
    const opening = rules.find(({ selectors }) =>
      selectors.some(
        (selector) =>
          selector.includes('community--rail-folded') &&
          selector.includes(':hover') &&
          selector.endsWith(
            '.community__rail:is(:hover, :has(:focus-visible))',
          ),
      ),
    );
    const transition = opening?.declarations.get('transition') ?? '';
    // "width <duration> <easing> <delay>": the delay is the pointer's intent.
    expect(transition).toMatch(/^width var\(--rail-move\) .+? [1-9]\d*ms,/);
    // A keyboard reaching the rail opens it too.
    expect(opening?.selectors.join()).toContain(':has(:focus-visible)');
  });
});
