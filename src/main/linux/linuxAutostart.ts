/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import fs from 'fs';
import os from 'os';
import path from 'path';
import { app } from 'electron';
import { PRODUCT_NAME } from '../../common/branding';
import type { IStartWithWindows } from '../startWithWindows';

/**
 * `startWithWindows.ts` for Linux: whether FluidEQ starts when this person
 * signs in.
 *
 * Electron has no login items on Linux. Every desktop that has a startup list
 * — GNOME, KDE, Xfce, Cinnamon, MATE — reads the XDG autostart folder,
 * `~/.config/autostart`, so the entry is a `.desktop` file there: this
 * person's own, written without a password. The desktops' own startup
 * settings switch an entry off by writing `Hidden=true` (the standard) or
 * `X-GNOME-Autostart-enabled=false` (GNOME) into that same file rather than
 * deleting it; FluidEQ may not overrule that, so the row says so instead, as
 * it says Windows' own Startup apps switch on Windows.
 */

const FILE_NAME = 'fluideq.desktop';

const autostartDir = (): string =>
  path.join(
    process.env.XDG_CONFIG_HOME || path.join(os.homedir(), '.config'),
    'autostart',
  );

const entryPath = (): string => path.join(autostartDir(), FILE_NAME);

/**
 * What to start. An AppImage runs from a temporary mount that is gone next
 * sign-in, so its entry names the AppImage file itself (`APPIMAGE`, set by
 * its runtime); the .deb's executable stays where it was installed. In
 * development `process.execPath` is Electron's own binary, which starts
 * nothing without the app's folder beside it.
 */
const command = (): string => {
  const quote = (part: string) => `"${part.replace(/(["`$\\])/g, '\\$1')}"`;
  if (process.env.APPIMAGE) {
    return quote(process.env.APPIMAGE);
  }
  return app.isPackaged
    ? quote(process.execPath)
    : `${quote(process.execPath)} ${quote(app.getAppPath())}`;
};

/** A desktop's own startup settings switched the entry off. */
const switchedOff = (text: string): boolean =>
  /^Hidden\s*=\s*true\s*$/im.test(text) ||
  /^X-GNOME-Autostart-enabled\s*=\s*false\s*$/im.test(text);

export const readLinuxAutostart = (): IStartWithWindows => {
  let text: string;
  try {
    text = fs.readFileSync(entryPath(), 'utf8');
  } catch {
    // No entry: nothing starts FluidEQ, and the row's switch is off.
    return { on: false, blockedByWindows: false };
  }
  return { on: true, blockedByWindows: switchedOff(text) };
};

export const writeLinuxAutostart = (wanted: boolean): void => {
  const target = entryPath();
  if (!wanted) {
    fs.rmSync(target, { force: true });
    return;
  }
  fs.mkdirSync(autostartDir(), { recursive: true });
  const text = [
    '[Desktop Entry]',
    'Type=Application',
    `Name=${PRODUCT_NAME}`,
    `Exec=${command()}`,
    'Icon=fluideq-app',
    'Terminal=false',
    'X-GNOME-Autostart-enabled=true',
    '',
  ].join('\n');
  // Beside it and renamed, so a desktop reading the folder at sign-in never
  // meets half an entry.
  const aside = `${target}.${process.pid}.tmp`;
  fs.writeFileSync(aside, text, 'utf8');
  fs.renameSync(aside, target);
};
