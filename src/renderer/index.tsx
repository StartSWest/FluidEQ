/*
<AQUA: System-wide parametric audio equalizer interface>
Copyright (C) <2023>  <AQUA Dev Team>
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

// First, before anything that imports a stylesheet of its own: this is the
// order the whole window's CSS cascades in, and only the first import of a
// sheet places it. See the file.
import './styles/cascade';
import { createRoot } from 'react-dom/client';
import { RENDERER_READY_EVENT } from 'common/constants';
import { PRODUCT_NAME } from 'common/branding';
import { loadLocale } from 'common/i18n';
import App from './App';
import ErrorBoundary from './ErrorBoundary';
import { installGlobalErrorHandlers, reportError } from './utils/logger';
import installTooltipLayer from './utils/tooltipLayer';
import { readInitialLocale } from './utils/I18nContext';
import { preloadLaunchPages } from './workspacePages';

// The window title, which `index.ejs` also carries so that something sensible
// is on the taskbar before any JavaScript runs. Set again from branding
// because the title is not only cosmetic: main matches on it when it has to
// pick this window out of the list of capturable sources, so a rename that
// changed one and not the other would break the loopback capture quietly.
document.title = PRODUCT_NAME;

// Which system draws the window's corner, its rim and its buttons — a Mac
// does all three itself (`App.scss`, "on a Mac"). Before the first render, so
// no frame is ever drawn in the other system's clothes.
document.documentElement.dataset.platform = window.electron?.platform ?? '';

// Before anything renders, so a throw while building the first tree is caught
// as well. The boundary below only sees failures inside React's own render;
// these two cover the timers, the frame loops and the promises that make up
// most of what actually goes wrong at runtime.
installGlobalErrorHandlers();

// Ctrl+wheel is Chromium's page zoom, and in a desktop app that reads as a
// malfunction: the entire UI scales, nothing announces why, and undoing it is
// not obvious. The Maker's canvas has its own Ctrl+wheel timeline zoom and
// preventDefault of its own; everywhere else the browser default is refused.
// Capture-phase and non-passive, because that is the only registration
// Chromium lets cancel a wheel.
window.addEventListener(
  'wheel',
  (event) => {
    if (event.ctrlKey) {
      event.preventDefault();
    }
  },
  { capture: true, passive: false },
);

// Every `title` in the window is shown by the app's own tooltip rather than
// the system's (`utils/tooltipLayer.ts`).
installTooltipLayer();

const container = document.getElementById('root') as HTMLElement;
const root = createRoot(container);

const start = () => {
  // Outermost on purpose. React tears down the whole tree when a render
  // throws, so without something above App a single bad frame leaves an empty
  // window with nothing on screen to explain it.
  root.render(
    <ErrorBoundary>
      <App />
    </ErrorBoundary>,
  );

  /**
   * Tell main the window is worth showing.
   *
   * Electron's `ready-to-show` fires as soon as Chromium has a first frame,
   * which for a React app is an empty root div — so the window appeared blank
   * and then filled in. This waits for the frame after React's first commit,
   * which is the first one with an interface in it.
   *
   * Two nested rAFs rather than one: the first runs before the browser paints
   * the commit, the second after it.
   */
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      window.electron.ipcRenderer.sendMessage(RENDERER_READY_EVENT, []);
    });
  });
};

// The language the window opens in is loaded before anything is drawn, so the
// first frame is already in it. English is in the bundle and resolves at once;
// any other is one local file of its own (`loadLocale`). A load that fails
// still starts the window, in English, rather than leaving it empty.
//
// The page it opens on likewise, alongside it: every page but the EQ's is a
// chunk of its own, and one drawn before its code arrived would leave the
// window's first frame empty where the page belongs. A page that cannot be
// fetched still starts the window; the failure is met again, and reported by
// the boundary below, only when that page is drawn.
Promise.all([
  loadLocale(readInitialLocale()).catch((error: unknown) => {
    reportError('Loading the interface language', error);
  }),
  preloadLaunchPages().catch((error: unknown) => {
    reportError('Loading the page the window opens on', error);
  }),
]).finally(start);
