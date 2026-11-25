/* Copyright (C) 2026 Ivan Carmenates Garcia. SPDX-License-Identifier: GPL-3.0-or-later */

import { type IHelpChapter } from './model';

/** The graph, its looks and the Plus visualizers in it. */
const VISUAL_CHAPTERS = [
  {
    id: 'graph',
    group: 'visuals',
    // The graph drawn by its own Chart from made-up bands, its options out
    // (help/live/graphFigures): on a standard style, framed whole; on a
    // scene, framed to the gallery reel over the scene's still; and the View
    // menu open.
    figures: [
      {
        live: 'graph-style',
        width: 1180,
        height: 400,
        frame: '.graph-wrapper',
        caption: 'help.graph.stripCaption',
        still: '21-graph-strip.png',
        controls: [
          {
            target: '.graph-corner-legend',
            name: 'graph.switch.legend',
            text: 'help.graph.legend',
          },
          {
            target: '.graph-gallery-edge--previous',
            name: 'graph.style.previous',
            text: 'help.graph.previous',
            keys: 'Ctrl+Space',
          },
          {
            target: '.graph-gallery-credit__title',
            name: 'graph.picker.label',
            text: 'help.graph.picker',
          },
          {
            target: '.graph-gallery-credit__place',
            name: 'help.graph.placeName',
            text: 'help.graph.place',
          },
          {
            target: '.graph-auto-cycle',
            name: 'graph.autoSwitch.label',
            text: 'help.graph.auto',
          },
          {
            target:
              '.graph-gallery-credit__tools-row > .graph-look-step:first-of-type',
            name: 'look.palette.cycle',
            text: 'help.graph.colouring',
          },
          {
            target: '.graph-gallery-credit__tools-row > .graph-solo',
            name: 'graph.design.new',
            text: 'help.graph.newLook',
          },
          {
            target:
              '.graph-gallery-credit__tools-row > .graph-look-step:last-of-type',
            name: 'help.graph.gridName',
            text: 'help.graph.grid',
            keys: 'Ctrl+G',
          },
          {
            target: '.graph-edit-hint-mark',
            name: 'help.graph.hintName',
            text: 'help.graph.hint',
          },
          {
            target: '.graph-gallery-edge--next',
            name: 'graph.style.next',
            text: 'help.graph.next',
            keys: 'Space',
          },
          {
            target: '.graph-view-menu',
            name: 'help.graph.viewName',
            text: 'help.graph.view',
          },
          {
            target: '.view-bar__icon',
            name: 'graph.view.fullscreen',
            text: 'help.graph.fullscreen',
            keys: 'Ctrl+F',
          },
        ],
      },
      {
        live: 'graph-scene',
        width: 1180,
        height: 400,
        frame: '.graph-gallery-reel',
        margin: 10,
        caption: 'help.graph.plusCaption',
        still: '22-graph-strip-plus.png',
        controls: [
          {
            target: '.graph-gallery-credit__who',
            name: 'help.graph.creditName',
            text: 'help.graph.credit',
          },
          {
            target: '.graph-like',
            name: 'help.graph.likeName',
            text: 'help.graph.like',
          },
          {
            target: '.graph-lighting',
            name: 'lighting.title',
            text: 'help.graph.lighting',
          },
          {
            target: '.graph-wallpaper',
            name: 'wallpaper.action',
            text: 'help.graph.desktop',
          },
        ],
      },
      {
        live: 'graph-view-menu',
        width: 380,
        height: 640,
        frame: '.graph-view-menu__list',
        margin: 6,
        caption: 'help.graph.viewCaption',
        still: '23-graph-view-menu.png',
        controls: [
          {
            target: '.graph-view-menu__list > button[role="menuitemradio"]',
            name: 'graph.view.fullscreen',
            text: 'help.graph.fullscreen',
            keys: 'Ctrl+F',
          },
          {
            target:
              '.graph-view-menu__slider--switch:nth-of-type(2), .graph-view-menu__slider--switch:nth-of-type(3)',
            name: 'graph.curves',
            text: 'help.graph.curves',
            keys: 'Ctrl+W',
          },
          {
            target: '.graph-view-menu__slider--switch:nth-of-type(4)',
            name: 'graph.switch.eqLabels',
            text: 'help.graph.labels',
          },
          {
            target: '.graph-view-menu__slider--switch:nth-of-type(6)',
            name: 'graph.switch.wave',
            text: 'help.graph.wave',
          },
          {
            target: '.graph-view-menu__slider--switch:nth-of-type(8)',
            name: 'graph.frequencyRange',
            text: 'help.graph.range',
          },
          {
            target: '.graph-view-menu__slider--switch:nth-of-type(9)',
            name: 'graph.analyserSlope',
            text: 'help.graph.slope',
          },
          {
            target: '.graph-view-menu__slider--switch:nth-of-type(10)',
            name: 'graph.switch.meter',
            text: 'help.graph.meter',
          },
          {
            target: '.graph-view-menu__group:last-of-type',
            name: 'settings.group.drawing',
            text: 'help.graph.drawing',
          },
        ],
      },
    ],
  },
  {
    id: 'looks',
    group: 'visuals',
    figures: [
      {
        // The picker, open, drawn by its own list (`help/live/lookFigures`)
        // from FluidEQ's styles and made-up scenes on the stills the app
        // ships, laid out as the Library is since 2026-11-19: the rail of
        // places, the From tabs over the looks, the view and the order.
        // Its still is the 2.0 capture, for the exported guide.
        live: 'look-picker',
        width: 880,
        height: 600,
        // The picker's own box: on a window under 896px it is narrower than
        // the 880 it is laid out at, as the real one is there.
        frame: '.look-picker__menu',
        still: '24-look-picker.png',
        controls: [
          {
            target: '.look-picker__search',
            name: 'help.looks.searchName',
            text: 'help.looks.search',
          },
          {
            target: '.look-picker__rail',
            name: 'help.looks.placesName',
            text: 'help.looks.places',
          },
          {
            target: '.look-picker__froms',
            name: 'graph.picker.from',
            text: 'help.looks.from',
          },
          {
            target: '.look-picker__grid',
            name: 'graph.picker.label',
            text: 'help.looks.plus',
          },
          {
            target: '.look-picker__views',
            name: 'help.looks.viewName',
            text: 'help.looks.view',
          },
        ],
      },
    ],
  },
] as const satisfies readonly IHelpChapter[];

export default VISUAL_CHAPTERS;
