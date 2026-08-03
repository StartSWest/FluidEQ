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

import { ipcRenderer, IpcRendererEvent } from 'electron';

export type Channels = string;

const sendMessage = (channel: Channels, args: unknown[]) => {
  ipcRenderer.send(channel, args);
};

const on = (channel: Channels, func: (...args: unknown[]) => void) => {
  const subscription = (_event: IpcRendererEvent, ...args: unknown[]) =>
    func(...args);
  ipcRenderer.on(channel, subscription);

  return () => ipcRenderer.removeListener(channel, subscription);
};

const once = (channel: Channels, func: (...args: unknown[]) => void) => {
  ipcRenderer.once(channel, (_event, ...args) => func(...args));
};

const removeListener = (
  channel: Channels,
  func: (...args: unknown[]) => void,
) => {
  ipcRenderer.removeListener(channel, (_event, ...args) => func(...args));
};

const closeApp = () => {
  ipcRenderer.send('quit-app', []);
};

const openEqualizerApoConfigurator = () =>
  ipcRenderer.invoke('open-equalizer-apo-configurator') as Promise<string>;

const openEqualizerApoSettings = () =>
  ipcRenderer.invoke('open-equalizer-apo-settings') as Promise<string>;

const restartWindowsAudio = () =>
  ipcRenderer.invoke('restart-windows-audio') as Promise<string>;

const minimizeWindow = () =>
  ipcRenderer.invoke('window-minimize') as Promise<void>;

const toggleMaximizeWindow = () =>
  ipcRenderer.invoke('window-toggle-maximize') as Promise<boolean>;

const closeWindow = () => ipcRenderer.invoke('window-close') as Promise<void>;

const isWindowMaximized = () =>
  ipcRenderer.invoke('window-is-maximized') as Promise<boolean>;

export default {
  ipcRenderer: {
    sendMessage,
    on,
    once,
    removeListener,
    closeApp,
    openEqualizerApoConfigurator,
    openEqualizerApoSettings,
    restartWindowsAudio,
    minimizeWindow,
    toggleMaximizeWindow,
    closeWindow,
    isWindowMaximized,
  },
};
