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
  buildGuestGlassCss,
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

// The Media page lifts toward white with a little of the accent in it, so a
// site's cards carry the hue the app's own cards do (Ivan, 2026-09-26: "fix
// the color also"); the page itself stays the ground.
it('lifts each step toward the colour it is given', () => {
  const lift = 'color-mix(in srgb, #ffffff 80%, #a1fcff)';
  const css = buildGuestTintCss('youtube', PANEL, PAGE, lift) ?? '';
  expect(css).toContain(
    `--yt-sys-color-baseline--raised-background: color-mix(in srgb, ${PANEL}, ${lift} 7.50%) !important;`,
  );
  expect(css).toContain(
    `--yt-sys-color-baseline--base-background: ${PANEL} !important;`,
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

describe('what the page stands on, and what keeps its colour', () => {
  /**
   * YouTube Music, as its stylesheets said: its page, a card above it, its
   * Sign in label in the page's exact grey, a grey that is both a surface and
   * the label of a white chip, and one nobody has seen used yet.
   */
  const MUSIC: IGuestTintKnowledge = {
    greys: [
      ['--ytm-page', 3, 3, 3, 1],
      ['--ytm-label', 3, 3, 3, 1],
      ['--ytm-both', 3, 3, 3, 1],
      ['--ytm-card', 33, 33, 33, 1],
      ['--ytm-unread', 3, 3, 3, 1],
    ],
    paints: new Map<string, IGuestPaint>([
      ['--ytm-page', { text: false, surface: true }],
      ['--ytm-label', { text: true, surface: false }],
      ['--ytm-both', { text: true, surface: true }],
      ['--ytm-card', { text: true, surface: true }],
    ]),
    keeps: [
      ['.chip-text', '--ytm-both'],
      ['.card-title', '--ytm-card'],
      ['.pill', '--ytm-label'],
    ],
  };

  it('never changes a grey that only paints text, in either mode', () => {
    [
      buildGuestGlassCss('youtube-music', PANEL, MUSIC),
      buildGuestTintCss('youtube-music', PANEL, MUSIC),
    ].forEach((css) => {
      expect(css).toContain('--ytm-label: rgb(3, 3, 3) !important;');
      // A grey whose use is not known yet is kept the same way.
      expect(css).toContain('--ytm-unread: rgb(3, 3, 3) !important;');
    });
  });

  it('over a scene, clears the page and makes what stands above it glass of its own grey', () => {
    const css = buildGuestGlassCss('youtube-music', PANEL, MUSIC) ?? '';
    expect(css).toContain('--ytm-page: transparent !important;');
    expect(css).toContain('--ytm-card: rgba(33, 33, 33, 0.88) !important;');
    // One even wash on the root, not one per nested surface.
    expect(css).toContain(
      'html:not(#fluideq-guest-tint) {\n  background-color: rgba(0, 0, 0, 0.35) !important;\n}',
    );
    // YouTube Music paints its page on the body as a colour.
    expect(css).toContain(
      'body:not(#fluideq-guest-tint) {\n  background-color: transparent !important;\n}',
    );
    // Its bars in the interface's colour, nearly solid.
    expect(css).toContain(
      '#nav-bar-background:not(#fluideq-guest-tint),\nytmusic-player-bar:not(#fluideq-guest-tint) {\n  background-color: color-mix(in srgb, #001309 92%, transparent) !important;\n}',
    );
  });

  it('over a scene, gives a label back its colour where the page writes text in a cleared grey', () => {
    const css = buildGuestGlassCss('youtube-music', PANEL, MUSIC) ?? '';
    expect(css).toContain('--ytm-both: transparent !important;');
    expect(css).toContain(
      ':is(:root:not(#fluideq-guest-tint)) :is(.chip-text):not(#fluideq-guest-tint) {\n  --ytm-both: #001309 !important;\n}',
    );
    // At the grey's own darkness when it stands above the page.
    expect(css).toContain(
      ':is(.card-title):not(#fluideq-guest-tint) {\n  --ytm-card: color-mix(in srgb, #001309, #ffffff 11.90%) !important;\n}',
    );
    // A grey that was never changed needs nothing put back.
    expect(css).not.toContain(':is(.pill)');
  });

  it('without a scene, colours a grey that is both everywhere, and keeps no rules', () => {
    const css = buildGuestTintCss('youtube-music', PANEL, MUSIC) ?? '';
    expect(css).toContain(`--ytm-both: ${PANEL} !important;`);
    expect(css).not.toContain(':is(');
  });

  it("leaves YouTube's root to the wash, and makes its search box glass", () => {
    const css = buildGuestGlassCss('youtube', PANEL, PAGE) ?? '';
    // Written again on the root it would be the more specific rule and take
    // the wash away.
    expect(css).not.toMatch(
      /html\[dark\]:not\(#fluideq-guest-tint\) \{\s*background-color/,
    );
    expect(css).toContain(
      '.ytSearchboxComponentInputBoxDark:not(#fluideq-guest-tint) {\n  background-color: rgba(18, 18, 18, 0.63) !important;\n}',
    );
  });

  it('builds nothing when every grey it knows is text', () => {
    const text: IGuestTintKnowledge = {
      greys: [['--ytm-label', 3, 3, 3, 1]],
      paints: new Map([['--ytm-label', { text: true, surface: false }]]),
      keeps: [],
    };
    expect(buildGuestGlassCss('youtube-music', PANEL, text)).toBeUndefined();
    expect(buildGuestTintCss('youtube-music', PANEL, text)).toBeUndefined();
    // The same page with one surface grey beside it is coloured.
    const withPage: IGuestTintKnowledge = {
      ...text,
      greys: [...text.greys, ['--ytm-page', 3, 3, 3, 1]],
      paints: new Map([
        ...text.paints,
        ['--ytm-page', { text: false, surface: true }],
      ]),
    };
    expect(buildGuestGlassCss('youtube-music', PANEL, withPage)).toBeDefined();
    expect(buildGuestTintCss('youtube-music', PANEL, withPage)).toBeDefined();
  });
});
