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

import '@testing-library/jest-dom';
import { render } from '@testing-library/react';
import App from '../../renderer/App';
import { Channels } from '../../main/api';

describe('App', () => {
  beforeEach(() => {
    Object.defineProperty(window, 'electron', {
      configurable: true,
      // Mirrors the whole preload surface in src/main/api.ts. `on` must hand
      // back an unsubscribe function, and every window control is invoked as a
      // promise during the first render.
      get: () => ({
        ipcRenderer: {
          sendMessage: (_channel: Channels, _args: unknown[]) => {},
          on:
            (_channel: Channels, _func: (...args: unknown[]) => void) =>
            () => {},
          once: (_channel: Channels, _func: (...args: unknown[]) => void) => {},
          removeListener: (
            _channel: Channels,
            _func: (...args: unknown[]) => void,
          ) => {},
          closeApp: () => {},
          openEqualizerApoConfigurator: async () => '',
          openEqualizerApoSettings: async () => '',
          restartWindowsAudio: async () => '',
          minimizeWindow: async () => {},
          toggleMaximizeWindow: async () => false,
          closeWindow: async () => {},
          isWindowMaximized: async () => false,
        },
      }),
    });
  });

  it('should render', () => {
    expect(render(<App />)).toBeTruthy();
  });
});
