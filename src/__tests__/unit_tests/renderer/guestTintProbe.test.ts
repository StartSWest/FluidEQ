/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * What the Media pages are asked, and what is believed of their answer.
 *
 * The probe is run here as a page runs it, against a page built for each
 * case: a stylesheet saying what every grey paints, and the greys the root
 * holds. The cases are the ones that were bugs on the real sites — YouTube
 * Music's Sign in label in its page's exact grey, its checkmark drawn as a
 * border, Twitch's tooltip text arriving after the page was asked.
 */

import {
  guestTintProbe,
  MAX_KEEPS,
  parseGuestTintReport,
} from '../../../renderer/video/guestTintProbe';

type TRawReport = {
  greys: [string, number, number, number, number][];
  rules: number;
  paints?: [string, 0 | 1, 0 | 1][];
  keeps?: [string, string][];
};

/** The root's colour variables, as a page's computed style lists them. */
const ROOT_VARIABLES: Record<string, string> = {
  '--page': 'rgb(15, 15, 15)',
  '--label': 'rgb(15, 15, 15)',
  '--both': 'rgb(33, 33, 33)',
  '--chained': 'rgb(40, 40, 40)',
  '--check': 'rgb(15, 15, 15)',
  '--color-text-tooltip': 'rgb(15, 15, 15)',
  '--color-background-tooltip': 'rgb(15, 15, 15)',
  '--glass': 'rgba(15, 15, 15, 0.8)',
  // Above the ladder: the site's grey text, never one of its surfaces.
  '--bright': 'rgb(200, 200, 200)',
  // Not a colour at all.
  '--gap': '12px',
};

const SHEET = `
  ytd-app { background: var(--page); }
  .pill { color: var(--label); }
  .card { background-color: var(--both); }
  .chip-text { color: var(--both); }
  html { color: var(--both); }
  .cover { color: var(--both); }
  .btn { --btn-ink: var(--chained); }
  .btn span { fill: var(--btn-ink); }
  .menu { background: var(--chained); }
  :root { --check: var(--label); }
  .check { border-color: var(--check); }
  @media (min-width: 1px) { .glass-bar { background: var(--glass); } }
`;

/** A stand-in for the computed style of the root, holding `variables`. */
const rootStyle = (variables: Record<string, string>) => {
  const names = Object.keys(variables);
  return Object.assign([...names], {
    getPropertyValue: (name: string) => variables[name] ?? '',
  });
};

/**
 * The page a probe is run against. jsdom computes no custom properties, so
 * the root's computed style is the list above; every other element answers
 * with the colour it was given, which is all the probe asks of one.
 */
const buildPage = (
  sheet: string,
  variables: Record<string, string> = ROOT_VARIABLES,
) => {
  document.head.innerHTML = `<style>${sheet}</style>`;
  document.body.innerHTML = '<div class="cover"></div>';
  jest.spyOn(window, 'getComputedStyle').mockImplementation((element) =>
    element === document.documentElement
      ? (rootStyle(variables) as unknown as CSSStyleDeclaration)
      : ({
          color: (element as HTMLElement).style.color,
        } as CSSStyleDeclaration),
  );
  // The one element that covers the window, as a full-page wrapper does.
  jest
    .spyOn(Element.prototype, 'getBoundingClientRect')
    .mockImplementation(function box(this: Element) {
      const whole = this.classList.contains('cover');
      return {
        width: whole ? window.innerWidth : 0,
        height: whole ? window.innerHeight : 0,
      } as DOMRect;
    });
};

const ask = (lastRuleCount?: number, knownNames: string[] = []) =>
  // eslint-disable-next-line no-new-func -- the probe is the page's own script, run as the page runs it
  new Function(
    `return ${guestTintProbe(lastRuleCount, knownNames)}`,
  )() as TRawReport;

const paintOf = (report: TRawReport, name: string) =>
  report.paints?.find(([found]) => found === name)?.slice(1);

afterEach(() => {
  jest.restoreAllMocks();
});

describe('what a page is asked', () => {
  it('lists the dark greys on its root, and nothing brighter or not a colour', () => {
    buildPage(SHEET);
    const names = ask().greys.map(([name]) => name);
    expect(names).toEqual([
      '--page',
      '--label',
      '--both',
      '--chained',
      '--check',
      '--color-text-tooltip',
      '--color-background-tooltip',
      '--glass',
    ]);
    expect(ask().greys).toContainEqual(['--glass', 15, 15, 15, 0.8]);
  });

  it('tells a grey that paints text from one that paints surfaces, and from one that paints both', () => {
    buildPage(SHEET);
    const report = ask();
    expect(paintOf(report, '--page')).toEqual([0, 1]);
    // The Sign in label: the page's exact grey, and only ever text.
    expect(paintOf(report, '--label')).toEqual([1, 0]);
    expect(paintOf(report, '--both')).toEqual([1, 1]);
    // Inside a media rule, and translucent: still read.
    expect(paintOf(report, '--glass')).toEqual([0, 1]);
  });

  it('follows a grey through the variables defined from it', () => {
    buildPage(SHEET);
    // `.btn span` fills with --btn-ink, which `.btn` defines from --chained.
    expect(paintOf(ask(), '--chained')).toEqual([1, 1]);
  });

  it('takes a grey defined on the root from a text colour as text, whatever draws it', () => {
    buildPage(SHEET);
    // YouTube Music's checkmark is a border in its label's colour.
    expect(paintOf(ask(), '--check')).toEqual([1, 0]);
    // And the label is not made a surface by the checkmark defined from it.
    expect(paintOf(ask(), '--label')).toEqual([1, 0]);
  });

  it('takes an unread grey at its name only when the name says text', () => {
    buildPage(SHEET);
    const report = ask();
    // Twitch's tooltip text, whose rules arrive with the tooltip.
    expect(paintOf(report, '--color-text-tooltip')).toEqual([1, 0]);
    // Its background, unread too, stays unknown rather than guessed.
    expect(paintOf(report, '--color-background-tooltip')).toEqual([0, 0]);
  });

  it('keeps a grey that paints both on the rules where it is text, never on the root or a window-sized box', () => {
    buildPage(SHEET);
    const { keeps } = ask();
    expect(keeps).toEqual(
      expect.arrayContaining([
        ['.chip-text', '--both'],
        ['.btn', '--chained'],
      ]),
    );
    const selectors = (keeps ?? []).map(([selector]) => selector);
    expect(selectors).not.toContain('html');
    expect(selectors).not.toContain('.cover');
    // Surfaces are never kept.
    expect(selectors).not.toContain('.card');
    expect(selectors).not.toContain('.menu');
  });

  it('reads the stylesheets again only when they or the greys have changed', () => {
    buildPage(SHEET);
    const first = ask();
    expect(first.paints).toBeDefined();
    const known = first.greys.map(([name]) => name);

    const unchanged = ask(first.rules, known);
    expect(unchanged.greys).toEqual(first.greys);
    expect(unchanged.paints).toBeUndefined();
    expect(unchanged.keeps).toBeUndefined();

    // A grey nobody has looked up yet is a reason to read them.
    expect(ask(first.rules, known.slice(1)).paints).toBeDefined();
    // So is a different number of rules.
    expect(ask(first.rules + 1, known).paints).toBeDefined();
  });

  it('sends only plain variable names back into the page it asks', () => {
    const script = guestTintProbe(3, ['--fine', '--x"]); alert(1); (["']);
    expect(script).toContain('new Set(["--fine"])');
    expect(script).not.toContain('alert');
  });
});

describe('what is believed of the answer', () => {
  it('takes what a grey paints only as two flags on a plain name', () => {
    const { paints } = parseGuestTintReport({
      greys: [],
      paints: [
        ['--text', 1, 0],
        ['--both', 1, 1],
        ['--odd', 2, 0],
        ['--short', 1],
        ['not a variable', 1, 0],
      ],
    });
    expect([...(paints ?? new Map()).entries()]).toEqual([
      ['--text', { text: true, surface: false }],
      ['--both', { text: true, surface: true }],
    ]);
  });

  it('refuses any selector that could reach outside the rule it is put in', () => {
    const { keeps } = parseGuestTintReport({
      greys: [],
      keeps: [
        ['.chip-text', '--both'],
        ['button[aria-label="Sign (in)"] > span', '--label'],
        ['a } body { display: none', '--both'],
        ['a; color: red', '--both'],
        ['& .nested', '--both'],
        ['.pill::before', '--both'],
        [':host(.x)', '--both'],
        ['a:is(.b', '--both'],
        ['a)', '--both'],
        ['[title="open', '--both'],
        [`.${'x'.repeat(400)}`, '--both'],
        ['.fine', '--x: red'],
      ],
    });
    expect(keeps).toEqual([
      ['.chip-text', '--both'],
      ['button[aria-label="Sign (in)"] > span', '--label'],
    ]);
  });

  it('takes no more kept rules than the limit from one answer', () => {
    const many = Array.from({ length: MAX_KEEPS + 50 }, (_, index) => [
      `.rule-${index}`,
      '--both',
    ]);
    expect(parseGuestTintReport({ greys: [], keeps: many }).keeps).toHaveLength(
      MAX_KEEPS,
    );
  });

  it('counts rules only as a whole number, and leaves out what was not read', () => {
    expect(parseGuestTintReport({ greys: [], rules: 12 }).ruleCount).toBe(12);
    expect(
      parseGuestTintReport({ greys: [], rules: -1 }).ruleCount,
    ).toBeUndefined();
    expect(
      parseGuestTintReport({ greys: [], rules: 1.5 }).ruleCount,
    ).toBeUndefined();
    const unread = parseGuestTintReport({ greys: [], rules: 12 });
    expect(unread).not.toHaveProperty('paints');
    expect(unread).not.toHaveProperty('keeps');
  });
});
