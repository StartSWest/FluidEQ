/* Copyright (C) 2026 Ivan Carmenates Garcia. SPDX-License-Identifier: GPL-3.0-or-later */

import { type IHelpChapter } from './model';
import CORRECTION_CHAPTERS from './corrections';

/** Shaping the sound on the EQ page: bands, EQ mode, games, corrections, outputs and the config. */
const SOUND_CHAPTERS = [
  {
    id: 'eq',
    group: 'sound',
    // Your EQ drawn by the page's own parts (`help/live/eqPageFigures`) from
    // a made-up EQ, framed in two: the tab row with its tools, and the bands.
    // Then the band popover on the fifth band's slider, as Shift holds it,
    // and a band's right-click menu.
    figures: [
      {
        live: 'eq-tab-row',
        width: 1180,
        height: 40,
        frame: '.eq-layer-tabs',
        margin: 6,
        caption: 'help.eq.rowCaption',
        still: 'help/eq-tab-row.png',
        controls: [
          {
            target: '.eq-layer-tabs__tab:nth-of-type(1)',
            name: 'eq.tabs.bands',
            text: 'help.eq.tabBands',
          },
          {
            target: '.eq-layer-tabs__tab:nth-of-type(2)',
            name: 'eq.tabs.preset',
            text: 'help.eq.tabPreset',
          },
          {
            target: '.eq-layer-tabs__tab:nth-of-type(3)',
            name: 'eq.tone',
            text: 'help.eq.tabTone',
          },
          {
            target: '.quick-layouts',
            name: 'eq.quickLayouts',
            text: 'help.eq.layouts',
          },
          {
            target: '.eq-toolbar__add',
            name: 'eq.addBandAria',
            text: 'help.eq.add',
          },
          {
            target: '.clear-eq-trigger',
            name: 'eq.clear',
            text: 'help.eq.clear',
          },
          {
            target: '.eq-save-trigger',
            name: 'eq.tools.saveEq',
            text: 'help.eq.saveEq',
          },
          {
            target: '.active-layers__picker',
            name: 'graph.curves',
            text: 'help.eq.layers',
          },
          {
            target: '.eq-mode-trigger',
            name: 'eq.mode',
            text: 'help.eq.mode',
          },
          {
            target: '.eq-auto',
            name: 'autoEq.title',
            text: 'help.eq.smart',
          },
        ],
      },
      {
        live: 'eq-bands',
        width: 1180,
        height: 330,
        frame: '.workspace-tab-panel__scroll',
        caption: 'help.eq.bandsCaption',
        still: 'help/eq-bands.png',
        controls: [
          {
            // The fourth band's whole column: its caption, slider and gain.
            target: '.bandWrapper:nth-child(4) .range',
            name: 'help.eq.bandName',
            text: 'help.eq.band',
          },
          {
            target: '.bandWrapper:nth-child(7) .band-frequency-caption',
            name: 'eq.frequency',
            text: 'help.eq.caption',
          },
          {
            target: '.bandWrapper:nth-child(9) .band-gain-caption',
            name: 'eq.gain',
            text: 'help.eq.gainCaption',
          },
          {
            target: '.eq-scale__mark.is-zero',
            name: 'help.eq.scaleName',
            text: 'help.eq.scale',
          },
        ],
      },
      {
        live: 'eq-band-popover',
        width: 1180,
        height: 380,
        frame:
          '.eq-flat-editor--popover, .bandWrapper:nth-child(4), .bandWrapper:nth-child(7)',
        margin: 10,
        caption: 'help.eq.bandCaption',
        still: 'help/eq-band-popover.png',
        controls: [
          {
            target: '.eq-band-popover__step:first-child',
            name: 'help.eq.stepName',
            text: 'help.eq.step',
            keys: 'Shift+Tab',
          },
          {
            target: '.eq-band-popover__filter',
            name: 'eq.filter',
            text: 'help.eq.filter',
          },
          {
            target: '.eq-band-popover__close',
            name: 'eq.popover.close',
            text: 'help.eq.close',
            keys: 'Esc',
          },
          {
            target: '.eq-flat-editor__control--frequency .knob',
            name: 'eq.frequency',
            text: 'help.eq.frequency',
          },
          {
            target: '.eq-flat-editor__control--gain .knob',
            name: 'eq.gain',
            text: 'help.eq.gain',
          },
          {
            target: '.eq-flat-editor__control--quality .knob',
            name: 'eq.quality',
            text: 'help.eq.q',
          },
          {
            target: '.eq-flat-editor__control--active .switch',
            name: 'eq.active',
            text: 'help.eq.disable',
          },
          {
            target: '.eq-flat-editor__delete',
            name: 'eq.delete',
            text: 'help.eq.delete',
          },
        ],
      },
      {
        live: 'eq-band-menu',
        width: 240,
        height: 330,
        frame: '.band-menu',
        margin: 8,
        caption: 'help.eq.menuCaption',
        still: 'help/eq-band-menu.png',
        controls: [
          {
            target: '.band-menu > button:nth-of-type(1)',
            name: 'eq.menu.reset',
            text: 'help.eq.reset',
          },
          {
            target: '.band-menu > button:nth-of-type(2)',
            name: 'eq.menu.disable',
            text: 'help.eq.disable',
          },
          {
            target: '.band-menu > button:nth-of-type(3)',
            name: 'eq.delete',
            text: 'help.eq.menuDelete',
          },
          {
            target: '.band-menu > button:nth-of-type(5)',
            name: 'eq.channels.split',
            text: 'help.eq.ears',
          },
          {
            target: '.band-menu > button:nth-of-type(6)',
            name: 'eq.menu.addLeft',
            text: 'help.eq.addLeft',
          },
          {
            target: '.band-menu > button:nth-of-type(7)',
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
      // The EQ mode card as it stands pinned at the top of the sound panel,
      // drawn by its own rows from made-up choices
      // (help/live/soundPanelFigures), and the band layouts menu, open.
      {
        live: 'eqmode-card',
        width: 330,
        height: 470,
        frame: '.eq-mode-card',
        caption: 'help.eqmode.modeCaption',
        still: 'help/eqmode-card.png',
        controls: [
          {
            target: '.eq-mode-card__unpin',
            name: 'eq.mode.unpin',
            text: 'help.eqmode.pin',
          },
          {
            target: '.eq-mode-card__groups',
            name: 'help.eqmode.tabsName',
            text: 'help.eqmode.tabs',
          },
          {
            target:
              '.eq-mode-card__rows:first-child .eq-mode-choices__row--strength .segmented',
            name: 'eq.mode.strength',
            text: 'help.eqmode.strength',
          },
          {
            target:
              '.eq-mode-card__rows:first-child .eq-mode-choices__row--q .segmented',
            name: 'eq.mode.q',
            text: 'help.eqmode.q',
          },
          {
            target:
              '.eq-mode-card__rows:first-child .eq-mode-choices__row--treble .segmented',
            name: 'eq.mode.treble',
            text: 'help.eqmode.treble',
          },
          {
            target: '.eq-mode-choices__reset',
            name: 'eq.mode.reset',
            text: 'help.eqmode.reset',
          },
        ],
      },
      {
        live: 'eqmode-designs',
        width: 336,
        height: 330,
        frame: '.band-designs__menu',
        margin: 8,
        caption: 'help.eqmode.designsCaption',
        still: 'help/eqmode-designs.png',
        controls: [
          {
            target: '.band-designs__grid',
            name: 'eq.layouts.builtIn',
            text: 'help.eqmode.builtIn',
          },
          {
            target: '.band-designs__content > .button',
            name: 'eq.layouts.resetBands',
            text: 'help.eqmode.resetBands',
          },
          {
            target: '.band-designs__row',
            name: 'eq.layouts.saved',
            text: 'help.eqmode.saved',
          },
          {
            target: '.band-designs__actions .button',
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
    // The exported guide uses captures of these same read-only drawings.
    id: 'games',
    group: 'sound',
    figures: [
      {
        live: 'gaming-lab',
        width: 1280,
        height: 330,
        still: 'help/gaming-lab.png',
        controls: [
          {
            target: '.gaming-lab .studio-rail__pin',
            name: 'plus.rail.collapse',
            text: 'help.games.list',
          },
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
        still: 'help/gaming-parts.png',
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
        still: 'help/gaming-profiles.png',
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
  { id: 'gamefilter', group: 'sound', figures: [] },
  ...CORRECTION_CHAPTERS,
  {
    // The sound panel drawn by its own sections (help/live/soundPanelFigures),
    // from the Output card down: made-up outputs and profiles, a second
    // output on. The EQ mode card above it has its own chapter.
    id: 'profiles',
    group: 'sound',
    figures: [
      {
        live: 'sound-panel',
        width: 330,
        height: 520,
        frame:
          '.device-profiles, .extra-outputs, .extra-outputs + .sidebar-section',
        still: 'help/sound-panel.png',
        controls: [
          {
            target: '.device-profiles__row',
            name: 'output.device',
            text: 'help.profiles.output',
          },
          {
            target: '.profile-list .preset-list-item.selected .preset-name',
            name: 'profiles.title',
            text: 'help.profiles.list',
          },
          {
            target: '.profile-actions__new',
            name: 'profiles.new',
            text: 'help.profiles.new',
          },
          {
            target: '.profile-actions__save',
            name: 'profiles.update',
            text: 'help.profiles.update',
          },
          {
            target: '.extra-outputs__rule .switch',
            name: 'extraOutput.singlePlayer',
            text: 'help.profiles.onePlayer',
          },
          {
            target: '.extra-outputs__on',
            name: 'extraOutput.title',
            text: 'help.profiles.outputs',
          },
          {
            target: '.extra-outputs + .sidebar-section .dropdown',
            name: 'driver.title',
            text: 'help.profiles.driver',
          },
        ],
      },
    ],
  },
  { id: 'songs', group: 'sound', figures: [] },
  {
    id: 'config',
    group: 'sound',
    // The Config page under the FluidEQ Engine, the headphones' chain open
    // (help/live/configFigure).
    figures: [
      {
        live: 'config-page',
        width: 1000,
        height: 700,
        still: 'help/config-page.png',
        controls: [
          {
            target: '.config-status',
            name: 'help.config.statusName',
            text: 'help.config.status',
          },
          {
            target: '.config-inspector__cards',
            name: 'help.config.outputsName',
            text: 'help.config.outputs',
          },
          {
            target: '.config-device__transfer-actions',
            name: 'help.config.transferName',
            text: 'help.config.transfer',
          },
          {
            target: '.config-device__tree > .config-node > .config-node__head',
            name: 'help.config.treeName',
            text: 'help.config.tree',
          },
          {
            target: '.config-node--custom > .config-node__head',
            name: 'help.config.customName',
            text: 'help.config.custom',
          },
          {
            target: '.config-inspector__reload',
            name: 'config.reload',
            text: 'help.config.reload',
          },
        ],
      },
    ],
  },
] as const satisfies readonly IHelpChapter[];

export default SOUND_CHAPTERS;
