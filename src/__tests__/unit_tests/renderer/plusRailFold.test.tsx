/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * The Scenes tab's rail, pinned beside the place or folded to its pictures.
 *
 * Scenes stands on the shared studio rail (`StudioRail`, 2026-11-19), so the
 * pin, the fold and its motion are that rail's (`StudioRail.scss`) and the
 * Scenes sheet (`PlusRail.scss`) keeps only its rows. The press and the
 * memory are checked on the component; how the fold moves — which jsdom
 * neither lays out nor animates — on the compiled stylesheets, where the
 * things that went wrong while it was built can be seen: the fold reaching
 * the Forum's rail, reduced motion making the width jump, and a pass of the
 * pointer on the way to the place opening the rail.
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
 *
 * Which makes every test here load the whole Plus tab again — every page of
 * it, the admin's included — and that grows with the tab. Jest's five
 * seconds is a bound on a unit, not on a tab: on a full parallel run the
 * first of these crossed it once the approval pages joined the tab, while it
 * passed alone in under two. The bound is this file's own, then.
 */
jest.setTimeout(30_000);

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

/**
 * A press inside the fresh registry's act. `userEvent` waits in the outer
 * React's act, which does not cover the panel's renderer, so each press
 * re-rendered the rail outside act.
 */
const press = async (button: HTMLElement) => {
  const fresh = library;
  if (!fresh) {
    throw new Error('render the panel before pressing in it');
  }
  await fresh.act(async () => {
    await userEvent.click(button);
  });
};

/** The shared rail's slot inside the Scenes tab, which carries the fold. */
const slotOf = (container: HTMLElement) => {
  const slot = container.querySelector('.community--plus > .studio-rail-slot');
  if (!(slot instanceof HTMLElement)) {
    throw new Error('the Scenes tab has no studio rail');
  }
  return slot;
};

describe('the Scenes rail', () => {
  it('starts pinned, as the rail always was, with the press offered as collapsing it', async () => {
    const { container } = await renderFreshPanel();
    const pin = screen.getByRole('button', { name: 'plus.rail.collapse' });
    expect(pin).toHaveAttribute('aria-pressed', 'true');
    expect(slotOf(container)).not.toHaveClass('is-folded');
    // The head is the page's name beside the pin, as on every page's rail.
    expect(
      slotOf(container).querySelector('.studio-rail__head'),
    ).toContainElement(pin);
    expect(
      slotOf(container).querySelector('.studio-rail__heading'),
    ).toHaveTextContent('tabs.plus');
  });

  it('folds on a press, pins again on the next, and remembers each', async () => {
    const { container } = await renderFreshPanel();
    await press(screen.getByRole('button', { name: 'plus.rail.collapse' }));
    const pin = screen.getByRole('button', { name: 'plus.rail.pin' });
    expect(pin).toHaveAttribute('aria-pressed', 'false');
    expect(slotOf(container)).toHaveClass('is-folded');
    expect(window.localStorage.getItem(PINNED_KEY)).toBe('false');

    await press(pin);
    expect(
      screen.getByRole('button', { name: 'plus.rail.collapse' }),
    ).toHaveAttribute('aria-pressed', 'true');
    expect(slotOf(container)).not.toHaveClass('is-folded');
    expect(window.localStorage.getItem(PINNED_KEY)).toBe('true');
  });

  it('opens folded when it was left folded', async () => {
    window.localStorage.setItem(PINNED_KEY, 'false');
    const { container } = await renderFreshPanel();
    expect(slotOf(container)).toHaveClass('is-folded');
    expect(screen.getByRole('button', { name: 'plus.rail.pin' })).toBeVisible();
    // Folded is still the whole rail: every place and the account are there
    // to open it over the place.
    expect(screen.getByTitle('account.menu')).toBeInTheDocument();
    // Visualizers, the Studio and Dynamic lighting, and under them the
    // Visualizers' own What's New.
    expect(container.querySelectorAll('.community__channel')).toHaveLength(4);
  });
});

describe('how the rail folds', () => {
  const rules = styleRules(compileStylesheet('StudioRail.scss'));
  // A page as narrow as the Library's card is when its rail keeps only
  // glyphs: `$bp-lg`, measured on the box a rail's page is measured by.
  const NARROW_PAGE = '@container studio-page (max-width: 1024px)';
  const FOLDED_SLOT = '.studio-rail-slot.is-folded';
  const slotWidth = (selector: string, within: string[]) =>
    rules
      .find(
        (rule) =>
          rule.selectors.includes(selector) &&
          rule.within.join() === within.join(),
      )
      ?.declarations.get('width');

  it('folds at every width on the shared rail, and never reaches the Forum’s rail', () => {
    // The narrow strip of pills is gone from the Scenes tab (2026-11-17): the
    // rail folds to its glyphs as the Library's does, at every width, so the
    // fold is kept behind no query — the slot and the rail at rest both
    // narrow.
    const folding = rules.filter(
      ({ selectors, declarations, within }) =>
        within.length === 0 &&
        declarations.has('width') &&
        selectors.some((selector) => selector.startsWith(FOLDED_SLOT)),
    );
    expect(folding.map(({ selectors }) => selectors.join())).toEqual([
      FOLDED_SLOT,
      `${FOLDED_SLOT} > .studio-rail:not(:hover):not(:has(:focus-visible))`,
    ]);
    // The Forum borrows the Scenes rail's markup (`.community__rail`) and
    // keeps its own look: what is left of the Scenes sheet styles that markup
    // only inside the Scenes tab or the shared rail, which the Forum has not.
    const borrowed = styleRules(compileStylesheet('PlusRail.scss'))
      .flatMap(({ selectors }) => selectors)
      .filter((selector) => selector.includes('.community__'));
    expect(borrowed.length).toBeGreaterThan(10);
    borrowed.forEach((selector) =>
      expect(selector).toMatch(/community--plus|studio-rail/),
    );
  });

  it('folds by itself on a page too narrow for a rail, to the folded column', () => {
    const folded = slotWidth(FOLDED_SLOT, []);
    expect(folded).toMatch(/^\d+px$/);
    // Every rail but Share Audio's, which never folds (`FixedStudioRail`).
    expect(slotWidth('.studio-rail-slot:not(.is-fixed)', [NARROW_PAGE])).toBe(
      folded,
    );
    // The control: on a page with room, the slot is the rail's own width.
    expect(slotWidth('.studio-rail-slot', [])).toMatch(/^var\(--rail-width/);
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
    const opening = rules.find(
      ({ selectors, within }) =>
        within.length === 0 &&
        selectors.includes(
          `${FOLDED_SLOT} > .studio-rail:is(:hover, :has(:focus-visible))`,
        ),
    );
    const transition = opening?.declarations.get('transition') ?? '';
    // "width <duration> <easing> <delay>": the delay is the pointer's intent.
    expect(transition).toMatch(/^width var\(--rail-move\) .+? [1-9]\d*ms,/);
    // A keyboard reaching the rail opens it too.
    expect(opening?.selectors.join()).toContain(':has(:focus-visible)');
  });
});
