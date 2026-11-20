/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * The EQ pages' open floor: the section pills on top, the graph under them,
 * then the Bands page with its own tab row (Your EQ, Preset, Tone) and the
 * bands. Layout A, which Ivan chose from three mockups on 2026-09-25 ("def
 * A"): the page reads pills, graph, bands from the top down, because on these
 * pages the graph is the instrument the bands are edited on, not a monitor
 * under them. Every other page keeps its graph underneath. The title row that
 * stood beside the pills ("Parametric EQ" and its toolbar) went on 2026-11-16,
 * its tools to the page's tab row under the graph.
 *
 * Two mechanisms carry it, and a test of either alone passes with the other
 * broken. The pills are drawn in the column's head while the graph is above
 * the page, and in the page otherwise, so where they land is markup, which
 * jsdom can see. The graph standing above the
 * page is CSS `order`: the markup keeps the page first on purpose, because
 * moving the page's element moves every panel kept alive in it, and a web view
 * that is moved reloads (the Online Media player is one of them). jsdom lays
 * nothing out, so the order is read from the compiled stylesheets and applied
 * to the real markup the way a flex column applies it.
 *
 * Mounted as the window mounts it: the whole shell with the real Bands page,
 * main answering the one request that takes the page past its spinner.
 */

import '@testing-library/jest-dom';
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from '@testing-library/react';
import ChannelEnum from 'common/channels';
import { getDefaultState } from 'common/constants';
import { DISCLAIMER_ACCEPTED_KEY, buildAcceptance } from 'common/disclaimer';
import App from 'renderer/App';
import { setGraphView } from 'renderer/utils/graphViewSettings';
import { preloadTab } from 'renderer/workspacePages';
import type { TWorkspaceTab } from 'renderer/workspaceTabs';
import { compileStylesheet, styleRules } from '__tests__/utils/stylesheetRules';

/** Every stylesheet with a rule on the centre column or its direct children. */
const COLUMN_SHEETS = [
  'App.scss',
  'GraphTheme.scss',
  'SceneColumn.scss',
  'PaneResizer.scss',
];
const RULES = COLUMN_SHEETS.flatMap((sheet) =>
  styleRules(compileStylesheet(sheet)),
);

const withoutArguments = (selector: string): string => {
  const next = selector.replace(/\([^()]*\)/g, '');
  return next === selector ? next : withoutArguments(next);
};

/** Whether a selector styles the column itself, not something in it. */
const isTheColumn = (selector: string): boolean => {
  const subject = withoutArguments(selector)
    .trim()
    .split(/[\s>+~]+/)
    .pop();
  return (
    subject !== undefined &&
    subject.includes('.center-workspace') &&
    !subject.includes('::')
  );
};

const label = (element: Element) =>
  `${element.tagName.toLowerCase()}.${Array.from(element.classList).join('.')}`;

/** What stands in the column's flow, named as somebody looking at it would. */
const PANES: readonly (readonly [selector: string, name: string])[] = [
  ['.center-head', 'pills'],
  ['.graph-wrapper', 'graph'],
  // The EQ page's divider is the Library's splitter in a band of its own
  // (2026-11-16); a page with its graph underneath keeps the plain one.
  ['.pane-resizer, .graph-pane-splitter', 'divider'],
  ['.middle-content', 'page'],
];

const nameOf = (element: Element): string[] =>
  PANES.filter(([selector]) => element.matches(selector)).map(
    ([, name]) => name,
  );

/**
 * The `order` the stylesheets give `element`, 0 where none does. Rules inside
 * a media query count as well: a window size that reorders the column is a
 * reorder. Two rules giving it different orders is a rule competing with the
 * layout, and is reported as such rather than resolved by guessing which wins.
 */
const orderOf = (element: Element): number => {
  const orders = new Set(
    RULES.filter(
      ({ selectors, declarations }) =>
        declarations.has('order') &&
        selectors.some(
          (selector) => !selector.includes('::') && element.matches(selector),
        ),
    ).map(({ declarations }) => Number(declarations.get('order'))),
  );
  if (orders.size > 1) {
    throw new Error(
      `${nameOf(element).join()} is given order ${[...orders].join(' and ')}`,
    );
  }
  return [...orders][0] ?? 0;
};

/** The column's panes top to bottom, as its flex layout draws them. */
const onScreen = (column: Element): string[] =>
  Array.from(column.children)
    .map((element, index) => ({ element, index, order: orderOf(element) }))
    .sort((a, b) => a.order - b.order || a.index - b.index)
    .flatMap(({ element }) => nameOf(element));

/** The column's panes in the order of its markup. */
const inMarkup = (column: Element): string[] =>
  Array.from(column.children).flatMap(nameOf);

const columnOf = (container: HTMLElement): HTMLElement => {
  const column = container.querySelector<HTMLElement>('.center-workspace');
  if (!column) {
    throw new Error('the shell drew no centre column');
  }
  return column;
};

type TListener = (...args: unknown[]) => void;

/**
 * Main, answering the state request as its handler does (`{ result }` on the
 * same channel, with the request's id) and nothing else. Answered after the
 * send returns, as Electron's are: the request listens only once it is sent.
 */
const installMain = () => {
  const listeners = new Map<string, TListener[]>();
  const subscribe = (channel: string, listener: TListener) => {
    listeners.set(channel, [...(listeners.get(channel) ?? []), listener]);
    return () => {
      listeners.set(
        channel,
        (listeners.get(channel) ?? []).filter((each) => each !== listener),
      );
    };
  };
  Object.defineProperty(window, 'electron', {
    configurable: true,
    get: () => ({
      platform: 'win32',
      ipcRenderer: {
        sendMessage: (channel: string, _args: unknown[], id?: unknown) => {
          if (channel !== ChannelEnum.GET_STATE) {
            return;
          }
          Promise.resolve().then(() =>
            (listeners.get(channel) ?? []).forEach((listener) =>
              listener({ result: getDefaultState() }, id),
            ),
          );
        },
        on: subscribe,
        onOutputMirrorsReset: (listener: () => void) =>
          subscribe('output-mirrors-reset', listener),
        removeListener: () => {},
        getWindowState: async () => ({
          mode: 'app',
          isMaximized: false,
          isFullScreen: false,
        }),
        setWindowFullScreen: async (next: boolean) => next,
        minimizeWindow: async () => {},
        toggleMaximizeWindow: async () => false,
        closeWindow: async () => {},
      },
    }),
  });
};

/** The Bands page's own tab row: Your EQ, Preset, Tone. */
const bandsTabs = () => screen.getByRole('tablist', { name: 'EQ layers' });

/** The section pills: Bands, Headphone corrections, DSP and the rest. */
const pills = () => screen.getByRole('tablist', { name: 'EQ' });

/** The shell, with the state answered and the Bands page past its spinner. */
const renderShell = async () => {
  const rendered = render(<App />);
  // One turn for the request to go out and be answered, one for the answer
  // to be drawn; the tab row is only there once both have happened.
  await act(async () => Promise.resolve());
  await act(async () => Promise.resolve());
  bandsTabs();
  return { ...rendered, column: columnOf(rendered.container) };
};

/** A press on a tab or pill, and the arrival of its page's code. */
const pressTab = async (name: string, tab: TWorkspaceTab) => {
  await act(async () => {
    fireEvent.click(screen.getByRole('tab', { name }));
    await preloadTab(tab);
  });
};

const toggleGraph = async () => {
  await act(async () => {
    fireEvent.click(screen.getByLabelText('Response graph'));
  });
};

beforeAll(
  () => Promise.all((['dsp', 'presets'] as const).map(preloadTab)),
  120_000,
);

beforeEach(() => {
  window.localStorage.clear();
  window.localStorage.setItem(
    DISCLAIMER_ACCEPTED_KEY,
    JSON.stringify(buildAcceptance('1.2.0', 'en')),
  );
  setGraphView('normal');
  // The graph draws its curves in with a dash the length of the path, and
  // jsdom has no geometry to measure one with.
  Object.defineProperty(SVGElement.prototype, 'getTotalLength', {
    configurable: true,
    value: () => 100,
  });
  installMain();
});

afterEach(async () => {
  await act(async () => {
    cleanup();
  });
  setGraphView('normal');
});

describe('the Bands page with its graph on', () => {
  it('puts the pills above the graph, and the bands under it', async () => {
    const { column } = await renderShell();

    expect(column).toHaveClass('is-graph-first');
    expect(onScreen(column)).toEqual(['pills', 'graph', 'divider', 'page']);
  });

  it('draws the pills in the head, and the page’s tab row in the page under the graph', async () => {
    const { container } = await renderShell();
    const head = container.querySelector<HTMLElement>('.center-head');
    const page = container.querySelector<HTMLElement>(
      '.workspace-tab-panel--eq',
    );
    if (!head || !page) {
      throw new Error('the head or the Bands page is missing');
    }

    expect(head).toContainElement(pills());
    expect(pills()).toContainElement(
      screen.getByRole('tab', { name: 'Bands' }),
    );
    // Drawn once, up there: the pills are not left behind in the page.
    expect(within(page).queryByRole('tablist', { name: 'EQ' })).toBeNull();
    // The page's own row stays the page's, under the graph, never the head's.
    expect(page).toContainElement(bandsTabs());
    expect(head).not.toContainElement(bandsTabs());
    // POSITIVE CONTROL: the page is mounted and holds its bands, so the
    // pills' absence from it is where they are drawn, not an empty page.
    expect(page.querySelector('.main-content')).toBeInTheDocument();
  });

  it('keeps the page’s tools on its tab row, with no row of layers on the page or the graph', async () => {
    const { container } = await renderShell();
    const strip = container.querySelector<HTMLElement>(
      '.graph-wrapper .live-output-controls',
    );
    const tools = container.querySelector<HTMLElement>(
      '.workspace-tab-panel--eq .eq-layer-tabs__tools',
    );

    // The applied layers are the Curves dropdown among the tools
    // (`CurvesPicker`), never a row of chips — on the plot or in the page.
    expect(container.querySelector('.active-layers')).toBeNull();
    // POSITIVE CONTROL: the strip and the row are drawn, so the absence is
    // theirs, not a graph or a page that went away.
    expect(strip).not.toBeNull();
    expect(tools).not.toBeNull();
    // The title row's tools stand on the tab row now (2026-11-16).
    expect(
      within(tools ?? document.body).getByRole('button', {
        name: 'Quick layouts',
      }),
    ).toBeInTheDocument();
  });

  it('keeps the page first in the markup, so the graph is put above it by the stylesheet alone', async () => {
    const { column } = await renderShell();

    expect(inMarkup(column)).toEqual(['pills', 'page', 'divider', 'graph']);
    // What `order` is read against: a flex column, top to bottom, set once
    // and turned by no other rule at any window size.
    expect(
      RULES.filter(({ selectors }) => selectors.some(isTheColumn)).flatMap(
        ({ declarations, within: at }) =>
          ['display', 'flex-direction'].flatMap((property) => {
            const value = declarations.get(property);
            return value === undefined
              ? []
              : [[...at, `${property}: ${value}`].join(' ')];
          }),
      ),
    ).toEqual(['display: flex', 'flex-direction: column']);
  });

  it('moves no panel when the graph goes off and comes back', async () => {
    const { container, column } = await renderShell();
    const page = container.querySelector('.workspace-tab-panel--eq');
    const pane = container.querySelector('.middle-content');
    expect(page).toBeInTheDocument();
    expect(pane).toBeInTheDocument();
    const moved: Element[] = [];
    const collect = (records: MutationRecord[]) => {
      records.forEach((record) => {
        [...record.addedNodes, ...record.removedNodes].forEach((node) => {
          if (node instanceof Element) {
            moved.push(node);
          }
        });
      });
    };
    const observer = new MutationObserver(collect);
    observer.observe(column, { childList: true, subtree: true });

    await toggleGraph();
    expect(column).not.toHaveClass('is-graph-first');
    await toggleGraph();
    expect(column).toHaveClass('is-graph-first');
    collect(observer.takeRecords());
    observer.disconnect();

    // A move is a removal and an insertion; neither happened to the pane
    // holding the pages or to any page in it.
    expect(
      moved
        .filter(
          (node) =>
            node.matches('.middle-content, .workspace-tab-panel') ||
            node.querySelector('.middle-content, .workspace-tab-panel'),
        )
        .map(label),
    ).toEqual([]);
    expect(container.querySelector('.middle-content')).toBe(pane);
    expect(container.querySelector('.workspace-tab-panel--eq')).toBe(page);
    // POSITIVE CONTROL: the observer did see the head and the graph leave
    // and come back, so its silence about the pages is theirs.
    expect(moved.some((node) => node.matches('.center-head'))).toBe(true);
    expect(moved.some((node) => node.matches('.graph-wrapper'))).toBe(true);
    // And the pills are back up there.
    expect(container.querySelector('.center-head')).toContainElement(pills());
  });
});

describe('where the graph is not above the page', () => {
  it('keeps the pills and the tab row in the Bands page while its graph is off', async () => {
    window.localStorage.setItem(
      'fluideq.graphVisibilityByTab',
      JSON.stringify({ eq: false }),
    );
    const { container, column } = await renderShell();
    const page = container.querySelector<HTMLElement>(
      '.workspace-tab-panel--eq',
    );
    if (!page) {
      throw new Error('the Bands page is missing');
    }

    expect(container.querySelector('.graph-wrapper')).toBeNull();
    expect(column).not.toHaveClass('is-graph-first');
    expect(container.querySelector('.center-head')).toBeNull();
    // POSITIVE CONTROL for the head's absence: the pills and the tab row are
    // drawn, in the page.
    expect(page).toContainElement(pills());
    expect(page).toContainElement(bandsTabs());
    // The layers are the Curves dropdown here too, never a row of chips.
    expect(page.querySelector('.active-layers')).toBeNull();
    // The tab row stands above the bands it opens.
    expect(
      Array.from(
        page.querySelectorAll('.eq-layer-tabs, .main-content'),
        (element) => element.classList[0],
      ),
    ).toEqual(['eq-layer-tabs', 'main-content']);
  });

  // The Expanded view, the graph grown in its own card, was taken out on
  // 2026-11-16 (Ivan: "get rid of Ctrl+S, the expanded mode, completely"), and
  // its case with it; full screen is the one larger view.
  it('keeps full screen the sheet over the whole column', async () => {
    const { container, column } = await renderShell();
    // The pane first: the graph leads the column under the head.
    expect(column).toHaveClass('is-graph-first');
    expect(column).not.toHaveClass('is-graph-full');

    await act(async () => {
      setGraphView('fullscreen');
    });

    // POSITIVE CONTROL: the graph is there, so the classes below are the
    // view's and not a graph that went missing.
    expect(container.querySelector('.graph-wrapper')).toBeInTheDocument();
    expect(column).toHaveClass('is-graph-full');
    expect(column).not.toHaveClass('is-graph-first');
    // The sheet covers the head, so the pills go back into the page.
    expect(container.querySelector('.center-head')).toBeNull();
    expect(
      container.querySelector('.workspace-tab-panel--eq'),
    ).toContainElement(pills());
  });

  // Only the Bands page opens with its graph (Ivan, 2026-09-29: "only on EQ
  // main page is on by default").
  it('opens the DSP page without its graph', async () => {
    const { container } = await renderShell();
    expect(container.querySelector('.graph-wrapper')).toBeInTheDocument();
    await pressTab('DSP', 'dsp');
    expect(container.querySelector('.graph-wrapper')).toBeNull();
  });

  it('keeps the DSP page above its graph, with no head', async () => {
    window.localStorage.setItem(
      'fluideq.graphVisibilityByTab',
      JSON.stringify({ dsp: true }),
    );
    const { container, column } = await renderShell();
    await pressTab('DSP', 'dsp');

    expect(screen.getByRole('tab', { name: 'DSP' })).toHaveAttribute(
      'aria-selected',
      'true',
    );
    // POSITIVE CONTROL: the graph is on here too, so the head's absence is
    // the page's kind, not a missing graph.
    expect(container.querySelector('.graph-wrapper')).toBeInTheDocument();
    expect(column).not.toHaveClass('is-graph-first');
    expect(container.querySelector('.center-head')).toBeNull();
    expect(onScreen(column)).toEqual(['page', 'divider', 'graph']);
  });
});

// Only the Bands page puts its graph on top (Ivan, 2026-09-29: "only the one
// on the EQ page goes on top, the rest always opens at the bottom").
describe('the other EQ pages', () => {
  it('open without their graph', async () => {
    const { container } = await renderShell();
    await pressTab('Headphone corrections', 'presets');
    expect(container.querySelector('.graph-wrapper')).toBeNull();
  });

  it('keep their graph under the page, and their pills in the page', async () => {
    window.localStorage.setItem(
      'fluideq.graphVisibilityByTab',
      JSON.stringify({ presets: true }),
    );
    const { container, column } = await renderShell();
    await pressTab('Headphone corrections', 'presets');

    const page = container.querySelector<HTMLElement>(
      '.workspace-tab-panel--presets',
    );
    if (!page) {
      throw new Error('the Headphone corrections page is missing');
    }
    // POSITIVE CONTROL: the graph is on, so where it stands is the page's
    // kind, not a missing graph.
    expect(container.querySelector('.graph-wrapper')).toBeInTheDocument();
    expect(column).not.toHaveClass('is-graph-first');
    expect(container.querySelector('.center-head')).toBeNull();
    expect(onScreen(column)).toEqual(['page', 'divider', 'graph']);
    expect(
      within(page).getByRole('tab', { name: 'Headphone corrections' }),
    ).toHaveAttribute('aria-selected', 'true');
  });
});
