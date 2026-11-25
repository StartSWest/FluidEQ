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

/** Every step waits for the EQ page to be there first: its row of tabs,
 * which every tab of the page draws (the Tone editor shows only on its own
 * tab since the page became three tabs). */
const EQ_PAGE = `await until(() => $('.eq-layer-tabs'))`;

export const FIGURES: readonly IFigureSpec[] = [
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
