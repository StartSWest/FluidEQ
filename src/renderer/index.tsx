/*
<AQUA: System-wide parametric audio equalizer interface>
Copyright (C) <2023>  <AQUA Dev Team>

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

import { createRoot } from 'react-dom/client';
import { RENDERER_READY_EVENT } from 'common/constants';
import App from './App';
import ErrorBoundary from './ErrorBoundary';

const container = document.getElementById('root') as HTMLElement;
const root = createRoot(container);
// Outermost on purpose. React tears down the whole tree when a render throws,
// so without something above App a single bad frame leaves an empty window
// with nothing on screen to explain it.
root.render(
  <ErrorBoundary>
    <App />
  </ErrorBoundary>,
);

/**
 * Tell main the window is worth showing.
 *
 * Electron's `ready-to-show` fires as soon as Chromium has a first frame, which
 * for a React app is an empty root div — so the window appeared blank and then
 * filled in. This waits for the frame after React's first commit, which is the
 * first one with an interface in it.
 *
 * Two nested rAFs rather than one: the first runs before the browser paints the
 * commit, the second after it.
 */
requestAnimationFrame(() => {
  requestAnimationFrame(() => {
    window.electron.ipcRenderer.sendMessage(RENDERER_READY_EVENT, []);
  });
});
