/** @jest-environment node */
/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * "Start when you sign in" on Linux: an entry in the XDG autostart folder.
 *
 * Electron has no login items on Linux, so the row was hidden there. These
 * pin the entry FluidEQ writes and reads back, against a scratch config
 * folder: what it starts (the AppImage file, not its temporary mount), that
 * turning it off removes it, and that a desktop's own startup settings
 * switching it off read as blocked — never as off, which would let the next
 * press write over a choice the desktop made.
 */

import fs from 'fs';
import os from 'os';
import path from 'path';

jest.mock('electron', () => ({
  app: {
    isPackaged: true,
    getAppPath: () => '/app',
  },
}));

/* eslint-disable import/first -- install the mock first */
import {
  moveLinuxAutostartIntoTray,
  readLinuxAutostart,
  writeLinuxAutostart,
} from '../../../main/linux/linuxAutostart';
/* eslint-enable import/first */

let config = '';
const saved = { xdg: process.env.XDG_CONFIG_HOME, image: process.env.APPIMAGE };
const entry = () => path.join(config, 'autostart', 'fluideq.desktop');

beforeEach(() => {
  config = fs.mkdtempSync(path.join(os.tmpdir(), 'fluideq-autostart-'));
  process.env.XDG_CONFIG_HOME = config;
  delete process.env.APPIMAGE;
});

afterEach(() => {
  fs.rmSync(config, { recursive: true, force: true });
  // Deleted rather than assigned when there was none: assigning undefined
  // to an environment variable stores the word "undefined".
  const restore = (name: 'XDG_CONFIG_HOME' | 'APPIMAGE', value?: string) => {
    if (value === undefined) {
      delete process.env[name];
    } else {
      process.env[name] = value;
    }
  };
  restore('XDG_CONFIG_HOME', saved.xdg);
  restore('APPIMAGE', saved.image);
});

describe('the Linux autostart entry', () => {
  it('is off until written', () => {
    expect(readLinuxAutostart()).toEqual({
      on: false,
      blockedByWindows: false,
    });
  });

  it('starts the installed program once switched on', () => {
    writeLinuxAutostart(true);
    const text = fs.readFileSync(entry(), 'utf8');
    expect(text).toContain('[Desktop Entry]');
    expect(text).toContain(`Exec="${process.execPath}"`);
    expect(readLinuxAutostart()).toEqual({ on: true, blockedByWindows: false });
    expect(fs.readdirSync(path.dirname(entry()))).toEqual(['fluideq.desktop']);
  });

  it('starts the AppImage file, not the folder it runs from', () => {
    process.env.APPIMAGE = '/home/me/Apps/FluidEQ $1.AppImage';
    writeLinuxAutostart(true);
    expect(fs.readFileSync(entry(), 'utf8')).toContain(
      'Exec="/home/me/Apps/FluidEQ \\$1.AppImage"',
    );
  });

  it('is gone once switched off', () => {
    writeLinuxAutostart(true);
    writeLinuxAutostart(false);
    expect(fs.existsSync(entry())).toBe(false);
    expect(readLinuxAutostart().on).toBe(false);
  });

  it('reads a desktop switching it off as blocked, not off', () => {
    writeLinuxAutostart(true);
    fs.appendFileSync(entry(), 'Hidden=true\n');
    expect(readLinuxAutostart()).toEqual({ on: true, blockedByWindows: true });

    writeLinuxAutostart(true);
    fs.writeFileSync(
      entry(),
      fs
        .readFileSync(entry(), 'utf8')
        .replace(
          'X-GNOME-Autostart-enabled=true',
          'X-GNOME-Autostart-enabled=false',
        ),
    );
    expect(readLinuxAutostart()).toEqual({ on: true, blockedByWindows: true });
  });

  it('asks the app to start in the tray', () => {
    writeLinuxAutostart(true);
    expect(fs.readFileSync(entry(), 'utf8')).toContain(
      `Exec="${process.execPath}" --start-in-tray`,
    );
  });
});

describe('moving an older Linux autostart entry into the tray', () => {
  // What every version before the tray's word wrote: this app, nothing else.
  const writeOld = (exec: string, extra = '') => {
    fs.mkdirSync(path.dirname(entry()), { recursive: true });
    fs.writeFileSync(
      entry(),
      [
        '[Desktop Entry]',
        'Type=Application',
        'Name=FluidEQ',
        `Exec=${exec}`,
        'Icon=fluideq-app',
        'Terminal=false',
        `X-GNOME-Autostart-enabled=true${extra}`,
        '',
      ].join('\n'),
    );
  };

  it('rewrites an entry that opens the window, as one that starts in the tray', () => {
    writeOld(`"${process.execPath}"`);
    expect(moveLinuxAutostartIntoTray()).toBe(true);
    const text = fs.readFileSync(entry(), 'utf8');
    expect(text).toContain(`Exec="${process.execPath}" --start-in-tray\n`);
    expect(text.match(/^Exec=/gm)).toHaveLength(1);
    expect(fs.readdirSync(path.dirname(entry()))).toEqual(['fluideq.desktop']);
  });

  it('keeps an entry the desktop switched off switched off', () => {
    writeOld(`"${process.execPath}"`, '\nHidden=true');
    expect(moveLinuxAutostartIntoTray()).toBe(true);
    expect(readLinuxAutostart()).toEqual({ on: true, blockedByWindows: true });
  });

  it('writes nothing when the entry already starts in the tray', () => {
    writeLinuxAutostart(true);
    const before = fs.readFileSync(entry(), 'utf8');
    expect(moveLinuxAutostartIntoTray()).toBe(false);
    expect(fs.readFileSync(entry(), 'utf8')).toBe(before);
  });

  it('leaves an entry that starts another copy of FluidEQ to that copy', () => {
    writeOld('"/home/me/Apps/FluidEQ-2.0.AppImage"');
    expect(moveLinuxAutostartIntoTray()).toBe(false);
    expect(fs.readFileSync(entry(), 'utf8')).toContain(
      'Exec="/home/me/Apps/FluidEQ-2.0.AppImage"\n',
    );
  });

  it('writes nothing for somebody who never asked to start with the desktop', () => {
    expect(moveLinuxAutostartIntoTray()).toBe(false);
    expect(fs.existsSync(entry())).toBe(false);
  });
});
