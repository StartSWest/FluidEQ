/* Copyright (C) 2026 Ivan Carmenates Garcia. SPDX-License-Identifier: GPL-3.0-or-later */

import CAPTURED from './captured';
import { type IHelpChapter, WINDOW } from './model';

/** Shaping the sound on the EQ page: bands, EQ mode, games, corrections, outputs and the config. */
const SOUND_CHAPTERS = [
  {
    id: 'eq',
    group: 'sound',
    // The Bands page twice: as it opens, with nothing selected, the band
    // labels on and the Tone row under the bands, and with one band
    // selected, cut from the tabs for Game mode beside the engine's name.
    // Both are taken, and their boxes measured, by
    // `scripts/help-captures` (`captured.ts`); the band menu is not.
    figures: [
      CAPTURED['16-eq-bands.png'],
      CAPTURED['36-eq-band-selected.png'],
      {
        image: '17-band-menu.png',
        width: 236,
        height: 311,
        caption: 'help.eq.menuCaption',
        controls: [
          {
            box: [26, 140, 188, 34],
            name: 'eq.menu.reset',
            text: 'help.eq.reset',
          },
          {
            box: [26, 175, 188, 34],
            name: 'eq.menu.disable',
            text: 'help.eq.disable',
          },
          {
            box: [26, 220, 188, 34],
            name: 'eq.menu.addLeft',
            text: 'help.eq.addLeft',
          },
          {
            box: [26, 255, 188, 34],
            name: 'eq.menu.addRight',
            text: 'help.eq.addRight',
          },
        ],
      },
    ],
  },
  {
    id: 'eqmode',
    group: 'sound',
    figures: [
      // The EQ mode card, taken by `scripts/help-captures` (`captured.ts`).
      CAPTURED['18-eq-mode.png'],
      {
        image: '19-band-designs.png',
        width: 358,
        height: 286,
        caption: 'help.eqmode.designsCaption',
        controls: [
          {
            box: [29, 91, 300, 70],
            name: 'eq.layouts.builtIn',
            text: 'help.eqmode.builtIn',
          },
          {
            box: [219, 225, 111, 32],
            name: 'eq.layouts.saveNew',
            text: 'help.eqmode.save',
          },
        ],
      },
    ],
  },
  {
    // The Game presets page with two games on it, cut to its tabs and rows:
    // at 2560 wide the rest of the page below them is empty.
    id: 'games',
    group: 'sound',
    figures: [
      {
        image: '41-game-presets.png',
        width: 2068,
        height: 276,
        controls: [
          {
            box: [291, 12, 109, 31],
            name: 'tabs.games',
            text: 'help.games.tab',
          },
          {
            box: [1926, 58, 126, 32],
            name: 'games.add',
            text: 'help.games.add',
          },
          {
            // The icon and the words: the column they sit in stretches all
            // the way to the picker.
            box: [23, 106, 150, 38],
            name: 'help.games.gameName',
            text: 'help.games.game',
          },
          {
            box: [1749, 109, 179, 32],
            name: 'help.games.soundName',
            text: 'help.games.sound',
          },
          {
            box: [2001, 109, 40, 32],
            name: 'help.games.removeName',
            text: 'help.games.remove',
          },
        ],
      },
    ],
  },
  {
    id: 'headphones',
    group: 'sound',
    figures: [
      { image: '04-eq-headphone-correction-and-import.png', ...WINDOW },
    ],
  },
  {
    id: 'convolution',
    group: 'sound',
    figures: [{ image: '05-eq-convolution-library.png', ...WINDOW }],
  },
  {
    // The right rail down to its last section, taken by
    // `scripts/help-captures` (`captured.ts`): the site link under it is not
    // a control. Restore has no number of its own: it stands between New
    // profile and Update, where no line can reach it without crossing one of
    // them, so Update's text says what the button beside it does.
    id: 'profiles',
    group: 'sound',
    figures: [CAPTURED['40-rail-right.png']],
  },
  {
    id: 'config',
    group: 'sound',
    figures: [{ image: '06-eq-equalizer-apo-config.png', ...WINDOW }],
  },
] as const satisfies readonly IHelpChapter[];

export default SOUND_CHAPTERS;
