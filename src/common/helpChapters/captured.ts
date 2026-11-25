/* Copyright (C) 2026 Ivan Carmenates Garcia. SPDX-License-Identifier: GPL-3.0-or-later */

import type { IHelpFigure } from './model';

/**
 * WRITTEN BY `scripts/help-captures/capture.ts`; do not edit by hand.
 *
 * The figures that script takes, each with the boxes of its numbered
 * controls as measured in the same render as the picture in `docs/`. Retake
 * a picture and its boxes come with it: run the script again (its README says
 * how), never move a box here.
 */
const CAPTURED = {
  '23-graph-view-menu.png': {
    image: '23-graph-view-menu.png',
    width: 372,
    height: 714,
    caption: 'help.graph.viewCaption',
    controls: [
      {
        box: [6, 62, 360, 28],
        name: 'graph.view.fullscreen',
        text: 'help.graph.fullscreen',
        keys: 'Ctrl+F',
      },
      {
        box: [6, 127, 360, 28],
        name: 'help.graph.showingName',
        text: 'help.graph.showing',
        keys: 'Ctrl+W',
      },
      {
        box: [6, 183, 360, 28],
        name: 'graph.item.eqLabels',
        text: 'help.graph.labels',
      },
      {
        box: [6, 211, 360, 28],
        name: 'help.graph.waveName',
        text: 'help.graph.wave',
      },
      {
        box: [6, 239, 360, 28],
        name: 'help.graph.topWaveName',
        text: 'help.graph.topWave',
      },
      {
        box: [6, 267, 360, 28],
        name: 'help.graph.gridName',
        text: 'help.graph.grid',
        keys: 'Ctrl+G',
      },
      {
        box: [6, 295, 360, 28],
        name: 'help.graph.bandsName',
        text: 'help.graph.bandsMenu',
      },
      {
        box: [6, 323, 360, 28],
        name: 'help.graph.meterName',
        text: 'help.graph.meter',
      },
      {
        box: [6, 464, 360, 28],
        name: 'graph.style.next',
        text: 'help.graph.next',
        keys: 'Space',
      },
      {
        box: [6, 492, 360, 28],
        name: 'graph.style.previous',
        text: 'help.graph.previous',
        keys: 'Ctrl+Space',
      },
      {
        box: [6, 351, 360, 24],
        name: 'graph.waveHeight',
        text: 'help.graph.waveHeight',
      },
      {
        box: [6, 375, 360, 24],
        name: 'graph.wavePosition',
        text: 'help.graph.wavePosition',
      },
      {
        box: [0, 0, 372, 713],
        name: 'settings.group.drawing',
        text: 'help.graph.drawing',
      },
    ],
  },
  '14-share-audio-roles.png': {
    image: '14-share-audio-roles.png',
    width: 2560,
    height: 1392,
  },
} as const satisfies Record<string, IHelpFigure>;

export default CAPTURED;
