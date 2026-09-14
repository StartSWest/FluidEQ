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
 * Device pixels per CSS pixel in the 1.7 captures. A capture is shown no
 * larger than it was on screen: drawn to the reading column's full width, the
 * band menu came out nearly three times its size and EQ mode 2,229px tall. The
 * 1.6 whole-window captures, at two, are wider than any column either way.
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

/** The 1.6 captures of the whole window. */
const WINDOW = { width: 2560, height: 1392 } as const;

/** A control whose picture is the control itself. */
const whole = (
  box: THelpBox,
  name: TranslationKey,
  text: TranslationKey,
  keys?: string,
): IHelpControl => ({ box, icon: box, name, text, keys });

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
    id: 'engine',
    group: 'start',
    figures: [
      {
        image: '15-engine-dialog.png',
        width: 978,
        height: 683,
        controls: [
          {
            box: [59, 146, 861, 189],
            name: 'engine.fluid.name',
            text: 'help.engine.fluid',
          },
          {
            box: [59, 341, 861, 186],
            name: 'engine.apo.name',
            text: 'help.engine.apo',
          },
          whole([833, 571, 87, 54], 'engine.apply', 'help.engine.apply'),
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
        width: 2058,
        height: 983,
        caption: 'help.eq.bandsCaption',
        controls: [
          whole([506, 130, 196, 54], 'voicing.quickLabel', 'help.eq.voicing'),
          whole([711, 130, 115, 54], 'eq.smart', 'help.eq.smart'),
          whole([871, 130, 137, 54], 'eq.clear', 'help.eq.clear'),
          whole([1018, 125, 206, 63], 'eq.mode', 'help.eq.mode'),
          whole([1233, 130, 148, 54], 'eq.addBand', 'help.eq.add'),
          whole([1390, 130, 162, 54], 'eq.quickLayouts', 'help.eq.layouts'),
          whole([954, 892, 81, 81], 'eq.frequency', 'help.eq.frequency'),
          whole([1062, 892, 81, 81], 'eq.gain', 'help.eq.gain'),
          whole([1170, 892, 81, 81], 'eq.quality', 'help.eq.q'),
          whole([1363, 901, 174, 63], 'eq.delete', 'help.eq.delete'),
        ],
      },
      {
        image: '17-band-menu.png',
        width: 351,
        height: 390,
        caption: 'help.eq.menuCaption',
        controls: [
          {
            box: [36, 133, 282, 51],
            icon: [48, 142, 33, 33],
            name: 'eq.menu.reset',
            text: 'help.eq.reset',
          },
          {
            box: [36, 185, 282, 51],
            icon: [48, 194, 33, 33],
            name: 'eq.menu.disable',
            text: 'help.eq.disable',
          },
          {
            box: [36, 253, 282, 51],
            icon: [48, 262, 33, 33],
            name: 'eq.menu.addLeft',
            text: 'help.eq.addLeft',
          },
          {
            box: [36, 305, 282, 51],
            icon: [48, 314, 33, 33],
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
        width: 672,
        height: 1500,
        caption: 'help.eqmode.modeCaption',
        controls: [
          {
            box: [66, 260, 540, 120],
            name: 'eq.mode.strength',
            text: 'help.eqmode.strength',
          },
          {
            box: [66, 392, 540, 120],
            name: 'eq.mode.q',
            text: 'help.eqmode.q',
          },
          {
            box: [66, 1080, 540, 120],
            name: 'eq.mode.smoothing',
            text: 'help.eqmode.smoothing',
          },
          {
            box: [66, 524, 540, 120],
            name: 'eq.mode.phase',
            text: 'help.eqmode.phase',
          },
          whole([521, 106, 110, 60], 'eq.mode.reset', 'help.eqmode.reset'),
        ],
      },
      {
        image: '19-band-designs.png',
        width: 537,
        height: 429,
        caption: 'help.eqmode.designsCaption',
        controls: [
          {
            box: [40, 133, 456, 111],
            name: 'eq.layouts.builtIn',
            text: 'help.eqmode.builtIn',
          },
          whole([324, 334, 172, 54], 'eq.layouts.saveNew', 'help.eqmode.save'),
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
        width: 2058,
        height: 915,
        controls: [
          {
            box: [24, 150, 300, 63],
            icon: [36, 159, 45, 45],
            name: 'dsp.normalizer.title',
            text: 'help.dsp.normalizer',
          },
          {
            box: [24, 219, 300, 63],
            icon: [36, 228, 45, 45],
            name: 'dsp.denoise.title',
            text: 'help.dsp.denoise',
          },
          {
            box: [24, 288, 300, 63],
            icon: [36, 297, 45, 45],
            name: 'dsp.exciter.title',
            text: 'help.dsp.exciter',
          },
          {
            box: [24, 357, 300, 63],
            icon: [36, 366, 45, 45],
            name: 'dsp.bassForge.title',
            text: 'help.dsp.bassForge',
          },
          {
            box: [24, 426, 300, 63],
            icon: [36, 435, 45, 45],
            name: 'dsp.eq.title',
            text: 'help.dsp.equaliser',
          },
          {
            box: [24, 495, 300, 63],
            icon: [36, 504, 45, 45],
            name: 'dsp.bassPunch.title',
            text: 'help.dsp.bassPunch',
          },
          {
            box: [24, 564, 300, 63],
            icon: [36, 573, 45, 45],
            name: 'dsp.dimension.title',
            text: 'help.dsp.dimension',
          },
          {
            box: [24, 633, 300, 63],
            icon: [36, 642, 45, 45],
            name: 'dsp.maximizer.title',
            text: 'help.dsp.maximizer',
          },
          {
            box: [24, 702, 300, 63],
            icon: [36, 711, 45, 45],
            name: 'dsp.master.title',
            text: 'help.dsp.master',
          },
          {
            box: [24, 827, 300, 63],
            icon: [36, 836, 45, 45],
            name: 'dsp.crossfade.title',
            text: 'help.dsp.crossfade',
          },
          whole([196, 26, 291, 54], 'dsp.presets', 'help.dsp.presets'),
          {
            box: [22, 88, 234, 30],
            name: 'help.dsp.scopeName',
            text: 'help.dsp.scope',
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
        width: 1067,
        height: 90,
        caption: 'help.graph.stripCaption',
        controls: [
          whole([36, 21, 127, 48], 'graph.liveOutput', 'help.graph.live'),
          whole(
            [172, 29, 30, 33],
            'graph.style.previous',
            'help.graph.previous',
            'Ctrl+Space',
          ),
          whole([211, 26, 297, 39], 'graph.picker.label', 'help.graph.picker'),
          whole(
            [517, 29, 30, 33],
            'graph.style.next',
            'help.graph.next',
            'Space',
          ),
          whole([556, 21, 144, 48], 'help.graph.autoName', 'help.graph.auto'),
          whole(
            [709, 29, 33, 33],
            'look.palette.cycle',
            'help.graph.colouring',
          ),
          whole([751, 21, 106, 48], 'graph.design.new', 'help.graph.newLook'),
          whole([866, 29, 33, 33], 'help.graph.bandsName', 'help.graph.bands'),
          whole(
            [908, 29, 33, 33],
            'help.graph.gridName',
            'help.graph.grid',
            'Ctrl+G',
          ),
          whole([950, 21, 89, 48], 'help.graph.viewName', 'help.graph.view'),
        ],
      },
      {
        image: '22-graph-strip-plus.png',
        width: 993,
        height: 90,
        caption: 'help.graph.plusCaption',
        controls: [
          whole([709, 29, 33, 33], 'help.graph.tintName', 'help.graph.tint'),
          whole([751, 29, 33, 33], 'lighting.title', 'help.graph.lighting'),
          whole([793, 29, 33, 33], 'wallpaper.action', 'help.graph.desktop'),
        ],
      },
      {
        image: '23-graph-view-menu.png',
        width: 372,
        height: 810,
        caption: 'help.graph.viewCaption',
        controls: [
          {
            box: [27, 77, 318, 43],
            icon: [34, 84, 29, 29],
            name: 'graph.view.expand',
            text: 'help.graph.expand',
            keys: 'Ctrl+S',
          },
          {
            box: [27, 119, 318, 43],
            icon: [34, 126, 29, 29],
            name: 'graph.view.fullscreen',
            text: 'help.graph.fullscreen',
            keys: 'Ctrl+F',
          },
          {
            box: [27, 176, 318, 43],
            icon: [34, 183, 29, 29],
            name: 'help.graph.showingName',
            text: 'help.graph.showing',
            keys: 'Ctrl+W',
          },
          {
            box: [27, 218, 318, 42],
            icon: [34, 225, 29, 29],
            name: 'help.graph.waveName',
            text: 'help.graph.wave',
          },
          {
            box: [27, 260, 318, 42],
            icon: [34, 267, 29, 29],
            name: 'help.graph.topWaveName',
            text: 'help.graph.topWave',
          },
          {
            box: [27, 302, 318, 43],
            icon: [34, 309, 29, 29],
            name: 'help.graph.gridName',
            text: 'help.graph.grid',
            keys: 'Ctrl+G',
          },
          {
            box: [27, 345, 318, 42],
            icon: [34, 352, 29, 29],
            name: 'help.graph.bandsName',
            text: 'help.graph.bandsMenu',
          },
          {
            box: [27, 387, 318, 42],
            icon: [34, 394, 29, 29],
            name: 'help.graph.meterName',
            text: 'help.graph.meter',
          },
          {
            box: [27, 429, 318, 36],
            icon: [34, 433, 29, 29],
            name: 'graph.waveHeight',
            text: 'help.graph.waveHeight',
          },
          {
            box: [27, 465, 318, 36],
            icon: [34, 469, 29, 29],
            name: 'graph.wavePosition',
            text: 'help.graph.wavePosition',
          },
          {
            box: [27, 515, 318, 43],
            icon: [34, 522, 29, 29],
            name: 'graph.style.next',
            text: 'help.graph.next',
            keys: 'Space',
          },
          {
            box: [27, 557, 318, 43],
            icon: [34, 564, 29, 29],
            name: 'graph.style.previous',
            text: 'help.graph.previous',
            keys: 'Ctrl+Space',
          },
          {
            box: [27, 614, 318, 36],
            icon: [34, 617, 29, 29],
            name: 'graph.scene.attack',
            text: 'help.graph.attack',
          },
          {
            box: [27, 650, 318, 36],
            icon: [34, 653, 29, 29],
            name: 'graph.scene.release',
            text: 'help.graph.release',
          },
          {
            box: [27, 686, 318, 42],
            icon: [34, 692, 29, 29],
            name: 'graph.scene.ownTiming',
            text: 'help.graph.ownTiming',
          },
          {
            box: [27, 741, 318, 42],
            icon: [34, 748, 29, 29],
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
        width: 1200,
        height: 870,
        controls: [
          {
            box: [13, 14, 1173, 54],
            name: 'help.looks.searchName',
            text: 'help.looks.search',
          },
          {
            box: [25, 77, 472, 26],
            name: 'graph.picker.styles',
            text: 'help.looks.styles',
          },
          {
            box: [25, 108, 472, 77],
            name: 'help.looks.familiesName',
            text: 'help.looks.families',
          },
          {
            box: [516, 77, 658, 31],
            name: 'graph.picker.plus',
            text: 'help.looks.plus',
          },
          {
            box: [516, 114, 658, 38],
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
        width: 2072,
        height: 642,
        controls: [
          {
            box: [39, 111, 333, 69],
            icon: [48, 116, 46, 46],
            name: 'leaderboard.title',
            text: 'help.plus.leaderboard',
          },
          {
            box: [39, 177, 333, 69],
            icon: [48, 182, 46, 46],
            name: 'plus.visualizers.title',
            text: 'help.plus.visualizers',
          },
          {
            box: [39, 243, 333, 69],
            icon: [48, 248, 46, 46],
            name: 'studio.title',
            text: 'help.plus.studio',
          },
          {
            box: [39, 309, 333, 69],
            icon: [48, 314, 46, 46],
            name: 'lighting.title',
            text: 'help.plus.lighting',
          },
          whole([48, 54, 48, 48], 'plus.rail.collapse', 'help.plus.fold'),
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
        width: 2072,
        height: 642,
        controls: [
          {
            box: [440, 135, 422, 47],
            name: 'plus.gallery.search',
            text: 'help.gallery.search',
          },
          {
            box: [888, 140, 306, 38],
            name: 'help.gallery.sortName',
            text: 'help.gallery.sort',
          },
          {
            box: [392, 204, 996, 42],
            name: 'help.gallery.categoriesName',
            text: 'help.gallery.categories',
          },
          whole([1892, 132, 156, 54], 'plus.gallery.mine', 'help.gallery.mine'),
          {
            box: [392, 264, 326, 355],
            name: 'help.gallery.cardName',
            text: 'help.gallery.card',
          },
          whole([1837, 44, 105, 54], 'wallpaper.manage', 'help.gallery.manage'),
          whole([1947, 44, 100, 54], 'wallpaper.stopAll', 'help.gallery.stop'),
        ],
      },
      {
        image: '26-plus-scene.png',
        width: 1691,
        height: 753,
        caption: 'help.gallery.sceneCaption',
        controls: [
          whole([21, 21, 94, 42], 'plus.scene.back', 'help.gallery.back'),
          whole(
            [1106, 366, 66, 66],
            'help.gallery.stepName',
            'help.gallery.step',
            '← →',
          ),
          {
            box: [1235, 352, 405, 54],
            name: 'plus.scene.play',
            text: 'help.gallery.play',
          },
          {
            box: [1235, 464, 405, 54],
            name: 'wallpaper.action',
            text: 'help.gallery.desktop',
          },
          {
            box: [1235, 553, 405, 54],
            name: 'plus.inspect.open',
            text: 'help.gallery.inspect',
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
        width: 1662,
        height: 1193,
        controls: [
          {
            box: [8, 95, 210, 38],
            name: 'help.leaderboard.periodName',
            text: 'help.leaderboard.period',
          },
          {
            box: [3, 159, 1170, 180],
            name: 'leaderboard.hero.title',
            text: 'help.leaderboard.standing',
          },
          {
            box: [1214, 182, 411, 55],
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
        width: 1662,
        height: 1383,
        controls: [
          {
            box: [3, 87, 501, 51],
            name: 'studio.project.label',
            text: 'help.studio.project',
          },
          whole(
            [506, 87, 104, 51],
            'help.studio.switchName',
            'help.studio.switch',
          ),
          {
            box: [3, 160, 1235, 520],
            name: 'help.studio.stageName',
            text: 'help.studio.stage',
          },
          {
            box: [23, 706, 1016, 35],
            name: 'studio.code.title',
            text: 'help.studio.code',
          },
          whole(
            [83, 1290, 200, 54],
            'studio.action.copyPrompt',
            'help.studio.prompt',
          ),
          {
            box: [1269, 162, 378, 329],
            name: 'studio.meters.title',
            text: 'help.studio.hears',
          },
          {
            box: [1289, 515, 339, 25],
            name: 'studio.signals.title',
            text: 'help.studio.signals',
          },
          {
            box: [1289, 918, 339, 25],
            name: 'studio.size.title',
            text: 'help.studio.size',
          },
          {
            box: [1289, 1037, 339, 25],
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
        width: 918,
        height: 981,
        controls: [
          {
            box: [229, 270, 460, 285],
            name: 'wallpaper.monitors',
            text: 'help.desktop.monitors',
          },
          {
            box: [62, 632, 391, 106],
            name: 'wallpaper.motion.music',
            text: 'help.desktop.music',
          },
          {
            box: [466, 632, 390, 106],
            name: 'wallpaper.motion.calm',
            text: 'help.desktop.calm',
          },
          {
            box: [62, 763, 794, 83],
            name: 'wallpaper.pauseOnBattery',
            text: 'help.desktop.battery',
          },
          whole([693, 868, 167, 54], 'wallpaper.start', 'help.desktop.start'),
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
        width: 1662,
        height: 1305,
        controls: [
          {
            box: [3, 89, 435, 39],
            icon: [3, 89, 72, 39],
            name: 'lighting.switch',
            text: 'help.lighting.switch',
          },
          whole(
            [1438, 164, 187, 54],
            'lighting.pickScene',
            'help.lighting.browse',
          ),
          {
            box: [6, 258, 1635, 645],
            name: 'help.lighting.previewName',
            text: 'help.lighting.preview',
          },
          {
            box: [23, 957, 126, 25],
            name: 'lighting.devices.title',
            text: 'help.lighting.devices',
          },
          whole(
            [809, 942, 125, 54],
            'lighting.target.all',
            'help.lighting.all',
          ),
          {
            box: [991, 953, 142, 25],
            name: 'lighting.tuning.title',
            text: 'help.lighting.style',
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
