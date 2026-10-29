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
import START_IN_TRAY_ARG from '../startInTray';
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
 * The app itself. An AppImage runs from a temporary mount that is gone next
 * sign-in, so its entry names the AppImage file itself (`APPIMAGE`, set by
 * its runtime); the .deb's executable stays where it was installed. In
 * development `process.execPath` is Electron's own binary, which starts
 * nothing without the app's folder beside it.
 */
const appLaunch = (): string => {
  const quote = (part: string) => `"${part.replace(/(["`$\\])/g, '\\$1')}"`;
  if (process.env.APPIMAGE) {
    return quote(process.env.APPIMAGE);
  }
  return app.isPackaged
    ? quote(process.execPath)
    : `${quote(process.execPath)} ${quote(app.getAppPath())}`;
};

/**
 * What to start: the app, told to start in the tray, as Windows' entry does.
 * Whether it then stays there is decided at launch, by whether this desktop
 * draws tray icons at all (`linuxTrayHost.ts`) — sign-in is when that is
 * known, not the moment the switch was turned on.
 */
const command = (): string => `${appLaunch()} ${START_IN_TRAY_ARG}`;

const EXEC_LINE = /^Exec\s*=(.*)$/m;

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

/**
 * Beside the entry and renamed, so a desktop reading the folder at sign-in
 * never meets half an entry.
 */
const writeEntry = (text: string): void => {
  const target = entryPath();
  const aside = `${target}.${process.pid}.tmp`;
  fs.writeFileSync(aside, text, 'utf8');
  fs.renameSync(aside, target);
};

export const writeLinuxAutostart = (wanted: boolean): void => {
  const target = entryPath();
  if (!wanted) {
    fs.rmSync(target, { force: true });
    return;
  }
  fs.mkdirSync(autostartDir(), { recursive: true });
  writeEntry(
    [
      '[Desktop Entry]',
      'Type=Application',
      `Name=${PRODUCT_NAME}`,
      `Exec=${command()}`,
      'Icon=fluideq-app',
      'Terminal=false',
      'X-GNOME-Autostart-enabled=true',
      '',
    ].join('\n'),
  );
};

/**
 * An entry written before the tray's word existed opens the window at every
 * sign-in. Run once at launch, this rewrites its `Exec` to the one that
 * starts in the tray and leaves every other line as it was — a desktop's own
 * switch (`Hidden`, `X-GNOME-Autostart-enabled`) included, so an entry
 * somebody switched off stays off. Only an entry that starts exactly this
 * app is moved, as on Windows: one written by another copy of FluidEQ (an
 * AppImage elsewhere, a development checkout) is that copy's to move.
 * Returns whether an entry was moved.
 */
export const moveLinuxAutostartIntoTray = (logger?: {
  info(message: string): void;
  error(message: string, ...details: unknown[]): void;
}): boolean => {
  let text: string;
  try {
    text = fs.readFileSync(entryPath(), 'utf8');
  } catch {
    // No entry: nobody asked to start with the desktop, so nothing to move.
    return false;
  }
  const exec = EXEC_LINE.exec(text);
  if (!exec || exec[1].trim() !== appLaunch()) {
    return false;
  }
  try {
    writeEntry(text.replace(EXEC_LINE, () => `Exec=${command()}`));
  } catch (error) {
    logger?.error(
      'Could not move the Linux autostart entry into the tray',
      error,
    );
    return false;
  }
  logger?.info('The Linux autostart entry now starts FluidEQ in the tray');
  return true;
};
