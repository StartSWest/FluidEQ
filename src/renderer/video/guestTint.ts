/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import type { IGuestPaint, TGuestGrey, TGuestKeep } from './guestTintProbe';

/**
 * The Media sites in the interface's colour.
 *
 * WHAT IS CHANGED, AND WHAT NEVER IS. Only the neutral dark greys a site paints
 * its own page with — its page, cards, menus and outlines. Never the video, a
 * thumbnail, an ad, a logo or anything a site sells or shows: a picture is
 * somebody's work and an ad is somebody's income, and neither is this app's to
 * recolour. YouTube's, Twitch's and Suno's terms all ask users not to modify
 * the service; a user choosing, on their own screen, the colour of the page
 * around the picture is the narrowest thing that could touch, and it is off
 * until the user turns it on (`guestTintPreference.ts`).
 *
 * BY VALUE, NEVER BY NAME. The first version replaced each site's colour
 * variables by their names, and did nothing at all to YouTube: its page is
 * painted from variables its build names at random (`--t3e41d7b17b187f69`)
 * and renames with any release, while the readable names beside them are no
 * longer used for the page. So the page is asked, each time it loads, which of
 * its colour variables hold one of its own dark greys (`guestTintProbe.ts`),
 * and each of those is given the interface's colour at the same darkness. A
 * site can rename everything and this still holds; a site that changes its
 * greys is simply not tinted any more. Nothing here can break a page — at
 * worst it stops colouring it.
 *
 * NEVER TEXT. A value does not say what it is for: the label of a white button
 * is often the page's own grey. The page's stylesheets do say, and the probe
 * reads them: a grey that only ever paints text keeps its colour, and one that
 * paints both keeps it on the rules that use it as text wherever the page is
 * made clear (`TGuestKeep`).
 *
 * AT THE SAME DARKNESS. Each grey is rebuilt from the colour the page stands
 * on in the interface — its ground — by mixing in the same share of the lift
 * that stands it above the site's own page: YouTube's page is #0f0f0f and its
 * cards #212121, 7.5% of the way to white, so its cards become the ground with
 * 7.5% of the lift. The lift is white unless the caller gives one; the Media
 * page gives white with a little of the accent in it, so the site's cards
 * carry the hue the app's own cards do rather than lifting to grey
 * (`useGuestTint`). The site keeps the steps it had between page, card and
 * menu, and takes the interface's colours.
 * Pure black and anything darker than the page is left alone: that is where a
 * video letterbox and inverted text live.
 *
 * ONLY IN THE DARK. Each site is tinted under its own dark mode and nowhere
 * else; a dark ground under a light theme's dark text would be unreadable.
 *
 * Bandcamp is not in the list. It is a light site whose artist pages wear each
 * artist's own colours; recolouring it would be redesigning it, and overriding
 * an artist's page is not a colour preference.
 */

/** A site this can tint: where its dark mode is, and what its page is. */
interface IGuestTintSite {
  /**
   * The site's dark mode, raised past anything of the site's own by a
   * never-matching id: the rules here and the site's rules are equally
   * `!important` and the order of an injected sheet against the page's is
   * not something to depend on.
   */
  scope: string;
  /** The page's own grey, measured in dark mode on 2026-09-21. */
  page: readonly [number, number, number];
  /**
   * How far a grey's channels may differ and still count as the site's
   * neutral: Twitch's and Suno's greys lean a little blue.
   */
  tolerance: number;
  /**
   * Backgrounds the site writes as a colour rather than through a variable,
   * with the grey each one is: found one at a time by asking the page what
   * paints a surface that stayed grey. A selector that stops matching simply
   * stops tinting.
   */
  literals?: ReadonlyArray<readonly [string, number, number, number]>;
  /**
   * What paints the site's own top bar. Over a scene the page goes to glass,
   * and the bar went with it: it shares the page's variable, so over a dark
   * sky it was a black strip under FluidEQ's own bar (Ivan: "it's still black,
   * I want to see it well tinted"). Over a scene it takes the interface's
   * colour instead, nearly solid, and reads as FluidEQ's bar carried on.
   */
  bars?: readonly string[];
}

const RAISE = ':not(#fluideq-guest-tint)';

export const GUEST_TINT_SITES: Readonly<Record<string, IGuestTintSite>> = {
  youtube: {
    scope: `html[dark]${RAISE}`,
    page: [15, 15, 15],
    tolerance: 2,
    literals: [
      [`html[dark]${RAISE}`, 15, 15, 15],
      [`html[dark] .ytSearchboxComponentInputBoxDark${RAISE}`, 18, 18, 18],
    ],
    // The bar's own box, the frosted state it takes once the page scrolls,
    // and the frosted sheet the home page lays under the bar and its chips.
    bars: [
      `html[dark] #background.ytd-masthead${RAISE}`,
      `html[dark] ytd-masthead[frosted-glass-mode]${RAISE}`,
      `html[dark] #frosted-glass${RAISE}`,
    ],
  },
  'youtube-music': {
    scope: `:root${RAISE}`,
    page: [3, 3, 3],
    tolerance: 2,
    // The page is painted onto the body as a colour, not through a variable:
    // every variable had gone clear over a scene and the page was still black.
    literals: [[`body${RAISE}`, 3, 3, 3]],
    // The top bar once the page scrolls, and the player along the foot.
    bars: [`#nav-bar-background${RAISE}`, `ytmusic-player-bar${RAISE}`],
  },
  twitch: {
    scope: `.tw-root--theme-dark${RAISE}, .dark-theme${RAISE}`,
    page: [14, 14, 16],
    tolerance: 8,
  },
  suno: {
    scope: `:root${RAISE}`,
    page: [16, 16, 18],
    tolerance: 8,
  },
};

/** What is known about a site's page: its greys, and what each one paints. */
export interface IGuestTintKnowledge {
  readonly greys: readonly TGuestGrey[];
  readonly paints: ReadonlyMap<string, IGuestPaint>;
  readonly keeps: readonly TGuestKeep[];
}

/**
 * Glass counts as a surface, a wash does not. YouTube's top bar turns to 80%
 * of its page grey once the page scrolls, and stayed grey over a coloured page
 * until translucent greys were taken as well; below half, a grey is a shade
 * laid over something rather than a surface of its own.
 */
const MIN_SURFACE_ALPHA = 0.5;

/**
 * The shading a site lays over its own video — under the player's controls,
 * behind a caption — is part of how the picture is shown, and is never
 * coloured. Named where the site still uses a readable name; one only known by
 * a random name would take a faint tint at worst, never a broken page.
 */
const OVER_THE_PICTURE = /scrim|overlay/i;

/** A colour the page can be given: a hex from the interface, nothing else. */
const HEX = /^#[0-9a-f]{6}$/i;

const mean = (r: number, g: number, b: number) => (r + g + b) / 3;

/**
 * The ground standing as far above itself as `level` stands above the site's
 * page: the same share of the way to the lift.
 */
const shade = (
  ground: string,
  level: number,
  page: number,
  lift: string,
): string => {
  const share = Math.max(0, ((level - page) / (255 - page)) * 100);
  return share < 0.05
    ? ground
    : `color-mix(in srgb, ${ground}, ${lift} ${share.toFixed(2)}%)`;
};

/** What a site's steps are lifted toward when the caller names nothing. */
const WHITE = '#ffffff';

/** A grey in the interface's colour, keeping its own translucency. */
const tintOf = (
  ground: string,
  [, r, g, b, alpha]: TGuestGrey,
  page: number,
  lift: string,
): string => {
  const surface = shade(ground, mean(r, g, b), page, lift);
  return alpha >= 1
    ? surface
    : `color-mix(in srgb, ${surface} ${Math.round(alpha * 100)}%, transparent)`;
};

/** A grey exactly as the site had it. */
const originalOf = ([, r, g, b, alpha]: TGuestGrey): string =>
  alpha >= 1
    ? `rgb(${r}, ${g}, ${b})`
    : `rgba(${r}, ${g}, ${b}, ${Number(alpha.toFixed(3))})`;

/** A grey the site paints a surface with, by the rules above. */
const isSurfaceGrey = (
  site: IGuestTintSite,
  [name, r, g, b, alpha]: TGuestGrey,
): boolean =>
  Math.max(r, g, b) - Math.min(r, g, b) <= site.tolerance &&
  mean(r, g, b) >= mean(...site.page) - 0.5 &&
  alpha >= MIN_SURFACE_ALPHA &&
  !OVER_THE_PICTURE.test(name);

/**
 * A grey the site's text is written in and nothing else, so it keeps its own
 * colour. It is written back rather than left out: many are defined from a
 * page grey that does change (YouTube Music's button label is its page's
 * black under another name), and left out they would change along with it.
 * A grey whose use is not known yet is kept the same way until it is.
 */
const isTextOnly = (paints: ReadonlyMap<string, IGuestPaint>, name: string) => {
  const paint = paints.get(name);
  return paint === undefined || (paint.text && !paint.surface);
};

/**
 * How dark the one wash over the whole page is when a scene plays behind it:
 * enough that the page's white text reads over the brightest scene, little
 * enough that the scene is what the page is standing on.
 */
const PAGE_WASH = 0.35;

/**
 * The site's top bar over a scene, in percent of the interface's colour:
 * nearly solid, so it reads as FluidEQ's bar carried on, with a breath of
 * the scene behind so it is not a lid on it.
 */
const BAR_OPACITY = 92;

/** A selector for the page's root element itself, with nothing below it. */
const ROOT_SELECTOR = /^html(?:\[[^\]]*\]|:[\w-]+\([^)]*\))*$/;

/**
 * A card over the scene is glass of its own grey, thicker the further its
 * grey stood above the page: a menu more than a card, a card more than the
 * search field — the order the site gave them, kept.
 */
const glassAlpha = (step: number, alpha: number) =>
  Math.min(0.88, 0.6 + step * 2.5) * alpha;

/**
 * The rules that put a grey back where the page writes text in it, one rule
 * per grey, in the interface's colour at the grey's own darkness: the label of
 * a white button stays readable on it while the page around it is clear.
 */
const keepRules = (
  site: IGuestTintSite,
  known: IGuestTintKnowledge,
  changed: ReadonlyMap<string, TGuestGrey>,
  ground: string,
  lift: string,
): string[] => {
  const page = mean(...site.page);
  const byName = new Map<string, string[]>();
  known.keeps.forEach(([selector, name]) => {
    if (changed.has(name)) {
      byName.set(name, [...(byName.get(name) ?? []), selector]);
    }
  });
  const rules: string[] = [];
  byName.forEach((selectors, name) => {
    const grey = changed.get(name);
    if (grey) {
      rules.push(
        `:is(${site.scope}) :is(${selectors.join(', ')})${RAISE} {\n  ${name}: ${tintOf(ground, grey, page, lift)} !important;\n}`,
      );
    }
  });
  return rules;
};

/**
 * The page as glass over a scene playing behind it (`VideoSceneBackdrop`).
 *
 * Every surface at the page's own level goes clear and the root alone carries
 * one even wash: the site paints its page colour on several nested elements —
 * the app, its bars, its guide — and a wash on each of them would stack into a
 * darker page wherever they overlap. Surfaces standing above the page become
 * glass of their own grey. The video, pictures and text are untouched, as in
 * `buildGuestTintCss`, and nothing is done outside the site's dark mode.
 */
export const buildGuestGlassCss = (
  siteId: string | undefined,
  ground: string,
  known: IGuestTintKnowledge,
  lift = WHITE,
): string | undefined => {
  const site = siteId ? GUEST_TINT_SITES[siteId] : undefined;
  if (!site || !HEX.test(ground)) {
    return undefined;
  }
  const page = mean(...site.page);
  const stepOf = (level: number) => Math.max(0, (level - page) / (255 - page));
  const declarations: string[] = [];
  const changed = new Map<string, TGuestGrey>();
  known.greys.forEach((grey) => {
    if (!isSurfaceGrey(site, grey)) {
      return;
    }
    const [name, r, g, b, alpha] = grey;
    if (isTextOnly(known.paints, name)) {
      declarations.push(`  ${name}: ${originalOf(grey)} !important;`);
      return;
    }
    const step = stepOf(mean(r, g, b));
    const colour =
      step < 0.005
        ? 'transparent'
        : `rgba(${r}, ${g}, ${b}, ${glassAlpha(step, alpha).toFixed(2)})`;
    declarations.push(`  ${name}: ${colour} !important;`);
    changed.set(name, grey);
  });
  if (changed.size === 0) {
    return undefined;
  }
  const rules = [
    `${site.scope} {\n${declarations.join('\n')}\n}`,
    `html${RAISE} {\n  background-color: rgba(0, 0, 0, ${PAGE_WASH}) !important;\n}`,
    ...keepRules(site, known, changed, ground, lift),
  ];
  (site.literals ?? []).forEach(([selector, r, g, b]) => {
    const step = stepOf(mean(r, g, b));
    if (step < 0.005) {
      // At the page's own level on the root itself, the colour is the wash
      // above, and written again here it would be the more specific rule and
      // take the wash away. On anything below the root — YouTube Music paints
      // its body — it goes clear, or it covers the wash and the scene alike.
      if (!ROOT_SELECTOR.test(selector)) {
        rules.push(
          `${selector} {\n  background-color: transparent !important;\n}`,
        );
      }
      return;
    }
    rules.push(
      `${selector} {\n  background-color: rgba(${r}, ${g}, ${b}, ${glassAlpha(step, 1).toFixed(2)}) !important;\n}`,
    );
  });
  if (site.bars) {
    rules.push(
      `${site.bars.join(',\n')} {\n  background-color: color-mix(in srgb, ${ground} ${BAR_OPACITY}%, transparent) !important;\n}`,
    );
  }
  return `${rules.join('\n')}\n`;
};

/**
 * The stylesheet that puts `siteId` in the colour of `ground`, from the greys
 * its page reported — or nothing for a site this does not tint, a colour that
 * is not a plain hex, or a page with none of its own greys left to change.
 *
 * A grey that paints both text and surfaces takes the colour everywhere: the
 * page's grey used for a label on a white button is a cut-out of the page,
 * and follows it.
 */
export const buildGuestTintCss = (
  siteId: string | undefined,
  ground: string,
  known: IGuestTintKnowledge,
  lift = WHITE,
): string | undefined => {
  const site = siteId ? GUEST_TINT_SITES[siteId] : undefined;
  if (!site || !HEX.test(ground)) {
    return undefined;
  }
  const page = mean(...site.page);
  const declarations: string[] = [];
  let changes = 0;
  known.greys.forEach((grey) => {
    if (!isSurfaceGrey(site, grey)) {
      return;
    }
    const [name] = grey;
    if (isTextOnly(known.paints, name)) {
      declarations.push(`  ${name}: ${originalOf(grey)} !important;`);
      return;
    }
    declarations.push(
      `  ${name}: ${tintOf(ground, grey, page, lift)} !important;`,
    );
    changes += 1;
  });
  if (changes === 0) {
    return undefined;
  }
  const rules = [`${site.scope} {\n${declarations.join('\n')}\n}`];
  (site.literals ?? []).forEach(([selector, r, g, b]) => {
    rules.push(
      `${selector} {\n  background-color: ${shade(ground, mean(r, g, b), page, lift)} !important;\n}`,
    );
  });
  return `${rules.join('\n')}\n`;
};
