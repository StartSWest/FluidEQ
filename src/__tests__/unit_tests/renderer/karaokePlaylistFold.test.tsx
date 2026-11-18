/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * The karaoke playlist folding away beside the stage, and opening again, on
 * the Plus rail's motion.
 *
 * It used to be unmounted on the press, so it vanished in one frame and the
 * stage jumped a quarter of the window sideways. Whether it stays is checked
 * on the component; how the fold moves — which jsdom neither lays out nor
 * animates — on the compiled stylesheet, where what broke while it was built
 * can be seen: a folded grid with a different number of tracks, which no
 * browser can interpolate, and a stage cascade that took over the restore
 * pill's arrival.
 */

import '@testing-library/jest-dom';
import { render, screen } from '@testing-library/react';
import type { IKaraokePlaylistItem } from '../../../common/karaoke/files';
import KaraokePlaylist from '../../../renderer/karaoke/KaraokePlaylist';
import { compileStylesheet, styleRules } from '../../utils/stylesheetRules';

const song = (title: string): IKaraokePlaylistItem => ({
  id: title.toLowerCase(),
  title,
  relativePath: `${title}.mp3`,
  audio: new File(['audio'], `${title}.mp3`),
  media: [],
});

const playlist = (isCollapsed?: boolean) => (
  <KaraokePlaylist
    items={[song('First'), song('Second')]}
    isBusy={false}
    onAddFiles={jest.fn()}
    onAddFolder={jest.fn()}
    onClear={jest.fn()}
    onToggleFolderGrouping={jest.fn()}
    onSelect={jest.fn()}
    onActivate={jest.fn()}
    onMove={jest.fn()}
    onRemove={jest.fn()}
    onCollapse={jest.fn()}
    isCollapsed={isCollapsed}
  />
);

describe('the folded playlist', () => {
  it('stays where it is while folded, out of reach, and comes back into reach when opened', () => {
    const { rerender } = render(playlist(true));
    const list = screen.getByRole('complementary', { name: /^Songs/ });
    expect(list).toHaveAttribute('inert');

    rerender(playlist(false));

    expect(screen.getByRole('complementary', { name: /^Songs/ })).toBe(list);
    expect(list).not.toHaveAttribute('inert');
  });
});

/** The top-level tracks of a grid template: `minmax(0, 1fr)` is one. */
const tracks = (template: string | undefined) => {
  const found: string[] = [];
  let depth = 0;
  let current = '';
  [...(template ?? '')].forEach((character) => {
    depth += character === '(' ? 1 : 0;
    depth -= character === ')' ? 1 : 0;
    if (/\s/.test(character) && depth === 0) {
      if (current) {
        found.push(current);
      }
      current = '';
      return;
    }
    current += character;
  });
  if (current) {
    found.push(current);
  }
  return found;
};

describe('how the playlist folds', () => {
  const rules = styleRules(compileStylesheet('Karaoke.scss'));
  const STACKED = '@container autoeq-workspace (max-width: 760px)';

  /** The declaration for exactly this selector, in exactly these at-rules. */
  const declared = (selector: string, property: string, within: string[]) =>
    rules
      .filter(
        (rule) =>
          rule.selectors.includes(selector) &&
          rule.declarations.has(property) &&
          rule.within.join('|') === within.join('|'),
      )
      .map((rule) => rule.declarations.get(property))
      .pop();

  const OPEN = '.karaoke-workspace__player.has-playlist';
  const FOLDED =
    '.karaoke-workspace__player.has-playlist.is-playlist-collapsed';

  // The column holds its width while the list leaves and gives it to the
  // stage at once, and opening takes it at once (2026-11-16): interpolated,
  // the stage widened every frame and the bar's song name grew and was cut
  // again as it crossed the width where the bar folds its labels.
  it('holds the column while the list leaves, then hands it to the stage in one step', () => {
    const open = tracks(declared(OPEN, 'grid-template-columns', []));
    const folded = tracks(declared(FOLDED, 'grid-template-columns', []));
    expect(open).toHaveLength(3);
    expect(folded).toHaveLength(open.length);
    expect(declared(OPEN, 'transition', [])).toBe('none');
    expect(declared(FOLDED, 'transition', [])).toBe(
      'grid-template-columns 0s linear var(--playlist-move)',
    );
  });

  it('closes the row above the stage the same way when a narrow panel stacks them', () => {
    const open = tracks(declared(OPEN, 'grid-template-rows', [STACKED]));
    const folded = tracks(declared(FOLDED, 'grid-template-rows', [STACKED]));
    expect(open).toHaveLength(2);
    expect(folded).toHaveLength(open.length);
    expect(declared(OPEN, 'transition', [STACKED])).toMatch(
      /grid-template-rows var\(--playlist-move\)/,
    );
  });

  it('follows the splitter under the pointer, with nothing easing behind it', () => {
    expect(
      declared(
        `${OPEN}:has(> .karaoke-pane-splitter .is-dragging)`,
        'transition',
        [],
      ),
    ).toBe('none');
  });

  it('still folds under reduced motion, shorter, instead of jumping', () => {
    const move = rules
      .filter(({ within }) =>
        within.some((rule) => rule.includes('prefers-reduced-motion: reduce')),
      )
      .map(({ declarations }) => declarations.get('--playlist-move'))
      .find(Boolean);
    expect(move).toMatch(/^[1-9]\d*ms$/);
  });

  it('keeps the restore pill on the fold timing without staggering stage controls', () => {
    const cascade = rules.find(({ selectors }) =>
      selectors.some(
        (selector) =>
          selector.includes('.karaoke-workspace__stage > *') &&
          selector.includes(':not(.karaoke-workspace__drop-overlay)'),
      ),
    );
    expect(cascade).toBeUndefined();
    expect(
      declared(
        '.karaoke-workspace:not(.is-hidden):not(.is-restoring)',
        'animation',
        [],
      ),
    ).toContain('karaoke-workspace-ready');
    expect(
      declared(
        '.karaoke-workspace:not(.is-hidden) .karaoke-playlist__expand',
        'animation',
        [],
      ),
      // In the bar the moment the fold is over, at full size, never a width
      // in between: its delay is the fold's own length.
    ).toMatch(/^karaoke-playlist-pill-in .+ var\(--playlist-move\) backwards$/);
  });
});
