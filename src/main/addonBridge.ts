/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { ipcRenderer, type IpcRendererEvent } from 'electron';

/**
 * The window's way to an add-on's channels (`main/addons.ts`), and only to
 * those: a name that does not start `addon:` is refused here, before it is
 * sent, so this can never reach one of the app's own channels. In a build
 * with no add-on — every build that ships — no `addon:` channel has a
 * handler, and an invoke rejects as any unhandled one does.
 */
const ADDON_CHANNEL = /^addon:[a-z0-9][a-z0-9-]{0,80}$/;

export const isAddonChannel = (channel: unknown): channel is string =>
  typeof channel === 'string' && ADDON_CHANNEL.test(channel);

export const addonBridge = {
  addonInvoke: (channel: string, ...args: unknown[]): Promise<unknown> =>
    isAddonChannel(channel)
      ? ipcRenderer.invoke(channel, ...args)
      : Promise.reject(new Error(`${channel} is not an add-on channel`)),
  onAddon: (
    channel: string,
    listener: (...args: unknown[]) => void,
  ): (() => void) => {
    if (!isAddonChannel(channel)) {
      return () => undefined;
    }
    const subscription = (_event: IpcRendererEvent, ...args: unknown[]) =>
      listener(...args);
    ipcRenderer.on(channel, subscription);
    return () => ipcRenderer.removeListener(channel, subscription);
  },
};
