/**
 * @jest-environment-options {"customExportConditions": ["node", "node-addons"]}
 */
/* Copyright (C) 2026 Ivan Carmenates Garcia. SPDX-License-Identifier: GPL-3.0-or-later */

/**
 * A wheel anywhere over the look picker's discovery card scrolls the
 * picker's list (Ivan, 2026-11-28: "when on that button part I cannot use
 * scrolweel stnading there to scroll up").
 *
 * The card's upper part was a scroll container of its own with
 * `overscroll-behavior: contain`, and the glow behind its pictures overflowed
 * it sideways: Chromium latched every wheel over the title, the pictures and
 * the two lines above the buttons to a box with nothing to scroll, and the
 * list never moved. Measured with real wheel events in headless Chrome.
 *
 * jsdom scrolls nothing and dispatches a wheel to every ancestor whatever the
 * CSS says, so an event fired here would pass with the bug in place. What
 * decides where Chromium sends a wheel is which box on the way up is a
 * scroller, and that is held here instead: the real card is rendered, the
 * real sheets are compiled, and from each part of the card the first box that
 * can take a wheel must be the list itself. The list being found is the
 * positive control: it proves the sheets were read and matched.
 *
 * The export conditions are Node's so `sass` resolves its Node build, the one
 * that reads files; under jsdom's own it resolves the browser build.
 */

import path from 'path';
import { createRef } from 'react';
import { render, screen } from '@testing-library/react';
import { compile } from 'sass';
import { translate } from 'common/i18n';
import { resetAccountStore } from 'renderer/account/accountStore';
import LookPickerBody from 'renderer/graph/LookPickerBody';
import { buildStyleRows, type IStyleRow } from 'renderer/graph/lookPickerRows';
import { getSelectableLooks } from 'renderer/utils/graphStyle';
import { I18nProvider } from 'renderer/utils/I18nContext';

const STYLES_DIR = path.join(__dirname, '..', '..', '..', 'renderer', 'styles');

/** The sheets that style the card, the buttons in it and the list round it. */
const SHEETS = ['Button.scss', 'PlusWelcome.scss', 'LookPicker.scss'];

interface IRule {
  selector: string;
  declarations: ReadonlyArray<readonly [string, string]>;
}

/**
 * Every style rule of compiled CSS, the ones inside `@media`, `@container` and
 * `@supports` included (a rule that applies at some size applies at that
 * size); `@keyframes` and `@font-face` hold no selectors.
 */
const rulesOf = (css: string): IRule[] => {
  const text = css
    .replace(/\/\*[\s\S]*?\*\//g, '')
    // Statements that end in a semicolon and open no block.
    .replace(/@[a-z-]+[^{};]*;/g, '');
  const rules: IRule[] = [];
  const walk = (from: number, to: number) => {
    let at = from;
    while (at < to) {
      const open = text.indexOf('{', at);
      if (open < 0 || open >= to) {
        return;
      }
      let depth = 1;
      let close = open + 1;
      while (depth > 0 && close < to) {
        if (text[close] === '{') {
          depth += 1;
        } else if (text[close] === '}') {
          depth -= 1;
        }
        close += 1;
      }
      if (depth > 0) {
        throw new Error(`unbalanced block after "${text.slice(at, open)}"`);
      }
      const prelude = text.slice(at, open).trim();
      if (prelude.startsWith('@')) {
        if (!/^@(?:-webkit-)?(?:keyframes|font-face|property)/.test(prelude)) {
          walk(open + 1, close - 1);
        }
      } else {
        rules.push({
          selector: prelude,
          declarations: text
            .slice(open + 1, close - 1)
            .split(';')
            .map((line) => line.split(':'))
            .filter((parts) => parts.length >= 2)
            .map(
              ([name, ...value]) =>
                [name.trim(), value.join(':').trim()] as const,
            ),
        });
      }
      at = close;
    }
  };
  walk(0, text.length);
  return rules;
};

const RULES = SHEETS.flatMap((sheet) =>
  rulesOf(
    compile(path.join(STYLES_DIR, sheet), {
      loadPaths: [STYLES_DIR],
      quietDeps: true,
    }).css,
  ),
);

const SCROLLS = new Set(['auto', 'scroll']);
const CLIPS = new Set(['auto', 'scroll', 'hidden']);

/** Whether one of a box's rules can make it scroll or hold a scroll. */
const takesWheel = (element: Element) => {
  const across: string[] = [];
  const down: string[] = [];
  const held: string[] = [];
  RULES.forEach(({ selector, declarations }) => {
    const relevant = declarations.filter(
      ([name]) =>
        name.startsWith('overflow') || name.startsWith('overscroll-behavior'),
    );
    if (relevant.length === 0 || selector.includes('::')) {
      return;
    }
    // `matches` throws on a selector jsdom cannot read, which fails the case
    // rather than passing it with that rule unread.
    if (!element.matches(selector)) {
      return;
    }
    relevant.forEach(([name, value]) => {
      if (name.startsWith('overscroll-behavior')) {
        held.push(value);
      } else if (name === 'overflow') {
        const [x, y = x] = value.split(/\s+/);
        across.push(x);
        down.push(y);
      } else if (name === 'overflow-x' || name === 'overflow-inline') {
        across.push(value);
      } else if (name === 'overflow-y' || name === 'overflow-block') {
        down.push(value);
      }
    });
  });
  // `visible` beside a clipping axis computes to `auto`: overflow-x: hidden
  // alone is a box that scrolls up and down.
  const downComputesAuto =
    across.some((value) => CLIPS.has(value)) &&
    (down.length === 0 || down.includes('visible'));
  return (
    down.some((value) => SCROLLS.has(value)) ||
    across.some((value) => SCROLLS.has(value)) ||
    downComputesAuto ||
    held.some((value) => value !== 'auto')
  );
};

/** The first box from `part` up that a wheel over it would land on. */
const wheelLandsOn = (part: Element) => {
  let box: Element | null = part;
  while (box && !takesWheel(box)) {
    box = box.parentElement;
  }
  return box;
};

/** A box by its classes, so a failure names the box that kept the wheel. */
const named = (box: Element | null) =>
  box ? `.${Array.from(box.classList).join('.')}` : 'nothing';

const t = (key: Parameters<typeof translate>[1]) => translate('en', key);

const STYLES: readonly IStyleRow[] = buildStyleRows(
  getSelectableLooks([], 'signal', [], []),
  t,
);

const open = (styleRows: readonly IStyleRow[]) =>
  render(
    <I18nProvider>
      <LookPickerBody
        value=""
        styleRows={styleRows}
        plusRows={[]}
        query=""
        place="everything"
        from="all"
        view="grid"
        onQuery={jest.fn()}
        onPlace={jest.fn()}
        onFrom={jest.fn()}
        onSort={jest.fn()}
        onView={jest.fn()}
        onChoose={jest.fn()}
        searchRef={createRef<HTMLInputElement>()}
        onLeave={jest.fn()}
      />
    </I18nProvider>,
  );

/** Every part of the card a pointer can stand on. */
const PARTS = [
  'the title',
  'the lead picture',
  'the last picture',
  'the line under the pictures',
  'the free line',
  'the Explore scenes button',
  'the Create your own button',
  'the card itself, between its parts',
] as const;

const cardParts = (): Record<(typeof PARTS)[number], Element> => {
  const title = screen.getByText(t('graph.picker.discover.title'));
  const card = title.closest('.look-picker__discover');
  const pictures = card?.querySelectorAll('figure') ?? [];
  if (!card || pictures.length === 0) {
    throw new Error('no discovery card, or no picture in it');
  }
  return {
    'the title': title,
    'the lead picture': pictures[0],
    'the last picture': pictures[pictures.length - 1],
    'the line under the pictures': screen.getByText(
      t('graph.picker.discover.body'),
    ),
    'the free line': screen.getByText(t('graph.picker.discover.free')),
    'the Explore scenes button': screen.getByRole('button', {
      name: t('graph.picker.discover.explore'),
    }),
    'the Create your own button': screen.getByRole('button', {
      name: t('graph.picker.discover.create'),
    }),
    'the card itself, between its parts': card,
  };
};

beforeEach(() => {
  resetAccountStore();
  window.electron = { ipcRenderer: {} } as unknown as typeof window.electron;
});
afterEach(() => {
  resetAccountStore();
});

describe.each([
  ['under the standard looks', STYLES],
  ['alone, in a place with no look', []],
])('the discovery card %s', (_where, styleRows) => {
  it.each(PARTS)('sends a wheel over %s to the list', (part) => {
    const { container } = open(styleRows);
    const list = container.querySelector('[data-look-picker-scroll]');
    if (!list) {
      throw new Error('no list');
    }
    // The positive control: the list is read as the scroller it is.
    expect(takesWheel(list)).toBe(true);
    expect(named(wheelLandsOn(cardParts()[part]))).toBe(named(list));
  });
});
