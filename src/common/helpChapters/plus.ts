/* Copyright (C) 2026 Ivan Carmenates Garcia. SPDX-License-Identifier: GPL-3.0-or-later */

import { type IHelpChapter } from './model';

/** FluidEQ Plus: the account, the gallery, the Studio, the desktop and lighting. */
// The Plus pictures come from the running window at 2560 x 1392 on
// 2026-09-29, signed in as FluidEQ's maker. The Admin channel only an
// administrator sees is hidden for them.
const PLUS_CHAPTERS = [
  {
    id: 'plus',
    group: 'plus',
    figures: [
      {
        // The tab drawn by its own parts (`help/live/plusFigures`) for a
        // made-up member; this figure is its rail and the gallery's first
        // row. Its still is the 2.0 capture, for the exported guide.
        live: 'visualizers-rail',
        width: 1400,
        height: 440,
        still: '25-plus-visualizers.png',
        controls: [
          {
            target: '.community__channel:nth-of-type(1)',
            name: 'plus.visualizers.title',
            text: 'help.plus.visualizers',
          },
          {
            target: '.community__channel:nth-of-type(2)',
            name: 'studio.title',
            text: 'help.plus.studio',
          },
          {
            target: '.community__channel:nth-of-type(3)',
            name: 'lighting.title',
            text: 'help.plus.lighting',
          },
          {
            target: '.community__rail-pin',
            name: 'plus.rail.collapse',
            text: 'help.plus.fold',
          },
        ],
      },
    ],
    // The Plus tour film (approved for 2.0) is not played here any more: it
    // walks through upgrading and paying monthly, and Plus is not sold now.
  },
  {
    id: 'gallery',
    group: 'plus',
    figures: [
      {
        // The same tab, the gallery framed without the rail.
        live: 'visualizers-gallery',
        width: 1400,
        height: 440,
        frame: '.community__main',
        still: '25-plus-visualizers.png',
        controls: [
          {
            target: '.gallery-search',
            name: 'plus.gallery.search',
            text: 'help.gallery.search',
          },
          {
            target: '.gallery-sorts',
            name: 'help.gallery.sortName',
            text: 'help.gallery.sort',
          },
          {
            // The chips themselves, not the whole row they sit in: a line to
            // the row's far end pointed at empty space beside them.
            target: '.gallery-chips .gallery-chip',
            name: 'help.gallery.categoriesName',
            text: 'help.gallery.categories',
          },
          {
            target: '.gallery-card:first-child',
            name: 'help.gallery.cardName',
            text: 'help.gallery.card',
          },
          {
            target: '.gallery-toolbar__own .button',
            name: 'plus.gallery.mine',
            text: 'help.gallery.mine',
          },
          {
            target: '.wallpaper-status .button:nth-of-type(1)',
            name: 'wallpaper.manage',
            text: 'help.gallery.manage',
          },
          {
            // "Stop" with one monitor playing, "Stop all" with more: the
            // drawing has one.
            target: '.wallpaper-status .button:nth-of-type(2)',
            name: 'wallpaper.stop',
            text: 'help.gallery.stop',
          },
        ],
      },
      {
        // A scene's page in the same tab, Neon City owned and playing; the
        // rail is the figure above's, so this one frames the page alone.
        live: 'gallery-scene',
        width: 1400,
        height: 1020,
        frame: '.community__main',
        caption: 'help.gallery.sceneCaption',
        still: '26-plus-scene.png',
        controls: [
          {
            target: '.gallery-scene__actions > .button:first-child',
            name: 'plus.scene.play',
            text: 'help.gallery.play',
          },
          {
            target: '.wallpaper-scene-action',
            name: 'wallpaper.action',
            text: 'help.gallery.desktop',
          },
          {
            target: '.gallery-scene__inspect .button',
            name: 'plus.inspect.open',
            text: 'help.gallery.inspect',
          },
          {
            target: '.gallery-back',
            name: 'plus.scene.back',
            text: 'help.gallery.back',
          },
        ],
      },
    ],
  },
  {
    id: 'studio',
    group: 'plus',
    figures: [
      {
        // The bench drawn by its own parts (`help/live/studioFigures`) for a
        // made-up project, the work tabs open on What it hears and the chat
        // beside the stage; the rail is the Visualizers figures'. Its still
        // is the 2.0 capture, for the exported guide.
        live: 'studio-bench',
        width: 1400,
        height: 834,
        frame: '.community__main',
        still: '31-plus-studio.png',
        controls: [
          {
            target: '.studio-projects',
            name: 'studio.project.label',
            text: 'help.studio.project',
          },
          {
            target: '.studio-stage',
            name: 'help.studio.stageName',
            text: 'help.studio.stage',
          },
          {
            target: '.studio-stage-controls__button:first-child',
            name: 'studio.size.full',
            text: 'help.studio.size',
          },
          {
            target: '.studio-chat',
            name: 'studioChat.title',
            text: 'help.studio.chat',
          },
          {
            // The tab row, not two of its tabs: side by side under the stage,
            // a second line had to run down through the stage to reach one.
            target: '.studio-work__tabs',
            name: 'studio.work.label',
            text: 'help.studio.tabs',
          },
          {
            target: '.studio-tiles',
            name: 'studio.signals.title',
            text: 'help.studio.signals',
          },
          {
            target: '.studio-meters',
            name: 'studio.meters.title',
            text: 'help.studio.hears',
          },
        ],
      },
    ],
  },
  {
    id: 'desktop',
    group: 'plus',
    figures: [
      {
        // The dialog drawn by its own frame, stage and choices
        // (`help/live/desktopFigures`) for three made-up monitors. Its still
        // is the 2.0 capture, for the exported guide.
        live: 'desktop-dialog',
        width: 900,
        height: 760,
        frame: '.wallpaper-dialog',
        still: '27-desktop-dialog.png',
        controls: [
          {
            // The monitor tiles the line describes, not the "All monitors"
            // box above them, which is where this pointed until 1.7.5.
            target: '.wallpaper-stage',
            name: 'wallpaper.monitors',
            text: 'help.desktop.monitors',
          },
          {
            target: '.wallpaper-motion__option--music',
            name: 'wallpaper.motion.music',
            text: 'help.desktop.music',
          },
          {
            target: '.wallpaper-motion__option--calm',
            name: 'wallpaper.motion.calm',
            text: 'help.desktop.calm',
          },
          {
            target: '.wallpaper-dialog__setting:nth-child(3)',
            name: 'wallpaper.follow',
            text: 'help.desktop.follow',
          },
          {
            target: '.wallpaper-dialog__setting:nth-child(4)',
            name: 'wallpaper.pauseOnBattery',
            text: 'help.desktop.battery',
          },
          {
            target: '.dialog-frame__actions > .button:last-child',
            name: 'wallpaper.start',
            text: 'help.desktop.start',
          },
        ],
      },
    ],
  },
  {
    id: 'lighting',
    group: 'plus',
    figures: [
      {
        // The page drawn by its own stage, rows and editor
        // (`help/live/lightingFigures`) for a made-up desk lit by the Aurora
        // still, in two figures: the page whole is nearly as tall as it is
        // wide, and drawn whole on a 1280 x 800 window it came out a third
        // of the column wide. This one is the switch, the scene and the desk.
        // Both stills are the 2.0 capture, for the exported guide.
        live: 'lighting-page',
        width: 1400,
        height: 560,
        frame: '.lighting-hero',
        still: '29-plus-lighting.png',
        controls: [
          {
            target: '.lighting-switch',
            name: 'lighting.switch',
            text: 'help.lighting.switch',
          },
          {
            target: '.lighting-scene-bar .button',
            name: 'lighting.pickScene',
            text: 'help.lighting.browse',
          },
          {
            target: '.lighting-stage',
            name: 'help.lighting.previewName',
            text: 'help.lighting.preview',
          },
        ],
      },
      {
        // The same page's devices and style, under the desk.
        live: 'lighting-tuning',
        width: 1400,
        height: 740,
        frame: '.lighting-columns',
        still: '29-plus-lighting.png',
        controls: [
          {
            // The device rows, not the whole card. Their line tells of the
            // All devices button over them too: on a line of its own, that
            // button's ran out to the right through the style card's Reset.
            target: '.lighting-device',
            name: 'lighting.devices.title',
            text: 'help.lighting.devices',
          },
          {
            // The four style buttons, not the card's header row — that box
            // put the line on the card's Reset button.
            target: '.lighting-effects',
            name: 'lighting.tuning.title',
            text: 'help.lighting.style',
          },
        ],
      },
    ],
  },
] as const satisfies readonly IHelpChapter[];

export default PLUS_CHAPTERS;
