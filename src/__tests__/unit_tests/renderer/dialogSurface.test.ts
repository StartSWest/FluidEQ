/**
 * @jest-environment node
 */
/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * Every dialog is one material, and nothing standing on the floor paints a
 * slab of its own (Ivan, 2026-09-26: "arregla también todos los modals con el
 * nuevo style y quítale el rainbow border a todos", "que tengan todos un style
 * que matchea y sea standarizado", "ve por toda la UI quitándole el bg color
 * ese que tienen los elementos que no matchea con el style").
 *
 * The dialogs had four floors between them — the field colour at 97%, the
 * menu colour, the block colour, the menu top at 99% — and a spectrum round
 * the edge in Rainbow mode; the boxes on the pages still wore the block
 * colour after the panes had given theirs up. jsdom lays nothing out, so what
 * is held here is the shape of the compiled rules.
 *
 * The node environment, because Sass resolves its browser build under jsdom's
 * export conditions and that one cannot read files.
 */

import { compile } from 'sass';
import path from 'path';

const STYLES_DIR = path.join(__dirname, '..', '..', '..', 'renderer', 'styles');

const compiled = new Map<string, string>();
const compiledCss = (sheet: string) => {
  const known = compiled.get(sheet);
  if (known !== undefined) {
    return known;
  }
  const { css } = compile(path.join(STYLES_DIR, sheet), {
    loadPaths: [STYLES_DIR],
    quietDeps: true,
  });
  compiled.set(sheet, css);
  return css;
};

/**
 * The declarations of every top-level rule whose selector is exactly
 * `selector`, in order. Sass splits one rule into several wherever a mixin
 * emits a nested block (`animate`'s reduced-motion query), so the first alone
 * can be one declaration long.
 */
const declarationsOf = (css: string, selector: string) => {
  const blocks: string[] = [];
  let at = css.indexOf(`\n${selector} {`);
  while (at >= 0) {
    const open = css.indexOf('{', at);
    blocks.push(css.slice(open + 1, css.indexOf('}', open)));
    at = css.indexOf(`\n${selector} {`, open);
  }
  if (blocks.length === 0) {
    throw new Error(`no rule for ${selector}`);
  }
  return blocks.join(' ').replace(/\s+/g, ' ');
};

const FLOOR = 'background: var(--surface-menu-floor)';
const HAIRLINE =
  'border: 1px solid color-mix(in srgb, #d6e9f7 14%, transparent)';

/** The rule `Modal.scss` lays over every card with a dialog's role. */
const everyDialogRule = () => {
  const css = compiledCss('Modal.scss').replace(/\s+/g, ' ');
  const at = css.indexOf(
    'html body :is([role=dialog], [role=alertdialog], dialog):not(',
  );
  if (at < 0) {
    throw new Error('no rule for every dialog');
  }
  const open = css.indexOf('{', at);
  return {
    selector: css.slice(at, open),
    declarations: css.slice(open + 1, css.indexOf('}', open)),
  };
};

describe('every dialog', () => {
  it('stands on the menus’ floor, with their hairline and the dialog corner', () => {
    // 12px, the scale's dialog step (`dialog.$corner`): the menus' 4px made
    // a card half the window's size a flat, hard-edged slab (2026-09-26).
    const { declarations } = everyDialogRule();
    expect(declarations).toContain(FLOOR);
    expect(declarations).toContain(HAIRLINE);
    expect(declarations).toContain('border-radius: 12px');
  });

  it('leaves out what is a dialog by role and not a card over the window', () => {
    const { selector } = everyDialogRule();
    [
      '[data-anchored-menu]',
      '.karaoke-maker',
      '.karaoke-maker__wizard',
      '.karaoke-maker__tool-popover',
      '.sign-out-confirm',
      '.support-dialog',
      '.device-apo-notice',
      '.plus-terms-notice',
    ].forEach((left) => expect(selector).toContain(left));
    // Positive control: the family that lays a card over the window is in.
    expect(selector).not.toContain('.about');
  });

  it.each([
    ['About.scss', '.about'],
    ['OverlayCard.scss', '.overlay-card'],
    ['Dsp.scss', '.dsp-import'],
    ['Karaoke.scss', '.karaoke-maker__lyrics-modal'],
    ['Karaoke.scss', '.karaoke-maker__consent-modal'],
    ['Karaoke.scss', '.karaoke-maker__confirm-modal'],
    ['Karaoke.scss', '.karaoke-maker__wizard-panel'],
    ['Support.scss', '.support-dialog'],
  ])('%s builds %s on it', (sheet, selector) => {
    expect(declarationsOf(compiledCss(sheet), selector)).toContain(FLOOR);
  });

  it('draws no spectrum round its edge in Rainbow mode', () => {
    // Positive control: the mode still sweeps its spectrum through the app.
    expect(compiledCss('Rainbow.scss')).toContain('var(--rainbow-sweep)');
    // The Support card's ask and its "I contributed" lost theirs on
    // 2026-09-26: the one moving outline in the dialog, previewing a mode
    // that is now on for everybody.
    [
      'About.scss',
      'BugReport.scss',
      'WhatsNew.scss',
      'Modal.scss',
      'Support.scss',
    ].forEach((sheet) =>
      expect(compiledCss(sheet)).not.toContain('rainbow-sweep'),
    );
    expect(compiledCss('Rainbow.scss')).not.toMatch(
      /is-euphoric body :is\(\s*\[role=dialog\]/,
    );
  });

  it('lights the Support card with the streak in colours that exist', () => {
    const support = declarationsOf(
      compiledCss('Support.scss'),
      '.support-dialog',
    );
    // `rgba(var(--accent), …)` is no colour, and it threw the whole shadow
    // out; the lit edge is a ring, because the hairline rule outweighs a
    // border colour here.
    expect(support).not.toMatch(/rgba\(var\(/);
    expect(support).toMatch(
      /inset 0 0 0 1px color-mix\(in srgb, var\(--accent-light\) calc\(var\(--pet-joy, 0\) \* 55%\), transparent\)/,
    );
  });

  // At the darkest Brightness the menus' top colour is a step UP from the
  // floor, and the backdrop made of it lit the window grey behind every
  // dialog (2026-09-26). The scrim is the floor half-way to black.
  const SCRIM =
    'background: color-mix(in srgb, color-mix(in srgb, var(--surface-base) 50%, #000000) 76%, transparent)';

  it.each([
    ['About.scss', '.about-backdrop'],
    ['OverlayCard.scss', '.overlay-card__backdrop'],
    ['Dsp.scss', '.dsp-import-backdrop'],
    ['Karaoke.scss', '.karaoke-maker__modal-backdrop'],
    ['Support.scss', '.support-backdrop'],
    ['ShareScore.scss', '.share-card-backdrop'],
    ['AudioTroubleshooter.scss', '.troubleshoot-backdrop'],
  ])('%s dims the window behind %s, never lifts it', (sheet, selector) => {
    const backdrop = declarationsOf(compiledCss(sheet), selector);
    expect(backdrop).toContain(SCRIM);
    expect(backdrop).not.toContain('--surface-menu-top');
  });

  it('gives a dialog its own corner and keeps the menus at theirs', () => {
    const css = compiledCss('Rainbow.scss').replace(/\s+/g, ' ');
    const rule = (selectorStart: string) => {
      const at = css.indexOf(selectorStart);
      if (at < 0) {
        throw new Error(`no rule for ${selectorStart}`);
      }
      return css.slice(css.indexOf('{', at) + 1, css.indexOf('}', at));
    };
    expect(
      rule(
        'html body :is([role=dialog], [role=alertdialog], dialog):not([data-anchored-menu], .karaoke-maker)',
      ),
    ).toContain('border-radius: 12px');
    // The control: a menu keeps the 4px it had.
    expect(rule('html body :is([data-anchored-menu],')).toContain(
      'border-radius: 4px',
    );
  });
});

describe('what stands on the floor', () => {
  const BLOCK = 'var(--surface-block)';
  // The grey slab: the block colour, flat, as the whole of a fill. A card's
  // own face mixes the block with the pane and the accent, which is the
  // window's colour and not a slab (`card-surface`).
  const SLAB = /background(-color)?: var\(--surface-block\)/;

  it.each([
    ['Dsp.scss', '.dsp-card'],
    ['Library.scss', '.library-empty__card'],
    ['RemoteAudio.scss', '.remote-audio__role-shell'],
    ['RemoteAudio.scss', '.remote-audio__role-card'],
    ['Karaoke.scss', '.karaoke-pitch'],
    ['Karaoke.scss', '.karaoke-playlist'],
    ['Karaoke.scss', '.karaoke-maker__header'],
    ['Karaoke.scss', '.karaoke-maker-preview'],
    ['Karaoke.scss', '.karaoke-maker__command-dock'],
    ['Karaoke.scss', '.karaoke-maker__wizard-step'],
    ['Studio.scss', '.studio-card'],
    ['Gallery.scss', '.gallery-card'],
    ['About.scss', '.about__section'],
    ['DialogHeader.scss', '.dialog-header'],
  ])('%s paints no slab under %s', (sheet, selector) => {
    expect(declarationsOf(compiledCss(sheet), selector)).not.toMatch(SLAB);
  });

  // The cards on it are filled in the window's colour (Ivan, 2026-09-26, of
  // the Studio's AI card: "I kind of like this pane colors … apply to lib too
  // and all those pages that need panes like this"): the accent through the
  // body and glowing in from the top corner, at half a pane's depth over the
  // floor — never lighter than a pane ("fix those pane too light").
  it.each([
    ['Library.scss', '.library-grid__tile'],
    ['Library.scss', '.library-list'],
    ['Library.scss', '.library-up-next'],
    ['Library.scss', '.library-empty__card'],
    ['Games.scss', '.games-row'],
    ['ConfigInspector.scss', '.config-card'],
    ['StudioMaker.scss', '.studio-maker'],
    ['RemoteAudio.scss', '.remote-audio__role-shell'],
    ['Karaoke.scss', '.karaoke-playlist'],
  ])('%s fills %s with the card', (sheet, selector) => {
    const card = declarationsOf(compiledCss(sheet), selector);
    expect(card).toContain(
      'color-mix(in srgb, color-mix(in srgb, var(--accent) 4%, var(--surface-panel)) 55%, transparent)',
    );
    expect(card).toContain('radial-gradient(');
  });

  // The control: the box that holds a set keeps its edge alone — the grid
  // round the Library's tiles is not a card (Ivan: "the grid card, not the
  // bg").
  it('leaves the box round a set unfilled', () => {
    expect(
      declarationsOf(compiledCss('Library.scss'), '.library-grid'),
    ).toContain('background: transparent');
  });

  // A control's track keeps a fill, and it is the quiet pill's — the accent
  // at 7% inside the field's edge — never the block's grey: every segmented
  // row was a pale slab with a paler choice in it (Ivan, 2026-09-26: "not
  // good, too light color", "all of those").
  it('fills a segmented track with the quiet pill, and its choice with the selection', () => {
    const track = declarationsOf(compiledCss('Dsp.scss'), '.segmented');
    expect(track).toContain(
      'background: color-mix(in srgb, var(--accent) 7%, transparent)',
    );
    expect(track).not.toContain(BLOCK);
    // The EQ mode menu's rows are the same track, with no fill of their own.
    expect(
      declarationsOf(
        compiledCss('EqModeSelect.scss'),
        '.eq-mode-menu .segmented.eq-mode-menu__choices',
      ),
    ).not.toContain('background');
    expect(
      declarationsOf(compiledCss('Dsp.scss'), '.segmented__option.is-selected'),
    ).toContain('color-mix(in srgb, var(--accent) 16%, transparent)');
  });

  // What floats over the karaoke stage's picture keeps a fill, and it is the
  // card laid over the floor — opaque, and the playlist's own material rather
  // than the block's grey (Ivan, 2026-09-26: "karaoke fix all those suck ui").
  it.each([
    '.karaoke-chords',
    '.karaoke-song__text-size',
    '.karaoke-playlist__expand',
    '.karaoke-count-in',
    '.karaoke-transport',
  ])('lays the card over the floor under %s', (selector) => {
    const chip = declarationsOf(compiledCss('Karaoke.scss'), selector);
    expect(chip).toContain(
      'color-mix(in srgb, color-mix(in srgb, var(--accent) 4%, var(--surface-panel)) 55%, transparent)',
    );
    expect(chip).toContain('var(--surface-base)');
    expect(chip).not.toMatch(SLAB);
  });
});
