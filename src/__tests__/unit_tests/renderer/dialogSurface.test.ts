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

import { compile, compileString } from 'sass';
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

/**
 * The one material every dialog stands on, as `_dialog.scss` lays it
 * (`surface-look`): each declaration, compiled on its own.
 */
const MATERIAL = compileString(
  "@use 'dialog'; .material { @include dialog.surface-look; }",
  { loadPaths: [STYLES_DIR], quietDeps: true },
)
  .css.replace(/\s+/g, ' ')
  .replace(/^.*\{ /, '')
  .replace(/ \}\s*$/, '')
  .split('; ')
  .map((declaration) => declaration.replace(/;$/, ''));

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
  // The Backdrop's glass, the cards' own edge and the dialog corner, 12px, the
  // scale's dialog step (`dialog.$corner`): the menus' corner made a card
  // half the window's size a flat, hard-edged slab (2026-09-26).
  it('stands on the one material: the glass, the cards’ edge and the dialog corner', () => {
    expect(MATERIAL).toContain('border-radius: 12px');
    const { declarations } = everyDialogRule();
    MATERIAL.forEach((declaration) =>
      expect(declarations).toContain(declaration),
    );
  });

  // Every dialog and notice is one of two frames (`DialogFrame`,
  // `CompactFrame`), and both stand on that material.
  it.each(['.dialog-frame', '.compact-frame'])(
    'builds %s on it',
    (selector) => {
      const frame = declarationsOf(compiledCss('DialogFrame.scss'), selector);
      MATERIAL.filter((declaration) =>
        /^(border|background):/.test(declaration),
      ).forEach((declaration) => expect(frame).toContain(declaration));
    },
  );

  it('leaves out what is a dialog by role and not a card over the window', () => {
    const { selector } = everyDialogRule();
    [
      '[data-anchored-menu]',
      '.karaoke-maker',
      '.karaoke-maker__wizard',
      '.karaoke-maker__tool-popover',
      '.sign-out-confirm',
      '.device-apo-notice',
      '.plus-terms-notice',
      '.song-eq-notice',
    ].forEach((left) => expect(selector).toContain(left));
    // Positive control: the frames that lay a card over the window are in.
    expect(selector).not.toContain('.dialog-frame');
    expect(selector).not.toContain('.compact-frame');
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
      'DialogFrame.scss',
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

  // At the darkest Brightness the menus' top colour is a step UP from the
  // floor, and the backdrop made of it lit the window grey behind every
  // dialog (2026-09-26). The scrim is the floor half-way to black.
  const SCRIM =
    'background: color-mix(in srgb, color-mix(in srgb, var(--surface-base) 50%, #000000) 76%, transparent)';

  it.each([
    ['About.scss', '.about-backdrop'],
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
    expect(everyDialogRule().declarations).toContain('border-radius: 12px');
    // The control: a menu keeps its own, a step smaller.
    const css = compiledCss('Rainbow.scss').replace(/\s+/g, ' ');
    const at = css.indexOf('html body :is([data-anchored-menu],');
    expect(at).toBeGreaterThanOrEqual(0);
    const menu = css.slice(css.indexOf('{', at) + 1, css.indexOf('}', at));
    expect(menu).toContain('border-radius: 8px');
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
    ['RemoteAudio.scss', '.remote-audio__link-form'],
    ['RemoteAudio.scss', '.remote-audio__link'],
    ['Karaoke.scss', '.karaoke-pitch'],
    ['Karaoke.scss', '.karaoke-playlist'],
    ['Karaoke.scss', '.karaoke-maker__header'],
    ['Karaoke.scss', '.karaoke-maker-preview'],
    ['Karaoke.scss', '.karaoke-maker__command-dock'],
    ['Karaoke.scss', '.karaoke-maker__wizard-step'],
    ['Studio.scss', '.studio-card'],
    ['Gallery.scss', '.gallery-card'],
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
    ['Games.scss', '.gaming-game'],
    ['ConfigInspector.scss', '.config-card'],
    ['StudioMaker.scss', '.studio-maker'],
    ['RemoteAudio.scss', '.remote-audio__link-form'],
    ['RemoteAudio.scss', '.remote-audio__link'],
  ])('%s fills %s with the card', (sheet, selector) => {
    const card = declarationsOf(compiledCss(sheet), selector);
    expect(card).toContain(
      'color-mix(in srgb, color-mix(in srgb, var(--accent) 4%, var(--surface-panel)) 34%, transparent)',
    );
    expect(card).toContain('radial-gradient(');
  });

  // The Library is one panel with no card inside it - the mockups' "Library
  // C" (Ivan, 2026-11-15: "no card in the centre or colour, so all three
  // panes are the same background"): the page's section card, and the rail,
  // the queue and the status line on its one tone, parted by hairlines.
  const surfaceOf = (declarations: string) =>
    ['background', 'border', 'border-radius'].map((property) =>
      declarations
        .match(new RegExp(`(?:^|;)\\s*${property}:\\s*([^;]+)`))?.[1]
        ?.trim(),
    );

  // The Karaoke's list is flush like the Library's rail (the K1 mockup,
  // 2026-11-16: "the list is flush like its rail"): the page's card, parted
  // from the stage by a hairline, and no card of its own.
  it('stands the Karaoke playlist on the page’s card, like the Library’s rail', () => {
    const list = declarationsOf(
      compiledCss('Karaoke.scss'),
      '.karaoke-playlist',
    );
    // The control: the rule read is the list's, with its layout in it.
    expect(list).toContain('flex-direction: column');
    expect(list).toContain('background: none');
    expect(list).toContain('border-right: 1px solid');
    expect(list).not.toContain('radial-gradient(');
  });

  it('stands the whole Library on one panel, the rail on its tone', () => {
    const rail = declarationsOf(compiledCss('Library.scss'), '.library-rail');
    expect(rail).toContain('background: none');
    expect(rail).toContain('border-right: 1px solid');
    // No second card drawn behind the shelf and the queue.
    expect(compiledCss('Library.scss')).not.toContain(
      '.library-workspace::before',
    );
  });

  // The Scenes page's rail, pinned, is its place's card too ("same colour,
  // different"); folded open over the place it takes the menus' opaque floor.
  it('stands the Scenes rail on the same card as the Scenes place', () => {
    const rail = surfaceOf(
      declarationsOf(compiledCss('CommunityRail.scss'), '.community__rail'),
    );
    const place = surfaceOf(
      declarationsOf(compiledCss('Community.scss'), '.community__main'),
    );
    expect(place.every((value) => value !== undefined)).toBe(true);
    expect(rail).toEqual(place);
    expect(compiledCss('PlusRail.scss')).toMatch(
      /\.community--rail-folded \.community__rail \{[^}]*background: var\(--surface-menu-floor\)/,
    );
  });

  // The empty Library stands straight on that card, as the A design draws
  // the screen - Ivan, 2026-11-15: "make the centre card flat, no card, like
  // in A".
  it('draws the empty Library on the content card, with no card of its own', () => {
    const empty = declarationsOf(
      compiledCss('Library.scss'),
      '.library-empty__card',
    );
    // The control: the rule read is the empty state's, with its layout in it.
    expect(empty).toContain('display: grid');
    expect(empty).not.toMatch(/(?:^|;)\s*(background|border|box-shadow):/);
  });

  it.each([
    ['Library.scss', '.library-side'],
    ['Library.scss', '.library-status'],
  ])(
    '%s gives %s no tone of its own on the content card',
    (sheet, selector) => {
      expect(declarationsOf(compiledCss(sheet), selector)).toContain(
        'background: none',
      );
    },
  );

  // The details table stands on the shelf's floor under one hairline, as the
  // mockup's table does: no card round it.
  it('draws the Library table as rows under a hairline, not a card', () => {
    const table = declarationsOf(compiledCss('Library.scss'), '.library-list');
    expect(table).toContain('border-top: 1px solid');
    expect(table).not.toContain('radial-gradient(');
  });

  // The control: the Library's tiles stand straight on the main column, with
  // no box round the set at all — not filled ("the grid card, not the bg")
  // and, since 2026-11-15, not edged either ("the grid view has like a double
  // wrapper ... let the grid cards land on the root container").
  it('draws no box round the Library’s tiles', () => {
    const grid = declarationsOf(compiledCss('Library.scss'), '.library-grid');
    expect(grid).toContain('display: grid');
    expect(grid).not.toMatch(/(^|;)\s*border(-radius)?:/);
    expect(grid).not.toMatch(/(^|;)\s*background(-color)?:/);
  });

  // A control's track is the field's outline holding the choices, with no
  // fill (the one control theme's step 6, 2026-11-17) — never the block's
  // grey, and no tint of the accent: a pale slab with a paler choice in it
  // (Ivan, 2026-09-26: "not good, too light color"), then an olive track in
  // Rainbow mode's violet (2026-09-27: "input colors this mess sucks"). The
  // chosen option is lit inside its edge.
  it('gives a segmented track the field’s outline and no fill, and lights its choice', () => {
    const track = declarationsOf(compiledCss('Dsp.scss'), '.segmented');
    expect(track).toContain('background: none');
    expect(track).toContain(
      'border: 1px solid color-mix(in srgb, var(--accent-light) var(--field-edge-share), transparent)',
    );
    expect(track).not.toContain(BLOCK);
    expect(track).not.toContain('var(--accent)');
    // The EQ mode rows are the same track, with no fill of their own, in the
    // menu and in the card it pins as.
    expect(
      declarationsOf(
        compiledCss('EqModeSelect.scss'),
        '.eq-mode-choices .segmented.eq-mode-choices__track',
      ),
    ).not.toContain('background');
    const chosen = declarationsOf(
      compiledCss('Dsp.scss'),
      '.segmented__option.is-selected',
    );
    // CONTROL: the choice does carry a fill, the accent's lit tint, so the
    // track's "none" is not every option's.
    expect(chosen).toContain(
      'background: color-mix(in srgb, var(--accent) 22%, transparent)',
    );
    expect(chosen).toContain('color: var(--accent-light)');
  });

  // What floats over the karaoke stage's picture keeps an opaque fill, never
  // the block's grey (Ivan, 2026-09-26: "karaoke fix all those suck ui"),
  // each on the face the control set gives its kind (2026-11-16/17): the
  // transport the card laid over the floor, the count-in the dialogs' solid
  // panel, the folded playlist's pill the floating line button, and the
  // lyric size inside the stage bar's popover on the menus' floor.
  it.each([
    [
      '.karaoke-transport',
      'linear-gradient(color-mix(in srgb, color-mix(in srgb, var(--accent) 4%, var(--surface-panel)) 34%, transparent) 0 0), var(--surface-base)',
    ],
    ['.karaoke-count-in', 'var(--surface-base)'],
    ['.karaoke-playlist__expand', 'background: var(--surface-menu)'],
    ['.karaoke-stage-bar__popover', 'background: var(--surface-menu-floor)'],
  ])('keeps an opaque face over the picture under %s', (selector, face) => {
    const floater = declarationsOf(compiledCss('Karaoke.scss'), selector);
    expect(floater).toContain(face);
    expect(floater).not.toMatch(SLAB);
  });

  // The chords are the K1 mockup's chips over the pitch strip (2026-11-16):
  // the Library's faint surface, the one sounding on the chosen tint, and no
  // slab of their own.
  it('draws the chord chips on the Library’s faint surface', () => {
    const css = compiledCss('Karaoke.scss');
    const chip = declarationsOf(css, '.karaoke-chords__chip');
    expect(chip).toContain(
      'background: color-mix(in srgb, var(--edge-tint) 5%, transparent)',
    );
    expect(chip).not.toMatch(SLAB);
    // CONTROL: the row itself paints nothing, so the chips are what is seen.
    expect(declarationsOf(css, '.karaoke-chords')).not.toMatch(
      /(?:^|;)\s*background(-color)?:/,
    );
  });
});
