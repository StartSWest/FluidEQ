/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU General Public License as published by
the Free Software Foundation, either version 3 of the License, or
(at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
GNU General Public License for more details.

You should have received a copy of the GNU General Public License
along with this program.  If not, see <https://www.gnu.org/licenses/>.
*/

import { FC, Ref } from 'react';

// The `<webview>` tag as the Media tab uses it: the part of the element it
// calls, the attributes it sets, and the autoplay policy it declares.

/**
 * The part of `<webview>` this pane uses.
 *
 * Written out rather than imported from Electron's typings because those
 * describe the tag as it exists in a renderer with `webviewTag` on, and
 * importing them here would pull main-process types into the window bundle for
 * eight method signatures.
 */
export interface IWebview extends HTMLElement {
  canGoBack(): boolean;
  canGoForward(): boolean;
  goBack(): void;
  goForward(): void;
  reload(): void;
  stop(): void;
  getURL(): string;
  /** The guest document's own title — what the bar calls the page while the
   * Media tab is the one driving it. */
  getTitle(): string;
  loadURL(url: string): Promise<void>;
  /**
   * The second argument tells Chromium to treat the call as though the user had
   * done it, which is what a gesture-gated API like `requestFullscreen`
   * requires.
   *
   * Nothing here passes it, and that is a decision rather than an oversight: a
   * granted gesture is also a user activation on the guest, and the tag's
   * autoplay policy reads exactly that to decide whether the page may start
   * playing on its own. Anything that needs the flag later has to be sure it is
   * not also handing the page permission to make noise.
   */
  executeJavaScript(code: string, userGesture?: boolean): Promise<unknown>;
  /** Returns a key the stylesheet can be removed by. */
  insertCSS(css: string): Promise<string>;
  /**
   * A picture of what the guest is showing, for the bar at the foot of the
   * window.
   *
   * Typed by what is used rather than by importing Electron's `NativeImage`
   * into the renderer: this file already describes the tag it drives, and one
   * shape describing both is one place to look.
   */
  capturePage(): Promise<{
    isEmpty(): boolean;
    resize(options: { height: number }): { toDataURL(): string };
  }>;
  removeInsertedCSS(key: string): Promise<void>;
}

interface IWebviewProps {
  ref?: Ref<IWebview>;
  src: string;
  partition: string;
  /**
   * Whether the guest may open a window at all.
   *
   * A presence attribute, and one that is read when the tag attaches rather
   * than asked for later — which is why it has to be here and not only in the
   * main process. Without it `window.open` returns `null` before Chromium gets
   * as far as asking the window-open handler about the address, and every
   * sign-in that opens a window sees a popup blocker.
   *
   * A STRING, NOT A BOOLEAN, and the difference is whether it exists at all.
   * `webview` is a custom element as far as React is concerned, so it has no
   * idea `allowpopups` is a presence attribute; handed `true` it declines to
   * write anything and says so in a console warning. Written as `"true"` it
   * lands in the DOM, which is the only place Chromium looks.
   */
  allowpopups?: string;
  /** A comma-separated features string — see `VIDEO_WEB_PREFERENCES`. */
  webpreferences?: string;
  className?: string;
}

/**
 * React has no `webview` in its intrinsic elements, and React 19 moved the JSX
 * namespace such that adding one means augmenting a module. A cast keeps that
 * declaration here, next to the only place in the app that renders the tag,
 * instead of loose in a global .d.ts where it would advertise the element as
 * generally available.
 */
export const Webview = 'webview' as unknown as FC<IWebviewProps>;

/**
 * Nothing in the page may start playing until somebody in it has asked.
 *
 * This is the bug that opening the tab used to be: the pane mounts on first
 * visit, loads the page that was last open, and the site started playing it —
 * over the top of whatever the machine was already playing. Nothing in FluidEQ
 * called for that. The page did, because Electron let it: its default is
 * `no-user-gesture-required`, which is a browser's autoplay rules with the
 * brakes off, and a watch URL loaded under that policy plays on sight.
 *
 * `document-user-activation-required` rather than `user-gesture-required`. The
 * strict one wants a gesture per play, so the next track in a queue — or a
 * player picking itself back up after an ad — would need a press of its own,
 * and a music site would stop between songs. This one is sticky per document:
 * the first press anywhere in the page lifts it and everything after behaves
 * like an ordinary browser. A page that has just been loaded and not yet
 * touched has no activation at all, which is precisely the case in hand.
 *
 * Declared on the tag rather than in the main process on purpose. What the main
 * process imposes at attach is the sandbox — the preload, the partition, what
 * the guest is allowed to reach — and it leaves the rest of what the tag asked
 * for alone. Whether the player starts by itself is a decision about this pane,
 * so it is written where the pane is.
 */
export const VIDEO_WEB_PREFERENCES =
  'autoplayPolicy=document-user-activation-required';
