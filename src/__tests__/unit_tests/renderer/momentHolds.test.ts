/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * The moments that used to be timers, as the stylesheets now hold them.
 *
 * Each notice that shows "for a moment" is taken down by the end of its own
 * hold animation; the component listens for that end by the keyframes' name.
 * So each one has to exist, run as long as the timer it replaced, move
 * nothing, and survive reduced motion — whose stand-down (`App.scss`) sets
 * every animation to a millisecond and would otherwise end the moment before
 * it could be read. jsdom runs no animations, so this reads the compiled CSS.
 */

import {
  compileStylesheet,
  keyframes,
  styleRules,
} from '../../utils/stylesheetRules';

interface IHold {
  sheet: string;
  selector: string;
  name: string;
  /** What the timer it replaced waited, as the stylesheet writes it. */
  duration: string;
}

const HOLDS: IHold[] = [
  {
    sheet: 'RhythmGame.scss',
    selector: '.rhythm-game__verdict-text.is-held',
    name: 'rhythm-verdict-hold',
    duration: '900ms',
  },
  {
    sheet: 'ShareScore.scss',
    selector: '.share-score__confirmed',
    name: 'share-score-copied',
    duration: '1.6s',
  },
  {
    sheet: 'Support.scss',
    selector: '.support-method__confirmed',
    name: 'support-copied',
    duration: '2s',
  },
  {
    sheet: 'Support.scss',
    selector: '.support-pet-tap__mood',
    name: 'support-pet-mood',
    duration: '700ms',
  },
  {
    sheet: 'MainContent.scss',
    selector: '.eq-mode__bubble.is-applied .eq-mode__bubble-text',
    name: 'eq-bubble-applied',
    duration: '1.5s',
  },
  {
    sheet: 'MainContent.scss',
    selector: '.eq-mode__bubble-status',
    name: 'smart-eq-status-hold',
    duration: '6s',
  },
  {
    sheet: 'MiniPlayer.scss',
    selector: '.player-eq-screen__remark',
    name: 'smart-eq-status-hold',
    duration: '6s',
  },
  {
    sheet: 'SongEqNotice.scss',
    selector: '.song-eq-notice',
    name: 'song-eq-notice-linger',
    duration: '6s',
  },
  {
    sheet: 'VideoBrowser.scss',
    selector: '.video-browser__sign-out.is-done svg',
    name: 'video-sign-out-said',
    duration: '4s',
  },
];

const compiled = new Map<string, string>();
const css = (sheet: string) => {
  const known = compiled.get(sheet);
  if (known !== undefined) {
    return known;
  }
  const fresh = compileStylesheet(sheet);
  compiled.set(sheet, fresh);
  return fresh;
};

/**
 * A rule's selectors without the comment Sass keeps in front of the first
 * rule of a file: the licence header rides in its prelude, and its commas
 * split it into pieces, the last of which ends the comment and holds the
 * selector.
 */
const selectorsOf = (selectors: string[]) =>
  selectors.map((each) =>
    each.includes('*/') ? each.slice(each.lastIndexOf('*/') + 2).trim() : each,
  );

/** Every `animation` the rules give `selector` outside media queries. */
const animationsFor = (sheet: string, selector: string) =>
  styleRules(css(sheet))
    .filter(
      ({ selectors, within }) =>
        within.length === 0 && selectorsOf(selectors).includes(selector),
    )
    .map(({ declarations }) => declarations.get('animation') ?? '');

describe.each(HOLDS)('$name', ({ sheet, selector, name, duration }) => {
  it('holds for as long as the timer it replaced waited', () => {
    expect(
      animationsFor(sheet, selector).some((animation) =>
        animation.includes(`${name} ${duration}`),
      ),
    ).toBe(true);
  });

  it('moves nothing and draws nothing', () => {
    const frames = keyframes(css(sheet), name);
    expect(frames.size).toBeGreaterThan(0);
    frames.forEach((declarations) => {
      expect([...declarations.keys()]).toEqual(['visibility']);
      expect(declarations.get('visibility')).toBe('visible');
    });
  });

  it('keeps its length under the reduced-motion stand-down', () => {
    const exempt = styleRules(css(sheet)).filter(({ selectors }) =>
      selectors.some(
        (each) =>
          each.startsWith(":root[data-motion='reduced']") ||
          each.startsWith(':root[data-motion=reduced]'),
      ),
    );
    expect(
      exempt.some(({ declarations }) =>
        (declarations.get('animation') ?? '').includes(
          `${name} ${duration} linear !important`,
        ),
      ),
    ).toBe(true);
  });
});

describe('the graph caption under reduced motion', () => {
  it('fades in place for its whole moment rather than vanishing', () => {
    const sheet = 'GraphTheme.scss';
    const exempt = styleRules(css(sheet)).find(
      ({ selectors }) =>
        selectors.some((each) => each.endsWith('.graph-mode-announce')) &&
        selectors.some((each) => each.startsWith(':root[data-motion')),
    );
    expect(exempt?.declarations.get('animation')).toContain(
      'graph-mode-announce-still 1.1s',
    );
    const transforms = new Set(
      [...keyframes(css(sheet), 'graph-mode-announce-still').values()].map(
        (declarations) => declarations.get('transform'),
      ),
    );
    // One transform in every frame: it fades, it does not rise.
    expect(transforms.size).toBe(1);
  });
});
