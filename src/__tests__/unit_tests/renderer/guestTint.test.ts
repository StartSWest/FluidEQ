/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * What colouring a Media site may touch, and how it fails.
 *
 * The greys below are YouTube's own, as its dark page reported them on
 * 2026-09-21 — including the randomly named variables its build uses for the
 * page itself, which are why this matches by value rather than by name.
 */

import {
  buildGuestTintCss,
  type IGuestTintKnowledge,
} from '../../../renderer/video/guestTint';
import {
  parseGuestTintReport,
  type IGuestPaint,
  type TGuestGrey,
} from '../../../renderer/video/guestTintProbe';

const PANEL = '#001309';

const YOUTUBE: TGuestGrey[] = [
  ['--t3e41d7b17b187f69', 15, 15, 15, 1],
  ['--yt-sys-color-baseline--base-background', 15, 15, 15, 1],
  ['--yt-sys-color-baseline--raised-background', 33, 33, 33, 1],
  ['--yt-sys-color-baseline--menu-background', 40, 40, 40, 1],
  ['--yt-sys-color-baseline--outline-opaque', 63, 63, 63, 1],
  // Darker than the page: where a letterbox and inverted text live.
  ['--yt-deprecated-black-pure', 0, 0, 0, 1],
  ['--yt-deprecated-black-4', 13, 13, 13, 1],
  // Not a neutral: a colour of the site's own.
  ['--yt-sys-color-baseline--add-on-red-base-background', 127, 1, 25, 1],
];

/** Every grey known to paint surfaces only. */
const surfaces = (greys: readonly TGuestGrey[]): IGuestTintKnowledge => ({
  greys,
  paints: new Map<string, IGuestPaint>(
    greys.map(([name]) => [name, { text: false, surface: true }]),
  ),
  keeps: [],
});

const PAGE = surfaces(YOUTUBE);

it('gives the page the panel colour, whatever the page calls the variable', () => {
  const css = buildGuestTintCss('youtube', PANEL, PAGE) ?? '';
  expect(css).toContain(`--t3e41d7b17b187f69: ${PANEL} !important;`);
  expect(css).toContain(
    `--yt-sys-color-baseline--base-background: ${PANEL} !important;`,
  );
});

it('keeps each step above the page the same share of the way to white', () => {
  const css = buildGuestTintCss('youtube', PANEL, PAGE) ?? '';
  // #212121 is 18 of the 240 levels between YouTube's page and white.
  expect(css).toContain(
    `--yt-sys-color-baseline--raised-background: color-mix(in srgb, ${PANEL}, #ffffff 7.50%) !important;`,
  );
  expect(css).toContain(
    `--yt-sys-color-baseline--menu-background: color-mix(in srgb, ${PANEL}, #ffffff 10.42%)`,
  );
});

it('never touches black, anything darker than the page, or a colour of its own', () => {
  const css = buildGuestTintCss('youtube', PANEL, PAGE) ?? '';
  expect(css).not.toContain('--yt-deprecated-black-pure');
  expect(css).not.toContain('--yt-deprecated-black-4');
  expect(css).not.toContain('add-on-red');
});

it('changes each site only in its dark mode', () => {
  expect(buildGuestTintCss('youtube', PANEL, PAGE)).toMatch(/^html\[dark\]/);
  expect(
    buildGuestTintCss(
      'twitch',
      PANEL,
      surfaces([['--color-background-body', 14, 14, 16, 1]]),
    ),
  ).toMatch(/^\.tw-root--theme-dark[^,]*, \.dark-theme/);
});

it('also colours what the site paints without a variable, at its own step', () => {
  const css = buildGuestTintCss('youtube', PANEL, PAGE) ?? '';
  expect(css).toContain('html[dark]:not(#fluideq-guest-tint) {');
  // The search box is #121212, three levels above the page.
  expect(css).toMatch(
    /\.ytSearchboxComponentInputBoxDark[^{]*\{\s*background-color: color-mix\(in srgb, #001309, #ffffff 1\.25%\) !important;/,
  );
});

it('does nothing rather than guess: another site, an odd colour, no greys', () => {
  expect(buildGuestTintCss('bandcamp', PANEL, PAGE)).toBeUndefined();
  expect(buildGuestTintCss(undefined, PANEL, PAGE)).toBeUndefined();
  expect(buildGuestTintCss('youtube', 'var(--x)', PAGE)).toBeUndefined();
  expect(buildGuestTintCss('youtube', PANEL, surfaces([]))).toBeUndefined();
  // A positive control beside the last: the same call with greys is not empty.
  expect(buildGuestTintCss('youtube', PANEL, PAGE)).toBeDefined();
});

it('trusts nothing from the page that is not a plain variable and three bytes', () => {
  expect(
    parseGuestTintReport({
      greys: [
        ['--fine', 15, 15, 15, 1],
        ['--x: red; } body { display: none', 15, 15, 15, 1],
        ['color', 15, 15, 15, 1],
        ['--too-bright', 300, 0, 0, 1],
        ['--half', 1.5, 2, 3, 1],
        ['--short', 1, 2],
        'nonsense',
      ],
    }).greys,
  ).toEqual([['--fine', 15, 15, 15, 1]]);
  expect(parseGuestTintReport(undefined).greys).toEqual([]);
});
