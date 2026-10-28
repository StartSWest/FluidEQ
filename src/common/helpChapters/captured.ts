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
  '16-eq-bands.png': {
    image: '16-eq-bands.png',
    width: 2080,
    height: 1152,
    caption: 'help.eq.bandsCaption',
    controls: [
      {
        box: [1436, 12, 102, 32],
        name: 'dsp.presets',
        text: 'help.eq.voicing',
      },
      {
        box: [1549, 12, 110, 32],
        name: 'eq.smart',
        text: 'help.eq.smart',
      },
      {
        box: [1668, 12, 104, 32],
        name: 'eq.mode',
        text: 'help.eq.mode',
      },
      {
        box: [1782, 12, 104, 32],
        name: 'eq.quickLayouts',
        text: 'help.eq.layouts',
      },
      {
        box: [1892, 12, 32, 32],
        name: 'eq.addBand',
        text: 'help.eq.add',
      },
      {
        box: [1934, 12, 90, 32],
        name: 'graph.curves',
        text: 'help.eq.layers',
      },
      {
        box: [2034, 12, 32, 32],
        name: 'eq.clear',
        text: 'help.eq.clear',
      },
      {
        box: [1191, 270, 48, 42],
        name: 'help.eq.labelName',
        text: 'help.eq.label',
      },
      {
        box: [1124, 617, 64, 380],
        name: 'help.eq.bandName',
        text: 'help.eq.band',
      },
      {
        box: [792, 1022, 88, 108],
        name: 'eq.tone.bass',
        text: 'help.eq.bass',
      },
      {
        box: [894, 1022, 88, 108],
        name: 'eq.tone.mid',
        text: 'help.eq.mid',
      },
      {
        box: [996, 1022, 88, 108],
        name: 'eq.tone.treble',
        text: 'help.eq.treble',
      },
    ],
  },
  '36-eq-band-selected.png': {
    image: '36-eq-band-selected.png',
    width: 2078,
    height: 1197,
    caption: 'help.eq.bandCaption',
    controls: [
      {
        box: [1999, 12, 65, 32],
        name: 'dsp.latency.gameMode',
        text: 'help.eq.gameMode',
      },
      {
        box: [686, 1067, 104, 108],
        name: 'eq.selected',
        text: 'help.eq.selected',
      },
      {
        box: [798, 1067, 162, 108],
        name: 'eq.filter',
        text: 'help.eq.filter',
      },
      {
        box: [968, 1067, 84, 108],
        name: 'eq.frequency',
        text: 'help.eq.frequency',
      },
      {
        box: [1060, 1067, 84, 108],
        name: 'eq.gain',
        text: 'help.eq.gain',
      },
      {
        box: [1152, 1067, 84, 108],
        name: 'eq.quality',
        text: 'help.eq.q',
      },
      {
        box: [1244, 1067, 56, 108],
        name: 'eq.active',
        text: 'help.eq.disable',
      },
      {
        box: [1308, 1100, 38, 38],
        name: 'eq.delete',
        text: 'help.eq.delete',
      },
    ],
  },
  '18-eq-mode.png': {
    image: '18-eq-mode.png',
    width: 329,
    height: 577,
    caption: 'help.eqmode.modeCaption',
    controls: [
      {
        box: [261, 16, 26, 26],
        name: 'eq.mode.unpin',
        text: 'help.eqmode.pin',
      },
      {
        box: [21, 59, 287, 31],
        name: 'help.eqmode.tabsName',
        text: 'help.eqmode.tabs',
      },
      {
        box: [21, 102, 287, 54],
        name: 'eq.mode.strength',
        text: 'help.eqmode.strength',
      },
      {
        box: [21, 168, 287, 54],
        name: 'eq.mode.q',
        text: 'help.eqmode.q',
      },
      {
        box: [21, 234, 287, 88],
        name: 'eq.mode.phase',
        text: 'help.eqmode.phase',
      },
      {
        box: [21, 334, 287, 85],
        name: 'eq.mode.treble',
        text: 'help.eqmode.treble',
      },
      {
        box: [21, 431, 287, 67],
        name: 'eq.mode.smoothing',
        text: 'help.eqmode.smoothing',
      },
      {
        box: [237, 523, 71, 32],
        name: 'eq.mode.reset',
        text: 'help.eqmode.reset',
      },
    ],
  },
  '40-rail-right.png': {
    image: '40-rail-right.png',
    width: 329,
    height: 897,
    controls: [
      {
        box: [9, 9, 311, 40],
        name: 'eq.mode',
        text: 'help.profiles.eqMode',
      },
      {
        box: [32, 122, 244, 30],
        name: 'output.device',
        text: 'help.profiles.output',
      },
      {
        box: [21, 193, 287, 32],
        name: 'profiles.title',
        text: 'help.profiles.list',
      },
      {
        box: [21, 267, 107, 32],
        name: 'profiles.new',
        text: 'help.profiles.new',
      },
      {
        box: [225, 267, 83, 32],
        name: 'profiles.update',
        text: 'help.profiles.update',
      },
      {
        box: [21, 309, 287, 65],
        name: 'songSound.switch',
        text: 'help.profiles.songSound',
      },
      {
        box: [21, 485, 287, 54],
        name: 'extraOutput.singlePlayer',
        text: 'help.profiles.onePlayer',
      },
      {
        box: [21, 565, 287, 144],
        name: 'extraOutput.title',
        text: 'help.profiles.outputs',
      },
      {
        box: [239, 646, 69, 22],
        name: 'extraOutput.edit',
        text: 'help.profiles.editSound',
      },
      {
        box: [8, 769, 313, 120],
        name: 'driver.title',
        text: 'help.profiles.driver',
      },
    ],
  },
  '23-graph-view-menu.png': {
    image: '23-graph-view-menu.png',
    width: 372,
    height: 762,
    caption: 'help.graph.viewCaption',
    controls: [
      {
        box: [6, 34, 360, 28],
        name: 'graph.view.expand',
        text: 'help.graph.expand',
        keys: 'Ctrl+S',
      },
      {
        box: [6, 62, 360, 28],
        name: 'graph.view.fullscreen',
        text: 'help.graph.fullscreen',
        keys: 'Ctrl+F',
      },
      {
        box: [6, 175, 360, 28],
        name: 'help.graph.showingName',
        text: 'help.graph.showing',
        keys: 'Ctrl+W',
      },
      {
        box: [6, 231, 360, 28],
        name: 'graph.item.eqLabels',
        text: 'help.graph.labels',
      },
      {
        box: [6, 259, 360, 28],
        name: 'help.graph.waveName',
        text: 'help.graph.wave',
      },
      {
        box: [6, 287, 360, 28],
        name: 'help.graph.topWaveName',
        text: 'help.graph.topWave',
      },
      {
        box: [6, 315, 360, 28],
        name: 'help.graph.gridName',
        text: 'help.graph.grid',
        keys: 'Ctrl+G',
      },
      {
        box: [6, 343, 360, 28],
        name: 'help.graph.bandsName',
        text: 'help.graph.bandsMenu',
      },
      {
        box: [6, 371, 360, 28],
        name: 'help.graph.meterName',
        text: 'help.graph.meter',
      },
      {
        box: [6, 512, 360, 28],
        name: 'graph.style.next',
        text: 'help.graph.next',
        keys: 'Space',
      },
      {
        box: [6, 540, 360, 28],
        name: 'graph.style.previous',
        text: 'help.graph.previous',
        keys: 'Ctrl+Space',
      },
      {
        box: [6, 399, 360, 24],
        name: 'graph.waveHeight',
        text: 'help.graph.waveHeight',
      },
      {
        box: [6, 423, 360, 24],
        name: 'graph.wavePosition',
        text: 'help.graph.wavePosition',
      },
      {
        box: [0, 0, 372, 761],
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
