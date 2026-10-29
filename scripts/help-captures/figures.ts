/* Copyright (C) 2026 Ivan Carmenates Garcia. SPDX-License-Identifier: GPL-3.0-or-later */

import type { TranslationKey } from '../../src/common/i18n';

/**
 * The guide's figures this script takes, each as the steps that put the
 * window in the state the figure shows, what of the window it is cut to, and
 * the controls it numbers.
 *
 * Steps and finders are JavaScript run in the page with the helpers
 * `capture.ts` installs there: `$(css)`, `$$(css)`, `byText(root, words)`
 * (the innermost element under `root` whose own text starts with `words`),
 * `rowOf(element)` (its nearest menu row) and `union(...elements)`. A finder
 * returns one element or several; several are numbered as one box round
 * them all. The window runs in English, so finding by words finds the labels
 * the guide names.
 */

export interface IControlSpec {
  readonly find: string;
  readonly name: TranslationKey;
  readonly text: TranslationKey;
  readonly keys?: string;
}

export interface IFigureSpec {
  /** The file in `docs/`. */
  readonly image: string;
  readonly caption?: TranslationKey;
  /** The window's own settings, in storage before it starts. */
  readonly settings?: Record<string, unknown>;
  /** The window's size; the guide's is 2560 x 1392. */
  readonly viewport?: { readonly width: number; readonly height: number };
  /** In order, each awaited, each followed by the page settling. */
  readonly steps: readonly string[];
  /** What the picture is cut to: a finder, or the whole window. */
  readonly crop: string | 'window';
  /** Grown on every side by this many pixels, within the window. */
  readonly pad?: number;
  /** Blurred before the picture is taken: codes, addresses. */
  readonly blur?: string;
  readonly controls: readonly IControlSpec[];
}

/** Every step waits for the EQ page to be there first. */
const EQ_PAGE = `await until(() => $('.eq-flat-editor--tone'))`;

/** View → Show EQ labels, as somebody would turn them on. */
const SHOW_LABELS = [
  `click($('.graph-view-menu .graph-solo'))`,
  `click(rowOf(byText($('.graph-view-menu__list'), 'Show EQ labels')))`,
  `await until(() => $('.eq-band-label'))`,
];

/** The band whose label and fader are numbered: 1 kHz, mid-plot. */
const BAND = `$$('.bandWrapper')[5]`;

export const FIGURES: readonly IFigureSpec[] = [
  {
    image: '16-eq-bands.png',
    caption: 'help.eq.bandsCaption',
    steps: [EQ_PAGE, ...SHOW_LABELS],
    crop: `union($('.main-content-title'), $('.eq-flat-editor--tone'), $('.bands-rail'))`,
    pad: 12,
    controls: [
      {
        find: `$('.voicing-pick')`,
        name: 'dsp.presets',
        text: 'help.eq.voicing',
      },
      {
        find: `$('.eq-toolbar > .eq-mode:not(.quick-layouts):not(.active-layers__picker)')`,
        name: 'eq.smart',
        text: 'help.eq.smart',
      },
      { find: `$('.eq-mode-trigger')`, name: 'eq.mode', text: 'help.eq.mode' },
      {
        find: `$('.quick-layouts')`,
        name: 'eq.quickLayouts',
        text: 'help.eq.layouts',
      },
      {
        find: `$('.eq-toolbar__add')`,
        name: 'eq.addBand',
        text: 'help.eq.add',
      },
      {
        find: `$('.active-layers__picker')`,
        name: 'graph.curves',
        text: 'help.eq.layers',
      },
      {
        find: `$('.clear-eq-trigger')`,
        name: 'eq.clear',
        text: 'help.eq.clear',
      },
      {
        find: `$$('.eq-band-label')[5]`,
        name: 'help.eq.labelName',
        text: 'help.eq.label',
      },
      { find: BAND, name: 'help.eq.bandName', text: 'help.eq.band' },
      {
        find: `$$('.eq-flat-editor--tone .eq-flat-editor__control')[0]`,
        name: 'eq.tone.bass',
        text: 'help.eq.bass',
      },
      {
        find: `$$('.eq-flat-editor--tone .eq-flat-editor__control')[1]`,
        name: 'eq.tone.mid',
        text: 'help.eq.mid',
      },
      {
        find: `$$('.eq-flat-editor--tone .eq-flat-editor__control')[2]`,
        name: 'eq.tone.treble',
        text: 'help.eq.treble',
      },
    ],
  },
  {
    image: '36-eq-band-selected.png',
    caption: 'help.eq.bandCaption',
    steps: [
      EQ_PAGE,
      `click(${BAND}.querySelector('.band-frequency-caption'))`,
      `await until(() => $('.eq-flat-editor:not(.eq-flat-editor--tone)'))`,
    ],
    crop: `union($('.game-mode-switch').closest('.tabs, [role=tablist]') ?? $('.game-mode-switch'), $('.main-content-title'), $('.eq-flat-editor:not(.eq-flat-editor--tone)'), $('.bands-rail'))`,
    pad: 12,
    controls: [
      {
        find: `$('.game-mode-switch')`,
        name: 'dsp.latency.gameMode',
        text: 'help.eq.gameMode',
      },
      {
        find: `$('.eq-flat-editor:not(.eq-flat-editor--tone) .eq-flat-editor__identity')`,
        name: 'eq.selected',
        text: 'help.eq.selected',
      },
      {
        find: `$('.eq-flat-editor__control--wide')`,
        name: 'eq.filter',
        text: 'help.eq.filter',
      },
      {
        find: `$$('.eq-flat-editor:not(.eq-flat-editor--tone) .eq-flat-editor__control--centred')[0]`,
        name: 'eq.frequency',
        text: 'help.eq.frequency',
      },
      {
        find: `$$('.eq-flat-editor:not(.eq-flat-editor--tone) .eq-flat-editor__control--centred')[1]`,
        name: 'eq.gain',
        text: 'help.eq.gain',
      },
      {
        find: `$$('.eq-flat-editor:not(.eq-flat-editor--tone) .eq-flat-editor__control--centred')[2]`,
        name: 'eq.quality',
        text: 'help.eq.q',
      },
      {
        find: `$$('.eq-flat-editor:not(.eq-flat-editor--tone) .eq-flat-editor__control--centred')[3]`,
        name: 'eq.active',
        text: 'help.eq.disable',
      },
      {
        find: `$('.eq-flat-editor__delete')`,
        name: 'eq.delete',
        text: 'help.eq.delete',
      },
    ],
  },
  {
    // The card on its Corrections tab, which has every row Your EQ has and
    // Curve smoothing besides.
    image: '18-eq-mode.png',
    caption: 'help.eqmode.modeCaption',
    steps: [
      EQ_PAGE,
      `click($$('.eq-mode-card__group')[1])`,
      `await until(() => $$('.eq-mode-card__group')[1].getAttribute('aria-selected') === 'true')`,
    ],
    crop: `$('.eq-mode-card')`,
    pad: 8,
    controls: [
      {
        find: `$('.eq-mode-card__unpin')`,
        name: 'eq.mode.unpin',
        text: 'help.eqmode.pin',
      },
      {
        find: `$('.eq-mode-card__groups')`,
        name: 'help.eqmode.tabsName',
        text: 'help.eqmode.tabs',
      },
      ...(
        [
          ['strength', 'eq.mode.strength', 'help.eqmode.strength'],
          ['q', 'eq.mode.q', 'help.eqmode.q'],
          ['phase', 'eq.mode.phase', 'help.eqmode.phase'],
          ['treble', 'eq.mode.treble', 'help.eqmode.treble'],
          ['smoothing', 'eq.mode.smoothing', 'help.eqmode.smoothing'],
        ] as const
      ).map(([kind, name, text]) => ({
        find: `$('.eq-mode-card__rows:not([inert]) .eq-mode-choices__row--${kind}')`,
        name,
        text,
      })),
      {
        find: `$('.eq-mode-card__foot button')`,
        name: 'eq.mode.reset',
        text: 'help.eqmode.reset',
      },
    ],
  },
  {
    // The panel beside the EQ page, every card open but EQ mode's, which has
    // a figure of its own; a second output on, with its battery, its delay
    // and Edit sound.
    image: '40-rail-right.png',
    settings: { 'fluideq-mirror-target-guids': ['harness-wireless'] },
    steps: [
      EQ_PAGE,
      `click($('.eq-mode-card .sidebar-section__header'))`,
      `click($('.extra-outputs .sidebar-section__header'))`,
      `await until(() => $('.extra-outputs__list'))`,
      `await until(() => $('.extra-outputs__delay'))`,
    ],
    crop: `union(...$$('.right-content__scroll > *'))`,
    pad: 8,
    controls: [
      {
        find: `$('.eq-mode-card .sidebar-section__header')`,
        name: 'eq.mode',
        text: 'help.profiles.eqMode',
      },
      {
        find: `$('.device-profiles__device, .output-device, .device-picker') ?? byText($('.right-content__scroll'), 'Kraken V4 Pro').closest('button, [role=button], .select, div')`,
        name: 'output.device',
        text: 'help.profiles.output',
      },
      {
        find: `$$('.presets-bar__item, .profile-row').length ? $$('.presets-bar__item, .profile-row') : byText($('.right-content__scroll'), 'Evening').parentElement.parentElement`,
        name: 'profiles.title',
        text: 'help.profiles.list',
      },
      {
        find: `rowOf(byText($('.right-content__scroll'), 'New profile'))`,
        name: 'profiles.new',
        text: 'help.profiles.new',
      },
      {
        find: `rowOf(byText($('.right-content__scroll'), 'Update'))`,
        name: 'profiles.update',
        text: 'help.profiles.update',
      },
      {
        find: `$('#song-sound').closest('.extra-outputs__rule')`,
        name: 'songSound.switch',
        text: 'help.profiles.songSound',
      },
      {
        find: `$('#single-player').closest('.extra-outputs__rule')`,
        name: 'extraOutput.singlePlayer',
        text: 'help.profiles.onePlayer',
      },
      {
        find: `$('.extra-outputs__list')`,
        name: 'extraOutput.title',
        text: 'help.profiles.outputs',
      },
      {
        find: `$('.extra-outputs__list .output-edit-button')`,
        name: 'extraOutput.edit',
        text: 'help.profiles.editSound',
      },
      {
        find: `$('.driver-picker, .sidebar-section:last-child')`,
        name: 'driver.title',
        text: 'help.profiles.driver',
      },
    ],
  },
  {
    // A standard style on the graph, so the menu's last group is the one
    // standard styles have now: how they are drawn, apart from Plus.
    image: '23-graph-view-menu.png',
    caption: 'help.graph.viewCaption',
    steps: [
      EQ_PAGE,
      // Expanded, where the wave's height and position are offered: on the
      // EQ page's own plot they are only offered for a Plus visualizer.
      `click($('.graph-view-menu .graph-solo'))`,
      `click(rowOf(byText($('.graph-view-menu__list'), 'Expand view')))`,
      `await until(() => !$('.graph-view-menu__list'))`,
      `click($('.graph-view-menu .graph-solo'))`,
      `await until(() => $('.graph-view-menu__list'))`,
    ],
    crop: `$('.graph-view-menu__list')`,
    controls: [
      ...(
        [
          ['Expand view', 'graph.view.expand', 'help.graph.expand', 'Ctrl+S'],
          [
            'Full screen',
            'graph.view.fullscreen',
            'help.graph.fullscreen',
            'Ctrl+F',
          ],
          [
            'Showing:',
            'help.graph.showingName',
            'help.graph.showing',
            'Ctrl+W',
          ],
          ['Show EQ labels', 'graph.item.eqLabels', 'help.graph.labels'],
          ['Hide the wave', 'help.graph.waveName', 'help.graph.wave'],
          ['Hide top wave', 'help.graph.topWaveName', 'help.graph.topWave'],
          ['Hide grid', 'help.graph.gridName', 'help.graph.grid', 'Ctrl+G'],
          [
            'Hide listening bands',
            'help.graph.bandsName',
            'help.graph.bandsMenu',
          ],
          ['Hide level meter', 'help.graph.meterName', 'help.graph.meter'],
          ['Next style', 'graph.style.next', 'help.graph.next', 'Space'],
          [
            'Previous style',
            'graph.style.previous',
            'help.graph.previous',
            'Ctrl+Space',
          ],
        ] as const
      ).map(
        ([words, name, text, keys]: readonly [
          string,
          TranslationKey,
          TranslationKey,
          string?,
        ]) => ({
          find: `rowOf(byText($('.graph-view-menu__list'), ${JSON.stringify(words)}))`,
          name,
          text,
          ...(keys ? { keys } : {}),
        }),
      ),
      {
        find: `$('.graph-view-menu__slider:not(.graph-view-menu__slider--overlay)')`,
        name: 'graph.waveHeight',
        text: 'help.graph.waveHeight',
      },
      {
        find: `$$('.graph-view-menu__slider:not(.graph-view-menu__slider--overlay)')[1]`,
        name: 'graph.wavePosition',
        text: 'help.graph.wavePosition',
      },
      {
        // The group's heading and every row under it.
        find: `rowOf(byText($('.graph-view-menu__list'), 'How it is drawn')).parentElement`,
        name: 'settings.group.drawing',
        text: 'help.graph.drawing',
      },
    ],
  },
  {
    // Share Audio with one computer linked, as a group: this computer and the
    // one it links with, and Your mix beside them. The connection code now
    // lives in the Add computer dialog, which stays shut, so no code is in
    // the picture; any address the page shows is still blurred.
    image: '14-share-audio-roles.png',
    settings: {},
    steps: [
      `await until(() => $('.top-tabs, header'))`,
      `click(byText(document.body, 'Share Audio').closest('button, [role=tab], a'))`,
      `await until(() => $('.remote-audio__group'))`,
      `window.__harnessEmit('remote-audio-lan-signal', { peerId: 'harness-peer', signal: { kind: 'peer-ready', deviceName: 'Studio PC', address: '192.168.1.42', joined: false, computerId: 'harness-studio-pc' } })`,
      `await until(() => $('.remote-audio__group-row[aria-label="Studio PC"]'))`,
      // The other computer says what it does: sends its sound, plays ours.
      `window.__harnessEmit('remote-audio-lan-signal', { peerId: 'harness-peer', signal: { kind: 'stream-mode', mode: 'music', duplex: { sends: true, plays: true } } })`,
      `await until(() => byText($('.remote-audio__group-row[aria-label="Studio PC"]'), 'Nothing playing on Studio PC'))`,
    ],
    crop: 'window',
    blur: `.remote-audio__code-value, .remote-audio__link-name > span, [class*=address]`,
    controls: [],
  },
];
