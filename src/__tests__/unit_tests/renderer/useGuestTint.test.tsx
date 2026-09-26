/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * What the Media page remembers about a site between its pages, and how its
 * colours are put in and taken out.
 *
 * A page is asked after it has loaded, by which time it is usually wearing
 * this app's sheet, so its answer leaves out exactly the greys being changed.
 * Taken as the whole truth that erased the colours whenever a playlist moved
 * on to its next video; these hold that it only ever grows.
 */

import { act, renderHook, waitFor } from '@testing-library/react';
import type {
  IGuestPaint,
  IGuestTintReport,
  TGuestKeep,
} from '../../../renderer/video/guestTintProbe';
import { MAX_KEEPS } from '../../../renderer/video/guestTintProbe';
import { setGuestTintEnabled } from '../../../renderer/video/guestTintPreference';
import {
  learnSite,
  useGuestTint,
  type IGuestStyleTarget,
  type ISiteKnowledge,
} from '../../../renderer/video/useGuestTint';

const SURFACE: IGuestPaint = { text: false, surface: true };
const TEXT: IGuestPaint = { text: true, surface: false };

const report = (part: Partial<IGuestTintReport> = {}): IGuestTintReport => ({
  greys: [],
  ruleCount: undefined,
  ...part,
});

const KNOWN: ISiteKnowledge = {
  greys: [
    ['--page', 15, 15, 15, 1],
    ['--card', 33, 33, 33, 1],
  ],
  paints: new Map([
    ['--page', SURFACE],
    ['--card', SURFACE],
  ]),
  keeps: [['.chip', '--card']],
  ruleCount: 40,
};

describe('what is learned from a page', () => {
  it('keeps every grey it knew when a page leaves them out', () => {
    // The page read back through the sheet: its greys are the app's colour now.
    const { site, isNew } = learnSite(KNOWN, report({ ruleCount: 40 }));
    expect(site.greys).toEqual(KNOWN.greys);
    expect(isNew).toBe(false);
  });

  it('keeps the value a grey was first learned with', () => {
    const { site, isNew } = learnSite(
      KNOWN,
      report({ greys: [['--page', 0, 19, 9, 1]] }),
    );
    expect(site.greys).toContainEqual(['--page', 15, 15, 15, 1]);
    expect(site.greys).not.toContainEqual(['--page', 0, 19, 9, 1]);
    expect(isNew).toBe(false);
  });

  it('adds a grey it has not seen, and says the sheet must be built again', () => {
    const { site, isNew } = learnSite(
      KNOWN,
      report({ greys: [['--menu', 40, 40, 40, 1]] }),
    );
    expect(site.greys.map(([name]) => name)).toEqual([
      '--page',
      '--card',
      '--menu',
    ]);
    expect(isNew).toBe(true);
  });

  it('only ever finds more uses for a grey, never fewer', () => {
    const grown = learnSite(
      KNOWN,
      report({ paints: new Map([['--card', TEXT]]) }),
    );
    expect(grown.site.paints.get('--card')).toEqual({
      text: true,
      surface: true,
    });
    expect(grown.isNew).toBe(true);
    // A later page that shows it only as a surface does not unlearn the text.
    expect(
      learnSite(
        grown.site,
        report({ paints: new Map([['--card', SURFACE]]) }),
      ).site.paints.get('--card'),
    ).toEqual({ text: true, surface: true });
    // Told the same again, nothing is new.
    expect(
      learnSite(grown.site, report({ paints: new Map([['--card', TEXT]]) }))
        .isNew,
    ).toBe(false);
    // An answer that did not read the stylesheets leaves what was known.
    expect(learnSite(grown.site, report()).site.paints).toBe(grown.site.paints);
  });

  it('gathers the rules that keep a label, once each, up to the limit', () => {
    const twice = learnSite(
      KNOWN,
      report({
        keeps: [
          ['.chip', '--card'],
          ['.pill', '--card'],
          ['.pill', '--card'],
        ],
      }),
    );
    expect(twice.site.keeps).toEqual([
      ['.chip', '--card'],
      ['.pill', '--card'],
    ]);
    const full: ISiteKnowledge = {
      ...KNOWN,
      keeps: Array.from({ length: MAX_KEEPS - 1 }, (_, index): TGuestKeep => [
        `.rule-${index}`,
        '--card',
      ]),
    };
    const topped = learnSite(
      full,
      report({
        keeps: [
          ['.a', '--card'],
          ['.b', '--card'],
        ],
      }),
    );
    expect(topped.site.keeps).toHaveLength(MAX_KEEPS);
    expect(
      learnSite(topped.site, report({ keeps: [['.c', '--card']] })).isNew,
    ).toBe(false);
  });

  it("counts the page's rules from the latest answer that counted them", () => {
    expect(learnSite(KNOWN, report({ ruleCount: 41 })).site.ruleCount).toBe(41);
    expect(learnSite(KNOWN, report()).site.ruleCount).toBe(40);
  });
});

/**
 * A `<webview>` that answers every question with the next of `answers`, and
 * writes down, in order, what was asked of it.
 */
const fakePage = (answers: unknown[]) => {
  const log: string[] = [];
  const sheets = new Map<string, string>();
  let loaded: (() => void) | undefined;
  let asked = 0;
  const view: IGuestStyleTarget = {
    addEventListener: (type: string, listener: EventListener) => {
      if (type === 'did-stop-loading') {
        loaded = () => listener(new Event(type));
      }
    },
    removeEventListener: () => undefined,
    executeJavaScript: () => {
      const answer = answers[Math.min(asked, answers.length - 1)];
      asked += 1;
      log.push('ask');
      return Promise.resolve(answer);
    },
    insertCSS: (css: string) => {
      const key = `sheet-${sheets.size + 1}`;
      sheets.set(key, css);
      log.push(`insert ${key}`);
      return Promise.resolve(key);
    },
    removeInsertedCSS: (key: string) => {
      log.push(`remove ${key}`);
      return Promise.resolve();
    },
  };
  return {
    ref: { current: view },
    log,
    sheet: (key: string) => sheets.get(key) ?? '',
    finishLoading: () => loaded?.(),
  };
};

const TWITCH_ANSWER = {
  greys: [
    ['--color-background-body', 14, 14, 16, 1],
    ['--color-background-alt', 24, 24, 27, 1],
  ],
  rules: 12,
  paints: [
    ['--color-background-body', 0, 1],
    ['--color-background-alt', 0, 1],
  ],
  keeps: [],
};

afterEach(() => {
  act(() => setGuestTintEnabled(false));
});

describe('the Media page in the interface colours', () => {
  it('asks the page nothing and changes nothing until the user turns it on', async () => {
    const page = fakePage([TWITCH_ANSWER]);
    const { rerender } = renderHook(
      ({ token }) => useGuestTint(page.ref, 'twitch', token, true, false),
      { initialProps: { token: 1 } },
    );
    rerender({ token: 2 });
    expect(page.log).toEqual([]);

    act(() => setGuestTintEnabled(true));
    await waitFor(() => expect(page.log).toContain('insert sheet-1'));
    expect(page.sheet('sheet-1')).toContain('--color-background-body');
  });

  it('puts a new sheet in before it takes the old one out', async () => {
    act(() => setGuestTintEnabled(true));
    const page = fakePage([
      {
        ...TWITCH_ANSWER,
        greys: [['--suno-page', 16, 16, 18, 1]],
        paints: [['--suno-page', 0, 1]],
      },
    ]);
    const { rerender } = renderHook(
      ({ isOverScene }) => useGuestTint(page.ref, 'suno', 1, true, isOverScene),
      { initialProps: { isOverScene: false } },
    );
    await waitFor(() => expect(page.log).toContain('insert sheet-1'));

    // A scene starts behind the page: glass instead of colour.
    rerender({ isOverScene: true });
    await waitFor(() => expect(page.log).toContain('remove sheet-1'));
    expect(page.log.indexOf('insert sheet-2')).toBeLessThan(
      page.log.indexOf('remove sheet-1'),
    );
    expect(page.sheet('sheet-2')).toContain('--suno-page: transparent');
  });

  // The page stands on the window's floor now, not on a pane (Ivan,
  // 2026-09-26: "fix the color also"): tinted from the pane's colour, the
  // site was a slab of lighter slate in a dark window.
  it('puts the page in the floor’s colour, not the pane’s', async () => {
    const root = document.documentElement;
    root.style.setProperty('--surface-base', '#0a1b2c');
    root.style.setProperty('--surface-panel', '#22334a');
    act(() => setGuestTintEnabled(true));
    const page = fakePage([TWITCH_ANSWER]);
    renderHook(() => useGuestTint(page.ref, 'twitch', 1, true, false));
    await waitFor(() => expect(page.log).toContain('insert sheet-1'));
    // The control: the pane's colour is there to be picked, and is not.
    expect(page.sheet('sheet-1')).toContain('--color-background-body: #0a1b2c');
    expect(page.sheet('sheet-1')).not.toContain('#22334a');
    root.style.removeProperty('--surface-base');
    root.style.removeProperty('--surface-panel');
  });

  it('keeps colouring when the next page leaves out the greys it is changing', async () => {
    act(() => setGuestTintEnabled(true));
    const page = fakePage([
      {
        greys: [
          ['--ytm-page', 3, 3, 3, 1],
          ['--ytm-card', 33, 33, 33, 1],
        ],
        rules: 30,
        paints: [
          ['--ytm-page', 0, 1],
          ['--ytm-card', 0, 1],
        ],
        keeps: [],
      },
      // The next video: every grey reads back as the app's own colour.
      { greys: [], rules: 30 },
    ]);
    renderHook(() => useGuestTint(page.ref, 'youtube-music', 1, true, false));
    await waitFor(() => expect(page.log).toContain('insert sheet-1'));

    act(() => page.finishLoading());
    await waitFor(() =>
      expect(page.log.filter((entry) => entry === 'ask')).toHaveLength(2),
    );
    // The answer is handled on the turn after it is asked for; let it land
    // before looking, or this would pass on an answer nobody had read.
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });
    // Nothing new was learned, so the sheet in place stays, and still
    // colours both greys.
    expect(page.log).not.toContain('insert sheet-2');
    expect(page.log).not.toContain('remove sheet-1');
    expect(page.sheet('sheet-1')).toContain('--ytm-page:');
    expect(page.sheet('sheet-1')).toContain('--ytm-card:');
  });
});
