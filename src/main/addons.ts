/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import type { BrowserWindow } from 'electron';
import type { IAccountConfig } from '../common/accountConfig';
import type { TSceneStoreOutcome } from '../common/sceneStore';
import type { IAccountSession } from './account/session';
import type { IGalleryAccess } from './plus/galleryAccess';

/**
 * The main process's slot for an add-on: code a developer keeps in their own
 * checkout (`addons/<name>/main`) and never ships.
 *
 * Nothing here knows any add-on. `dev-main.cjs` requires each add-on's main
 * entry before the app starts, in development only, and the entry calls
 * `registerMainAddon`; a packaged build bundles `main.ts`, which never names
 * one, so an add-on cannot reach a release however the machine that built it
 * is set up. With none registered, `startMainAddons` starts nothing.
 *
 * An add-on's channels are named `addon:<name>-…` and reach the window only
 * through the preload's `addon` bridge, which passes that prefix and nothing
 * else.
 */

export interface IMainAddonServices {
  getMainWindow: () => BrowserWindow | null;
  userDataDir: string;
  config: IAccountConfig;
  session: IAccountSession;
  access: IGalleryAccess;
  /** Signing in and out, and the membership changing. */
  onAccountChange: (listener: () => void) => () => void;
  openExternal: (url: string) => boolean;
  /** What the app holds that an add-on's work can make stale. */
  refresh: {
    store: () => Promise<TSceneStoreOutcome>;
    blockList: () => Promise<void>;
    gallery: () => Promise<void>;
    reviewNews: () => Promise<void>;
    announcements: (reason: string) => Promise<void>;
  };
  logger: {
    warn(message: string, ...details: unknown[]): void;
    error(message: string, ...details: unknown[]): void;
  };
}

export interface IMainAddon {
  /** Somebody is back at the computer: ask whatever is due. */
  refreshIfDue?: (reason: string) => Promise<void>;
  dispose: () => void;
}

export type TMainAddonStart = (services: IMainAddonServices) => IMainAddon;

const starts = new Map<string, TMainAddonStart>();

/** Called by an add-on's main entry, once, as it is loaded. */
export const registerMainAddon = (name: string, start: TMainAddonStart) => {
  starts.set(name, start);
};

export interface IStartedAddons {
  refreshIfDue: (reason: string) => Promise<void>;
  dispose: () => void;
}

/** Starts every add-on registered; none, in any build that ships. */
export const startMainAddons = (
  services: IMainAddonServices,
): IStartedAddons => {
  const started = [...starts.entries()].flatMap(([name, start]) => {
    try {
      return [start(services)];
    } catch (error) {
      services.logger.error(`The ${name} add-on did not start`, error);
      return [];
    }
  });
  return {
    refreshIfDue: async (reason) => {
      await Promise.all(
        started.map((addon) => addon.refreshIfDue?.(reason) ?? undefined),
      );
    },
    dispose: () => started.forEach((addon) => addon.dispose()),
  };
};

/** For tests: no add-on between runs. */
export const resetMainAddons = () => starts.clear();
