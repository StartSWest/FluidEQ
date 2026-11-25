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

export const FIGURES: readonly IFigureSpec[] = [
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
