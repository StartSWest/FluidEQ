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
    // The Gaming Lab drawn by its own parts (`help/live/gamingFigures`) with
    // three made-up games, the first in front and tuned, its sound not on
    // yet: the page's top with the game's header, then the game's parts.
    // One figure was so tall that the header's call-outs crossed the page.
    // Both stills are the 2.1 capture of the Game presets page it replaced,
    // for the exported guide.
    id: 'games',
    group: 'sound',
    figures: [
      {
        live: 'gaming-lab',
        width: 1280,
        height: 330,
        still: '41-game-presets.png',
        controls: [
          {
            target: '.gaming-lab__head .game-mode-switch',
            name: 'gaming.switch',
            text: 'help.games.switch',
          },
          {
            target: '.gaming-lab__add',
            name: 'gaming.add',
            text: 'help.games.add',
          },
          {
            target: '.gaming-game.is-selected',
            name: 'help.games.gameName',
            text: 'help.games.game',
          },
          {
            target: '.gaming-panel__pick',
            name: 'gaming.profile.label',
            text: 'help.games.profile',
          },
          {
            target: '.gaming-save',
            name: 'gaming.save',
            text: 'help.games.save',
          },
          {
            target: '.gaming-panel__actions > .button',
            name: 'gaming.action.try',
            text: 'help.games.try',
          },
          {
            // The line's dot, at its start: the whole line reaches the
            // panel's right edge, and its circle took the right margin the
            // header's buttons needed.
            target: '.gaming-panel__status-dot',
            name: 'help.games.statusName',
            text: 'help.games.status',
          },
        ],
      },
      {
        live: 'gaming-parts',
        width: 900,
        height: 720,
        still: '41-game-presets.png',
        controls: [
          {
            target: '.gaming-rail',
            name: 'help.games.railName',
            text: 'help.games.rail',
          },
        ],
      },
      {
        live: 'gaming-profiles',
        width: 1040,
        height: 470,
        still: '41-game-presets.png',
        caption: 'gaming.view.profiles',
        controls: [
          {
            target: '.gaming-profile:first-child',
            name: 'gaming.view.profiles',
            text: 'help.games.profiles',
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
