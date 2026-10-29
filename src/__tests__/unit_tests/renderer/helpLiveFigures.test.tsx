/* Copyright (C) 2026 Ivan Carmenates Garcia. SPDX-License-Identifier: GPL-3.0-or-later */

import '@testing-library/jest-dom';
import type { ComponentType } from 'react';
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
} from '@testing-library/react';
import {
  HELP_CHAPTERS,
  isLiveFigure,
  type IHelpLiveFigure,
} from 'common/helpGuide';
import { LOCALES, loadLocale, translate, type LocaleCode } from 'common/i18n';
import HelpLiveFigure from 'renderer/help/HelpLiveFigure';
import { HelpColumnContext } from 'renderer/help/HelpColumn';
import HelpLiveSurface, {
  type IHelpLiveMeasure,
} from 'renderer/help/live/HelpLiveSurface';
import HelpLiveEnlarged from 'renderer/help/live/HelpLiveEnlarged';
import { helpLiveDrawing } from 'renderer/help/live/helpLiveFigures';
import { I18nProvider } from 'renderer/utils/I18nContext';

// Drawn as a shipped build draws them, with accounts: only then does the
// title bar have its Visualizers tab (`WorkspaceTabsRight`).
jest.mock('common/accountConfig', () => ({
  ...jest.requireActual('common/accountConfig'),
  isAccountConfigured: () => true,
}));

/**
 * Every live figure in the guide, drawn in every language.
 *
 * A live figure's controls are found on the drawing by selector
 * (`IHelpLiveControl.target`), and only once it is drawn: a class renamed in
 * the panel, a control taken out of it, or a drawing that throws in one
 * language would otherwise leave a figure with a line in its list and no
 * circle, or no figure at all, and nothing in the suite would know.
 */

const LIVE = HELP_CHAPTERS.flatMap((chapter) =>
  chapter.figures.flatMap((figure, index) =>
    isLiveFigure(figure)
      ? [{ name: `${chapter.id} ${index + 1} (${figure.live})`, figure }]
      : [],
  ),
);

/** Every selector the figure names that matches nothing in `drawn`. */
const missingIn = (drawn: Element, figure: IHelpLiveFigure) =>
  [figure.frame, ...(figure.controls ?? []).map(({ target }) => target)]
    .filter((selector): selector is string => selector !== undefined)
    .filter((selector) => drawn.querySelector(selector) === null);

/**
 * The drawing, settled: the title bar's tab strips measure their lit tab
 * again when the underline they draw for it arrives, which a mutation
 * observer reports just after the render — inside an act that waits.
 */
const drawIn = async (locale: LocaleCode, figure: IHelpLiveFigure) => {
  window.localStorage.setItem('fluideq.locale', locale);
  const Drawing = helpLiveDrawing(figure.live);
  if (!Drawing) {
    throw new Error(`no drawing for ${figure.live}`);
  }
  const { container } = render(
    <I18nProvider>
      <Drawing />
    </I18nProvider>,
  );
  await act(async () => undefined);
  return container;
};

beforeAll(() => Promise.all(LOCALES.map(({ code }) => loadLocale(code))));

afterEach(() => {
  cleanup();
  window.localStorage.clear();
  jest.restoreAllMocks();
});

it('has live figures to check, each with a drawing', () => {
  expect(LIVE.length).toBeGreaterThan(0);
  expect(
    LIVE.filter(({ figure }) => !helpLiveDrawing(figure.live)).map(
      ({ name }) => name,
    ),
  ).toEqual([]);
});

describe.each(LOCALES.map(({ code }) => code))('in %s', (locale) => {
  it.each(LIVE.map(({ name, figure }) => [name, figure] as const))(
    'draws %s with everything it frames and names',
    async (_, figure) => {
      expect(missingIn(await drawIn(locale, figure), figure)).toEqual([]);
    },
  );
});

// The check above passes just as well if nothing is ever reported missing:
// here is one it must report.
it('reports a control the drawing does not have', async () => {
  const [{ figure }] = LIVE;
  const broken: IHelpLiveFigure = {
    ...figure,
    controls: [
      ...(figure.controls ?? []),
      { target: '.not-in-any-panel', name: 'help.title', text: 'help.title' },
    ],
  };
  expect(missingIn(await drawIn('en', broken), broken)).toEqual([
    '.not-in-any-panel',
  ]);
});

it.each(['de', 'ja', 'ru'] as const)(
  "speaks the reader's language: %s",
  async (locale) => {
    const menu = LIVE.find(({ figure }) => figure.live === 'player-menu');
    if (!menu) {
      throw new Error('the guide has no live player menu');
    }
    expect(await drawIn(locale, menu.figure)).toHaveTextContent(
      translate(locale, 'player.menu.fullApp'),
    );
  },
);

describe('a live figure in the guide', () => {
  const folded = LIVE.find(({ figure }) => figure.live === 'player-folded');
  if (!folded) {
    throw new Error('the guide has no live folded player');
  }
  const { figure } = folded;

  /**
   * An observer the case can fire: the setup's stand-in never reports, as
   * jsdom has no viewport, so nothing would ever come near.
   */
  type TWatcher = (entries: Array<{ isIntersecting: boolean }>) => void;
  const watched: TWatcher[] = [];
  // A constructor returning an object: `new` hands back that object, as
  // `plusGallery.test.tsx` does it.
  function WatchingObserver(callback: TWatcher) {
    watched.push(callback);
    return {
      observe: () => undefined,
      disconnect: () => undefined,
      unobserve: () => undefined,
    };
  }
  const comeNear = () =>
    act(() =>
      watched.forEach((callback) => callback([{ isIntersecting: true }])),
    );
  const standIn = globalThis.IntersectionObserver;
  beforeEach(() => {
    watched.length = 0;
    globalThis.IntersectionObserver =
      WatchingObserver as unknown as typeof IntersectionObserver;
  });
  afterEach(() => {
    globalThis.IntersectionObserver = standIn;
  });

  const show = (onEnlarge = jest.fn()) => {
    const { container } = render(
      <HelpColumnContext.Provider value={{ width: 800, height: 900 }}>
        <HelpLiveFigure
          figure={figure}
          anchor="player/figure/4"
          title="Folded to one line"
          onEnlarge={onEnlarge}
        />
      </HelpColumnContext.Provider>,
    );
    return { container, onEnlarge };
  };

  it('is drawn as the reader nears it, not before', () => {
    const { container } = show();
    expect(container.querySelector('.help-live')).toBeNull();
    comeNear();
    expect(container.querySelector('.help-live')).not.toBeNull();
  });

  it('is a picture: nothing in it can be pressed, focused or read out', () => {
    const { container } = show();
    comeNear();
    const drawing = container.querySelector('.help-live');
    expect(drawing).toHaveAttribute('inert');
    expect(drawing).toHaveAttribute('aria-hidden', 'true');
    // The panel's own buttons are drawn, and none of them is reachable.
    expect(drawing?.querySelector('.player-fold__play')).not.toBeNull();
    expect(screen.queryByRole('button', { name: /pause/i })).toBeNull();
    // What a capture's `alt` says, the frame says.
    expect(
      screen.getByRole('img', { name: 'Folded to one line' }),
    ).toContainElement(drawing as HTMLElement);
  });

  it('is named the same when it is enlarged', () => {
    render(<HelpLiveEnlarged figure={figure} title="Folded to one line" />);
    expect(
      screen.getByRole('img', { name: 'Folded to one line' }),
    ).toBeInTheDocument();
  });

  it('lists every control it names, numbered as listed, before it is measured', () => {
    show();
    const lines = screen.getAllByRole('listitem');
    expect(lines).toHaveLength(figure.controls?.length ?? 0);
    lines.forEach((line, index) => {
      expect(line).toHaveTextContent(String(index + 1));
      expect(line).toHaveTextContent(
        translate('en', figure.controls?.[index]?.name ?? 'help.title'),
      );
    });
  });

  it('enlarges on its own button, over the drawing rather than round it', () => {
    const { onEnlarge } = show();
    comeNear();
    const enlarge = screen.getByRole('button', {
      name: translate('en', 'help.enlarge', { title: 'Folded to one line' }),
    });
    expect(enlarge.querySelector('.help-live')).toBeNull();
    fireEvent.click(enlarge);
    expect(onEnlarge).toHaveBeenCalledTimes(1);
  });
});

describe('measuring a drawing', () => {
  // A panel 400 CSS pixels wide drawn at half size, 100 and 50 pixels into
  // the page: its frame starts 20 of its own pixels in, a control is two
  // buttons taken together, and one control is not drawn at all.
  const PLACED: Record<string, [number, number, number, number]> = {
    'help-live__drawing': [100, 50, 200, 150],
    panel: [110, 60, 150, 100],
    first: [120, 70, 10, 10],
    second: [140, 75, 20, 10],
    // A list that clips what scrolls in it, one row shown and one below.
    list: [110, 60, 100, 40],
    shown: [120, 70, 10, 10],
    scrolled: [120, 120, 10, 10],
  };
  let rects = { ...PLACED };
  beforeEach(() => {
    rects = { ...PLACED };
    jest
      .spyOn(Element.prototype, 'getBoundingClientRect')
      .mockImplementation(function rectOf(this: Element) {
        const [x, y, width, height] = rects[this.className] ?? [0, 0, 0, 0];
        return {
          x,
          y,
          width,
          height,
          left: x,
          top: y,
          right: x + width,
          bottom: y + height,
          toJSON: () => undefined,
        };
      });
  });

  const figure: IHelpLiveFigure = {
    live: 'test-panel',
    width: 400,
    height: 300,
    frame: '.panel',
    still: 'test.png',
    controls: [
      { target: '.first, .second', name: 'help.title', text: 'help.title' },
      { target: '.absent', name: 'help.title', text: 'help.title' },
    ],
  };
  const Panel = () => (
    <div className="panel">
      <button type="button" className="first" aria-label="First" />
      <button type="button" className="second" aria-label="Second" />
    </div>
  );
  const measured = (drawn: IHelpLiveFigure, Drawing: ComponentType) => {
    const onMeasure = jest.fn((measure: IHelpLiveMeasure) => measure);
    const view = render(
      <HelpLiveSurface
        figure={drawn}
        Drawing={Drawing}
        zoom={0.5}
        onMeasure={onMeasure}
      />,
    );
    return { onMeasure, ...view };
  };

  it('reads the frame and every control in the panel’s own pixels, whatever the zoom', () => {
    const { onMeasure } = measured(figure, Panel);
    expect(onMeasure).toHaveBeenLastCalledWith({
      width: 300,
      height: 200,
      boxes: [[20, 20, 80, 30], undefined],
    });
  });

  // The title bar's parts are framed with some of the bar round them, as a
  // capture's crop kept some. The drawing has 20 of its pixels above and
  // left of the panel and 80 right of and below it: 30 asked for are cut
  // to what there is on two sides, 100 on all four.
  it('keeps the room it is asked for round its part, inside the drawing', () => {
    const near = measured({ ...figure, margin: 30 }, Panel).onMeasure;
    expect(near).toHaveBeenLastCalledWith({
      width: 350,
      height: 250,
      boxes: [[40, 40, 80, 30], undefined],
    });
    cleanup();
    const far = measured({ ...figure, margin: 100 }, Panel).onMeasure;
    expect(far).toHaveBeenLastCalledWith({
      width: 400,
      height: 300,
      boxes: [[40, 40, 80, 30], undefined],
    });
  });

  // A whole page shown plain, as the Share Audio chapter's is: nothing to
  // frame and nothing named. An empty selector throws, and threw the window
  // into recovery.
  it('draws a figure that frames and names nothing, whole', () => {
    const { onMeasure } = measured(
      { ...figure, frame: undefined, controls: undefined },
      Panel,
    );
    expect(onMeasure).toHaveBeenLastCalledWith({
      width: 400,
      height: 300,
      boxes: [],
    });
  });

  // A row scrolled out of its list still has a rectangle, below the list's:
  // counted, the queue's remove keys reached past the bottom of the player.
  it('counts only what the lists in it show', () => {
    // jsdom's styles know no `overflow`, so the list's is stood in for, as
    // its rectangle is.
    const computed = window.getComputedStyle;
    jest.spyOn(window, 'getComputedStyle').mockImplementation((element) =>
      element.classList.contains('list')
        ? ({
            overflow: 'hidden',
            overflowX: 'hidden',
            overflowY: 'hidden',
          } as CSSStyleDeclaration)
        : computed(element),
    );
    const List = () => (
      <div className="panel">
        <div className="list">
          <button type="button" className="shown" aria-label="Shown" />
          <button type="button" className="scrolled" aria-label="Scrolled" />
        </div>
      </div>
    );
    const { onMeasure } = measured(
      {
        ...figure,
        controls: [
          {
            target: '.shown, .scrolled',
            name: 'help.title',
            text: 'help.title',
          },
          { target: '.scrolled', name: 'help.title', text: 'help.title' },
        ],
      },
      List,
    );
    expect(onMeasure.mock.lastCall?.[0].boxes).toEqual([
      [20, 20, 20, 20],
      undefined,
    ]);
  });

  // The mark's menu opens with a scale, which changes nothing's size: read
  // half-way, it lost its last row, and only the end of the motion says so.
  it('measures again when something in it finishes moving', () => {
    const { onMeasure, container } = measured(figure, Panel);
    rects.second = [140, 75, 40, 20];
    fireEvent.animationEnd(container.querySelector('.second') as Element);
    expect(onMeasure.mock.lastCall?.[0].boxes[0]).toEqual([20, 20, 120, 50]);
  });

  it('loads its pictures at once, not when the browser judges them seen', () => {
    const Picture = () => (
      <div className="panel">
        <img className="first" src="cover.png" alt="" loading="lazy" />
      </div>
    );
    const { container } = measured(figure, Picture);
    expect(container.querySelector('img')?.loading).toBe('eager');
  });

  it('measures nothing while nothing is laid out', () => {
    rects = {};
    const { onMeasure } = measured(figure, Panel);
    expect(onMeasure).not.toHaveBeenCalled();
  });
});
