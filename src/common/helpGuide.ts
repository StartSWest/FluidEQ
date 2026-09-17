/* Copyright (C) 2026 Ivan Carmenates Garcia. SPDX-License-Identifier: GPL-3.0-or-later */

import type { TranslationKey } from './i18n';

/**
 * The user guide's chapters, their captures, and the controls each capture
 * explains. The shipped reader and the exported documents both read this, so
 * a capture renamed here cannot leave either behind.
 */

/** x, y, width, height on a capture, in the capture's own pixels. */
export type THelpBox = readonly [number, number, number, number];

/**
 * One control a capture explains.
 *
 * The boxes were measured in the running window as the capture was taken:
 * `box` is where the control is, and pointing at its line rings it there;
 * `icon`, where the control has a picture worth repeating, is the piece of
 * the capture drawn beside the line, so the icon a reader is told about is
 * the one they will look for.
 *
 * `name` is the app's own label for the control wherever it has one that
 * reads on its own, so the name in the guide is the name on screen in every
 * language; `text` is the guide's line on what it is for.
 */
export interface IHelpControl {
  readonly box: THelpBox;
  readonly icon?: THelpBox;
  readonly name: TranslationKey;
  readonly text: TranslationKey;
  /** The shortcut, as the app prints it. */
  readonly keys?: string;
}

export interface IHelpFigure<TImage extends string = string> {
  /** A file in `docs/`. */
  readonly image: TImage;
  readonly width: number;
  readonly height: number;
  /** What this capture shows, for a chapter with more than one. */
  readonly caption?: TranslationKey;
  readonly controls?: readonly IHelpControl[];
}

/**
 * The largest a control's piece of the capture is drawn beside its line.
 *
 * Wide enough for the look picker's pill and a menu row's icon alike, and
 * never scaled up: a piece drawn larger than it was captured is only a
 * blurrier copy of it.
 */
const PIECE = { width: 168, height: 44 } as const;

export const helpPieceScale = ([, , width, height]: THelpBox): number =>
  Math.min(1, PIECE.width / width, PIECE.height / height);

/**
 * What a capture is drawn down by, so it is never shown larger than it was
 * on screen: drawn to the reading column's full width, the
 * band menu came out nearly three times its size and EQ mode 2,229px tall.
 * The whole-window captures are wider than any column either way.
 */
const CAPTURE_SCALE = 1.5;

/**
 * The tallest a capture is drawn, as a share of the window's height, so a tall
 * panel shrinks to be read beside its legend instead of scrolled past.
 * Enlarging it still shows every pixel.
 */
const CAPTURE_MAX_VIEWPORT = 72;

/**
 * The widest a capture may be drawn, as a CSS length: the column, its size on
 * screen, or the width at which it is as tall as the window allows — whichever
 * is least. The reader and the exported guide both use it as the capture's
 * flex basis too, so a narrow capture leaves room for its legend beside it and
 * a wide one takes the line, with the legend under it.
 */
export const helpCaptureWidth = (figure: IHelpFigure): string =>
  `min(100%, ${figure.width / CAPTURE_SCALE}px, ${CAPTURE_MAX_VIEWPORT}vh * ${
    figure.width / figure.height
  })`;

export const HELP_GROUPS = [
  'start',
  'sound',
  'visuals',
  'plus',
  'listen',
  'help',
] as const;

export type THelpGroup = (typeof HELP_GROUPS)[number];

/** A capture of the whole window. */
const WINDOW = { width: 2560, height: 1392 } as const;

export interface IHelpChapter<
  TId extends string = string,
  TImage extends string = string,
> {
  readonly id: TId;
  readonly group: THelpGroup;
  readonly figures: readonly IHelpFigure<TImage>[];
}

const CHAPTERS = [
  {
    id: 'start',
    group: 'start',
    figures: [
      { image: '03-eq-parametric-bands-and-live-response.png', ...WINDOW },
    ],
  },
  {
    // What a machine needs, before anything is installed on it. The only
    // chapter with no capture: a list of numbers has nothing to point at, and
    // a screenshot of the window here would be one already shown above.
    id: 'requirements',
    group: 'start',
    figures: [],
  },
  {
    id: 'engine',
    group: 'start',
    figures: [
      {
        image: '15-engine-dialog.png',
        width: 620,
        height: 444,
        controls: [
          {
            box: [66, 100, 512, 109],
            icon: [74, 145, 20, 20],
            name: 'engine.fluid.name',
            text: 'help.engine.fluid',
          },
          {
            box: [66, 251, 512, 86],
            icon: [74, 284, 20, 20],
            name: 'engine.apo.name',
            text: 'help.engine.apo',
          },
          {
            box: [541, 387, 54, 32],
            icon: [549, 393, 20, 20],
            name: 'engine.apply',
            text: 'help.engine.apply',
          },
        ],
      },
    ],
  },
  {
    id: 'eq',
    group: 'sound',
    figures: [
      {
        image: '16-eq-bands.png',
        width: 1996,
        height: 585,
        caption: 'help.eq.bandsCaption',
        controls: [
          {
            box: [663, 14, 101, 32],
            icon: [671, 20, 20, 20],
            name: 'voicing.quickLabel',
            text: 'help.eq.voicing',
          },
          {
            box: [774, 14, 75, 32],
            icon: [782, 20, 20, 20],
            name: 'eq.smart',
            text: 'help.eq.smart',
          },
          {
            box: [883, 14, 88, 32],
            icon: [891, 20, 20, 20],
            name: 'eq.clear',
            text: 'help.eq.clear',
          },
          {
            box: [981, 11, 133, 38],
            icon: [989, 20, 20, 20],
            name: 'eq.mode',
            text: 'help.eq.mode',
          },
          {
            box: [1124, 14, 95, 32],
            icon: [1132, 20, 20, 20],
            name: 'eq.addBand',
            text: 'help.eq.add',
          },
          {
            box: [1229, 14, 104, 32],
            icon: [1237, 20, 20, 20],
            name: 'eq.quickLayouts',
            text: 'help.eq.layouts',
          },
          {
            box: [950, 518, 50, 50],
            icon: [958, 533, 20, 20],
            name: 'eq.frequency',
            text: 'help.eq.frequency',
          },
          {
            box: [1022, 518, 50, 50],
            icon: [1030, 533, 20, 20],
            name: 'eq.gain',
            text: 'help.eq.gain',
          },
          {
            box: [1094, 518, 50, 50],
            icon: [1102, 533, 20, 20],
            name: 'eq.quality',
            text: 'help.eq.q',
          },
          {
            box: [1223, 524, 112, 38],
            icon: [1231, 533, 20, 20],
            name: 'eq.delete',
            text: 'help.eq.delete',
          },
        ],
      },
      {
        image: '17-band-menu.png',
        width: 200,
        height: 185,
        caption: 'help.eq.menuCaption',
        controls: [
          {
            box: [6, 30, 188, 34],
            icon: [14, 37, 20, 20],
            name: 'eq.menu.reset',
            text: 'help.eq.reset',
          },
          {
            box: [6, 65, 188, 34],
            icon: [14, 72, 20, 20],
            name: 'eq.menu.disable',
            text: 'help.eq.disable',
          },
          {
            box: [6, 110, 188, 34],
            icon: [14, 117, 20, 20],
            name: 'eq.menu.addLeft',
            text: 'help.eq.addLeft',
          },
          {
            box: [6, 145, 188, 34],
            icon: [14, 152, 20, 20],
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
      {
        image: '18-eq-mode.png',
        width: 420,
        height: 927,
        caption: 'help.eqmode.modeCaption',
        controls: [
          {
            box: [34, 119, 352, 72],
            icon: [42, 145, 20, 20],
            name: 'eq.mode.strength',
            text: 'help.eqmode.strength',
          },
          {
            box: [34, 207, 352, 72],
            icon: [42, 233, 20, 20],
            name: 'eq.mode.q',
            text: 'help.eqmode.q',
          },
          {
            box: [34, 666, 352, 72],
            icon: [42, 692, 20, 20],
            name: 'eq.mode.smoothing',
            text: 'help.eqmode.smoothing',
          },
          {
            box: [34, 295, 352, 108],
            icon: [42, 339, 20, 20],
            name: 'eq.mode.phase',
            text: 'help.eqmode.phase',
          },
          {
            box: [338, 17, 65, 32],
            icon: [346, 23, 20, 20],
            name: 'eq.mode.reset',
            text: 'help.eqmode.reset',
          },
        ],
      },
      {
        image: '19-band-designs.png',
        width: 330,
        height: 220,
        caption: 'help.eqmode.designsCaption',
        controls: [
          {
            box: [15, 15, 300, 190],
            icon: [23, 100, 20, 20],
            name: 'eq.layouts.builtIn',
            text: 'help.eqmode.builtIn',
          },
          {
            box: [205, 173, 111, 32],
            icon: [213, 179, 20, 20],
            name: 'eq.layouts.saveNew',
            text: 'help.eqmode.save',
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
    id: 'profiles',
    group: 'sound',
    figures: [
      {
        image: '02-online-media-multiple-outputs-one-player-at-a-time.png',
        ...WINDOW,
      },
    ],
  },
  {
    id: 'config',
    group: 'sound',
    figures: [{ image: '06-eq-equalizer-apo-config.png', ...WINDOW }],
  },
  {
    id: 'dsp',
    group: 'sound',
    figures: [
      {
        image: '20-dsp.png',
        width: 2560,
        height: 1392,
        controls: [
          {
            box: [0, 83, 200, 42],
            icon: [8, 94, 20, 20],
            name: 'dsp.normalizer.title',
            text: 'help.dsp.normalizer',
          },
          {
            box: [0, 129, 200, 42],
            icon: [8, 140, 20, 20],
            name: 'dsp.denoise.title',
            text: 'help.dsp.denoise',
          },
          {
            box: [0, 175, 200, 42],
            icon: [8, 186, 20, 20],
            name: 'dsp.exciter.title',
            text: 'help.dsp.exciter',
          },
          {
            box: [0, 221, 200, 42],
            icon: [8, 232, 20, 20],
            name: 'dsp.bassForge.title',
            text: 'help.dsp.bassForge',
          },
          {
            box: [0, 267, 200, 42],
            icon: [8, 278, 20, 20],
            name: 'dsp.eq.title',
            text: 'help.dsp.equaliser',
          },
          {
            box: [0, 313, 200, 42],
            icon: [8, 324, 20, 20],
            name: 'dsp.bassPunch.title',
            text: 'help.dsp.bassPunch',
          },
          {
            box: [0, 359, 200, 42],
            icon: [8, 370, 20, 20],
            name: 'dsp.dimension.title',
            text: 'help.dsp.dimension',
          },
          {
            box: [0, 451, 200, 42],
            icon: [8, 462, 20, 20],
            name: 'dsp.maximizer.title',
            text: 'help.dsp.maximizer',
          },
          {
            box: [0, 497, 200, 42],
            icon: [8, 508, 20, 20],
            name: 'dsp.master.title',
            text: 'help.dsp.master',
          },
          {
            box: [0, 580, 200, 42],
            icon: [8, 591, 20, 20],
            name: 'dsp.crossfade.title',
            text: 'help.dsp.crossfade',
          },
          {
            box: [1816, 5, 50, 28],
            icon: [1824, 9, 20, 20],
            name: 'help.dsp.scopeName',
            text: 'help.dsp.scope',
          },
          {
            box: [123, 3, 210, 32],
            icon: [131, 9, 20, 20],
            name: 'dsp.presets',
            text: 'help.dsp.presets',
          },
        ],
      },
    ],
  },
  {
    // The Room card alone, clipped from a 1372px window at 1.5 device pixels
    // per CSS pixel, with the living room chosen and stereo playing so five
    // speakers and the sub are drawn asleep, as the chapter describes.
    id: 'room',
    group: 'sound',
    figures: [
      {
        image: '32-dsp-room.png',
        width: 1762,
        height: 779,
        controls: [
          {
            box: [15, 85, 1137, 679],
            icon: [23, 415, 20, 20],
            name: 'dsp.room.graphLabel',
            text: 'help.room.picture',
          },
          {
            box: [1173, 114, 564, 92],
            icon: [1181, 150, 20, 20],
            name: 'help.room.dialsName',
            text: 'help.room.dials',
          },
          {
            box: [1519, 25, 129, 14],
            name: 'help.room.liveName',
            text: 'help.room.live',
          },
          {
            box: [59, 16, 210, 32],
            icon: [67, 22, 20, 20],
            name: 'dsp.room.presets',
            text: 'help.room.picker',
          },
          {
            box: [1446, 303, 46, 32],
            icon: [1454, 309, 20, 20],
            name: 'dsp.room.fit',
            text: 'help.room.fit',
          },
          {
            box: [1272, 353, 143, 21],
            name: 'dsp.room.groupHead',
            text: 'help.room.head',
          },
          {
            box: [1272, 353, 143, 21],
            name: 'dsp.room.groupHeadphones',
            text: 'help.room.headphones',
          },
          {
            box: [1646, 221, 90, 32],
            icon: [1654, 227, 20, 20],
            name: 'dsp.room.saveRoom',
            text: 'help.room.saved',
          },
        ],
      },
    ],
  },
  {
    id: 'denoise',
    group: 'sound',
    figures: [{ image: '13-dsp-denoise-and-source-analysis.png', ...WINDOW }],
  },
  {
    id: 'graph',
    group: 'visuals',
    figures: [
      {
        image: '21-graph-strip.png',
        width: 966,
        height: 52,
        caption: 'help.graph.stripCaption',
        controls: [
          {
            box: [289, 12, 81, 28],
            icon: [297, 16, 20, 20],
            name: 'graph.liveOutput',
            text: 'help.graph.live',
          },
          {
            box: [380, 17, 16, 18],
            name: 'graph.style.previous',
            text: 'help.graph.previous',
          },
          {
            box: [406, 15, 194, 22],
            name: 'graph.picker.label',
            text: 'help.graph.picker',
          },
          {
            box: [610, 17, 16, 18],
            name: 'graph.style.next',
            text: 'help.graph.next',
          },
          {
            box: [738, 17, 18, 18],
            name: 'help.graph.autoName',
            text: 'help.graph.auto',
          },
          {
            box: [738, 17, 18, 18],
            name: 'look.palette.cycle',
            text: 'help.graph.colouring',
          },
          {
            box: [766, 12, 67, 28],
            icon: [774, 16, 20, 20],
            name: 'graph.design.new',
            text: 'help.graph.newLook',
          },
          {
            box: [842, 17, 18, 18],
            name: 'help.graph.bandsName',
            text: 'help.graph.bands',
          },
          {
            box: [870, 17, 18, 18],
            name: 'help.graph.gridName',
            text: 'help.graph.grid',
          },
          {
            box: [898, 12, 56, 28],
            icon: [906, 16, 20, 20],
            name: 'help.graph.viewName',
            text: 'help.graph.view',
          },
        ],
      },
      {
        image: '22-graph-strip-plus.png',
        width: 917,
        height: 52,
        caption: 'help.graph.plusCaption',
        controls: [
          {
            box: [737, 17, 18, 18],
            name: 'help.graph.tintName',
            text: 'help.graph.tint',
          },
          {
            box: [765, 17, 18, 18],
            name: 'lighting.title',
            text: 'help.graph.lighting',
          },
          {
            box: [793, 17, 18, 18],
            name: 'wallpaper.action',
            text: 'help.graph.desktop',
          },
        ],
      },
      {
        image: '23-graph-view-menu.png',
        width: 372,
        height: 780,
        caption: 'help.graph.viewCaption',
        controls: [
          {
            box: [6, 34, 352, 28],
            icon: [14, 38, 20, 20],
            name: 'graph.view.expand',
            text: 'help.graph.expand',
            keys: 'Ctrl+S',
          },
          {
            box: [6, 62, 352, 28],
            icon: [14, 66, 20, 20],
            name: 'graph.view.fullscreen',
            text: 'help.graph.fullscreen',
            keys: 'Ctrl+F',
          },
          {
            box: [6, 155, 352, 28],
            icon: [14, 159, 20, 20],
            name: 'help.graph.showingName',
            text: 'help.graph.showing',
            keys: 'Ctrl+W',
          },
          {
            box: [6, 267, 352, 28],
            icon: [14, 271, 20, 20],
            name: 'help.graph.waveName',
            text: 'help.graph.wave',
          },
          {
            box: [6, 295, 352, 28],
            icon: [14, 299, 20, 20],
            name: 'help.graph.topWaveName',
            text: 'help.graph.topWave',
          },
          {
            box: [6, 323, 352, 28],
            icon: [14, 327, 20, 20],
            name: 'help.graph.gridName',
            text: 'help.graph.grid',
            keys: 'Ctrl+G',
          },
          {
            box: [6, 351, 352, 28],
            icon: [14, 355, 20, 20],
            name: 'help.graph.bandsName',
            text: 'help.graph.bandsMenu',
          },
          {
            box: [6, 379, 352, 28],
            icon: [14, 383, 20, 20],
            name: 'help.graph.meterName',
            text: 'help.graph.meter',
          },
          {
            box: [214, 418, 96, 3],
            name: 'graph.waveHeight',
            text: 'help.graph.waveHeight',
          },
          {
            box: [214, 442, 96, 3],
            name: 'graph.wavePosition',
            text: 'help.graph.wavePosition',
          },
          {
            box: [6, 492, 352, 28],
            icon: [14, 496, 20, 20],
            name: 'graph.style.next',
            text: 'help.graph.next',
            keys: 'Space',
          },
          {
            box: [6, 520, 352, 28],
            icon: [14, 524, 20, 20],
            name: 'graph.style.previous',
            text: 'help.graph.previous',
            keys: 'Ctrl+Space',
          },
          {
            box: [6, 600, 352, 24],
            name: 'graph.scene.attack',
            text: 'help.graph.attack',
          },
          {
            box: [6, 624, 352, 24],
            name: 'graph.scene.release',
            text: 'help.graph.release',
          },
          {
            box: [6, 648, 352, 28],
            icon: [14, 652, 20, 20],
            name: 'graph.scene.ownTiming',
            text: 'help.graph.ownTiming',
          },
          {
            box: [6, 90, 352, 28],
            icon: [14, 94, 20, 20],
            name: 'wallpaper.action',
            text: 'help.graph.desktop',
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
        image: '24-look-picker.png',
        width: 780,
        height: 560,
        controls: [
          {
            box: [1, 1, 778, 32],
            icon: [9, 7, 20, 20],
            name: 'help.looks.searchName',
            text: 'help.looks.search',
          },
          {
            box: [1, 33, 326, 526],
            icon: [9, 286, 20, 20],
            name: 'graph.picker.styles',
            text: 'help.looks.styles',
          },
          {
            box: [47, 63, 41, 20],
            name: 'help.looks.familiesName',
            text: 'help.looks.families',
          },
          {
            box: [327, 33, 452, 526],
            icon: [335, 286, 20, 20],
            name: 'graph.picker.plus',
            text: 'help.looks.plus',
          },
          {
            box: [374, 68, 49, 20],
            name: 'help.looks.categoriesName',
            text: 'help.looks.categories',
          },
        ],
      },
    ],
  },
  {
    id: 'plus',
    group: 'plus',
    figures: [
      {
        image: '25-plus-visualizers.png',
        width: 1984,
        height: 500,
        controls: [
          {
            box: [5, 47, 218, 42],
            icon: [13, 58, 20, 20],
            name: 'leaderboard.title',
            text: 'help.plus.leaderboard',
          },
          {
            box: [5, 91, 218, 42],
            icon: [13, 102, 20, 20],
            name: 'plus.visualizers.title',
            text: 'help.plus.visualizers',
          },
          {
            box: [5, 135, 218, 42],
            icon: [13, 146, 20, 20],
            name: 'studio.title',
            text: 'help.plus.studio',
          },
          {
            box: [5, 179, 218, 42],
            icon: [13, 190, 20, 20],
            name: 'lighting.title',
            text: 'help.plus.lighting',
          },
          {
            box: [11, 9, 28, 28],
            icon: [19, 13, 20, 20],
            name: 'plus.rail.collapse',
            text: 'help.plus.fold',
          },
        ],
      },
    ],
  },
  {
    id: 'gallery',
    group: 'plus',
    figures: [
      {
        image: '25-plus-visualizers.png',
        width: 1984,
        height: 500,
        controls: [
          {
            box: [240, 61, 320, 32],
            icon: [248, 67, 20, 20],
            name: 'plus.gallery.search',
            text: 'help.gallery.search',
          },
          {
            box: [571, 66, 73, 21],
            name: 'help.gallery.sortName',
            text: 'help.gallery.sort',
          },
          {
            box: [240, 109, 1740, 24],
            name: 'help.gallery.categoriesName',
            text: 'help.gallery.categories',
          },
          {
            box: [240, 149, 211, 229],
            icon: [248, 254, 20, 20],
            name: 'help.gallery.cardName',
            text: 'help.gallery.card',
          },
          {
            box: [1880, 61, 100, 32],
            icon: [1888, 67, 20, 20],
            name: 'plus.gallery.mine',
            text: 'help.gallery.mine',
          },
          {
            box: [1844, 2, 66, 32],
            icon: [1852, 8, 20, 20],
            name: 'wallpaper.manage',
            text: 'help.gallery.manage',
          },
          {
            box: [1917, 2, 63, 32],
            icon: [1925, 8, 20, 20],
            name: 'wallpaper.stopAll',
            text: 'help.gallery.stop',
          },
        ],
      },
      {
        image: '26-plus-scene.png',
        width: 1984,
        height: 1182,
        caption: 'help.gallery.sceneCaption',
        controls: [
          {
            box: [1689, 280, 266, 32],
            icon: [1697, 286, 20, 20],
            name: 'plus.scene.play',
            text: 'help.gallery.play',
          },
          {
            box: [1689, 355, 266, 32],
            icon: [1697, 361, 20, 20],
            name: 'wallpaper.action',
            text: 'help.gallery.desktop',
          },
          {
            box: [1689, 414, 266, 32],
            icon: [1697, 420, 20, 20],
            name: 'plus.inspect.open',
            text: 'help.gallery.inspect',
          },
          {
            box: [240, 61, 58, 24],
            name: 'plus.scene.back',
            text: 'help.gallery.back',
          },
        ],
      },
    ],
  },
  {
    id: 'leaderboard',
    group: 'plus',
    figures: [
      {
        image: '28-plus-leaderboard.png',
        width: 1984,
        height: 1182,
        controls: [
          {
            box: [240, 62, 142, 27],
            icon: [248, 66, 20, 20],
            name: 'help.leaderboard.periodName',
            text: 'help.leaderboard.period',
          },
          {
            box: [385, 123, 1246, 85],
            icon: [393, 156, 20, 20],
            name: 'leaderboard.hero.title',
            text: 'help.leaderboard.standing',
          },
          {
            box: [1687, 123, 270, 32],
            icon: [1695, 129, 20, 20],
            name: 'leaderboard.guide.title',
            text: 'help.leaderboard.earn',
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
        image: '31-plus-studio.png',
        width: 1984,
        height: 1182,
        controls: [
          {
            box: [240, 60, 330, 30],
            icon: [248, 65, 20, 20],
            name: 'studio.project.label',
            text: 'help.studio.project',
          },
          {
            box: [240, 110, 1460, 632],
            icon: [248, 416, 20, 20],
            name: 'help.studio.stageName',
            text: 'help.studio.stage',
          },
          {
            box: [253, 1117, 1313, 19],
            name: 'studio.code.title',
            text: 'help.studio.code',
          },
          {
            box: [1724, 110, 248, 215],
            icon: [1732, 208, 20, 20],
            name: 'studio.meters.title',
            text: 'help.studio.hears',
          },
          {
            box: [1737, 283, 222, 30],
            icon: [1745, 288, 20, 20],
            name: 'studio.signals.title',
            text: 'help.studio.signals',
          },
          {
            box: [1737, 397, 222, 60],
            icon: [1745, 417, 20, 20],
            name: 'studio.size.title',
            text: 'help.studio.size',
          },
          {
            box: [1737, 998, 222, 157],
            icon: [1745, 1067, 20, 20],
            name: 'studio.wave.title',
            text: 'help.studio.wave',
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
        image: '27-desktop-dialog.png',
        width: 580,
        height: 567,
        controls: [
          {
            box: [445, 109, 110, 32],
            icon: [453, 115, 20, 20],
            name: 'wallpaper.monitors',
            text: 'help.desktop.monitors',
          },
          {
            box: [25, 352, 261, 71],
            icon: [33, 378, 20, 20],
            name: 'wallpaper.motion.music',
            text: 'help.desktop.music',
          },
          {
            box: [294, 352, 261, 71],
            icon: [302, 378, 20, 20],
            name: 'wallpaper.motion.calm',
            text: 'help.desktop.calm',
          },
          {
            box: [500, 455, 42, 24],
            name: 'wallpaper.pauseOnBattery',
            text: 'help.desktop.battery',
          },
          {
            box: [448, 511, 107, 32],
            icon: [456, 517, 20, 20],
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
        image: '29-plus-lighting.png',
        width: 1984,
        height: 1182,
        controls: [
          {
            box: [240, 61, 38, 22],
            name: 'lighting.switch',
            text: 'help.lighting.switch',
          },
          {
            box: [240, 170, 1732, 432],
            icon: [248, 376, 20, 20],
            name: 'help.lighting.previewName',
            text: 'help.lighting.preview',
          },
          {
            box: [240, 618, 1014, 497],
            icon: [248, 857, 20, 20],
            name: 'lighting.devices.title',
            text: 'help.lighting.devices',
          },
          {
            box: [1283, 630, 615, 43],
            icon: [1291, 642, 20, 20],
            name: 'lighting.tuning.title',
            text: 'help.lighting.style',
          },
          {
            box: [1837, 111, 120, 32],
            icon: [1845, 117, 20, 20],
            name: 'lighting.pickScene',
            text: 'help.lighting.browse',
          },
          {
            box: [1161, 630, 80, 32],
            icon: [1169, 636, 20, 20],
            name: 'lighting.target.all',
            text: 'help.lighting.all',
          },
        ],
      },
    ],
  },
  {
    id: 'online',
    group: 'listen',
    figures: [{ image: '01-online-media-youtube-live-eq.png', ...WINDOW }],
  },
  {
    id: 'library',
    group: 'listen',
    figures: [{ image: '08-library-artists-and-up-next.png', ...WINDOW }],
  },
  {
    id: 'queue',
    group: 'listen',
    figures: [{ image: '09-library-album-and-play-queue.png', ...WINDOW }],
  },
  {
    id: 'karaoke',
    group: 'listen',
    figures: [{ image: '11-karaoke-player.png', ...WINDOW }],
  },
  {
    id: 'maker',
    group: 'listen',
    figures: [{ image: '12-karaoke-maker-pitch-and-lyrics.png', ...WINDOW }],
  },
  {
    id: 'share',
    group: 'listen',
    figures: [{ image: '14-share-audio-roles.png', width: 1976, height: 410 }],
  },
  {
    id: 'trouble',
    group: 'help',
    figures: [{ image: '06-eq-equalizer-apo-config.png', ...WINDOW }],
  },
  {
    id: 'forum',
    group: 'help',
    figures: [{ image: '30-forum.png', width: 2016, height: 1305 }],
  },
] as const satisfies readonly IHelpChapter[];

export type HelpChapterId = (typeof CHAPTERS)[number]['id'];

/** Every capture the guide shows, once. */
export type THelpImage = (typeof CHAPTERS)[number]['figures'][number]['image'];

/**
 * The chapters, read as chapters. The literal list above keeps the ids and
 * file names exact; read through it directly, a figure without a caption or
 * controls has no such property at all rather than an optional one.
 */
export const HELP_CHAPTERS: readonly IHelpChapter<HelpChapterId, THelpImage>[] =
  CHAPTERS;
