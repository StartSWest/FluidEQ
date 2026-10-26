/** @jest-environment node */
/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import fs from 'fs';
import os from 'os';
import path from 'path';
import ts from 'typescript';
import type { IpcMainInvokeEvent, WebContents } from 'electron';
import { readGpuPreference, writeGpuPreference } from 'main/graphicsPreference';
import {
  registerSettingsResetIpc,
  SETTINGS_RESET_CHANNEL,
  type ISettingsResetDeps,
} from 'main/ipc/settingsReset';
import {
  readMotionPreference,
  writeMotionPreference,
} from 'main/motionPreference';

type THandler = (event: IpcMainInvokeEvent) => unknown;
const mockHandlers = new Map<string, THandler>();
const mockLogin = { openAtLogin: true, refuse: false };

jest.mock('electron', () => ({
  ipcMain: {
    handle: (channel: string, handler: THandler) =>
      mockHandlers.set(channel, handler),
    removeHandler: (channel: string) => mockHandlers.delete(channel),
  },
  app: {
    isPackaged: true,
    getAppPath: () => 'C:\\FluidEQ\\resources\\app.asar',
    getLoginItemSettings: () => ({
      openAtLogin: mockLogin.openAtLogin,
      executableWillLaunchAtLogin: mockLogin.openAtLogin,
    }),
    setLoginItemSettings: ({ openAtLogin }: { openAtLogin: boolean }) => {
      if (mockLogin.refuse) {
        throw new Error('Access is denied.');
      }
      mockLogin.openAtLogin = openAtLogin;
    },
  },
}));

const contents = () => ({ mainFrame: {} }) as unknown as WebContents;

/** A request from `sender`'s own page, or from a frame inside it. */
const askFrom = (sender: WebContents, fromInnerFrame = false) => {
  const handler = mockHandlers.get(SETTINGS_RESET_CHANNEL);
  if (!handler) {
    throw new Error('the reset channel was never registered');
  }
  return handler({
    sender,
    senderFrame: fromInnerFrame ? {} : sender.mainFrame,
  } as unknown as IpcMainInvokeEvent);
};

/**
 * "Reset all settings", main's half: every setting main keeps goes back to a
 * new install's, a part that fails does not stop the rest, and nobody but
 * FluidEQ's own window may ask.
 */
describe('resetting the settings main keeps', () => {
  let folder: string;
  let owner: WebContents;
  let deps: ISettingsResetDeps;
  let dispose: () => void;

  beforeEach(() => {
    folder = fs.mkdtempSync(path.join(os.tmpdir(), 'fluideq-reset-'));
    writeMotionPreference(folder, 'reduced');
    writeGpuPreference(folder, 'high');
    mockLogin.openAtLogin = true;
    mockLogin.refuse = false;
    owner = contents();
    deps = {
      userDataDir: folder,
      ownerContents: () => owner,
      resetDesktopBackgrounds: jest.fn(),
      resetLighting: jest.fn(),
      unpinWindow: jest.fn(),
      showGraph: jest.fn(),
      logger: { error: jest.fn() },
    };
    ({ dispose } = registerSettingsResetIpc(deps));
  });
  afterEach(() => {
    dispose();
    fs.rmSync(folder, { recursive: true, force: true });
  });

  it('puts every one of them back as a new install has it', () => {
    askFrom(owner);

    expect(readMotionPreference(folder)).toBe('full');
    expect(readGpuPreference(folder)).toBe('auto');
    expect(mockLogin.openAtLogin).toBe(false);
    expect(deps.resetDesktopBackgrounds).toHaveBeenCalledTimes(1);
    expect(deps.resetLighting).toHaveBeenCalledTimes(1);
    expect(deps.unpinWindow).toHaveBeenCalledTimes(1);
    // The graph's on/off switch, from the checklist (Ivan, 2026-10-26).
    expect(deps.showGraph).toHaveBeenCalledTimes(1);
    expect(deps.logger.error).not.toHaveBeenCalled();
  });

  it('resets the rest when Windows keeps the startup entry', () => {
    mockLogin.refuse = true;

    askFrom(owner);

    expect(mockLogin.openAtLogin).toBe(true);
    expect(deps.logger.error).toHaveBeenCalledWith(
      'Settings reset: could not reset the start with Windows',
      expect.any(Error),
    );
    expect(readMotionPreference(folder)).toBe('full');
    expect(deps.resetDesktopBackgrounds).toHaveBeenCalledTimes(1);
    expect(deps.unpinWindow).toHaveBeenCalledTimes(1);
  });

  it('resets the rest when one part throws', () => {
    jest.mocked(deps.resetDesktopBackgrounds).mockImplementation(() => {
      throw new Error('disposed');
    });

    askFrom(owner);

    expect(deps.logger.error).toHaveBeenCalledWith(
      'Settings reset: could not reset the desktop backgrounds',
      expect.any(Error),
    );
    expect(deps.resetLighting).toHaveBeenCalledTimes(1);
    expect(deps.unpinWindow).toHaveBeenCalledTimes(1);
  });

  it('answers nobody but FluidEQ’s own window', () => {
    expect(() => askFrom(contents())).toThrow(
      'Only FluidEQ resets its settings.',
    );
    expect(() => askFrom(owner, true)).toThrow(
      'Only FluidEQ resets its settings.',
    );

    expect(readMotionPreference(folder)).toBe('reduced');
    expect(readGpuPreference(folder)).toBe('high');
    expect(mockLogin.openAtLogin).toBe(true);
    expect(deps.resetDesktopBackgrounds).not.toHaveBeenCalled();
  });
});

/**
 * Every file main keeps in the app's data folder is a setting the reset puts
 * back, something it keeps on purpose, or not a remembered choice at all —
 * and a new one fails here until somebody decides which (Ivan, 2026-10-26:
 * "list all things we can reset"). The window's half of the same rule is
 * `renderer/settingsReset.test.ts`.
 */
const REPO = path.resolve(__dirname, '../../../..');

/** Put back by "Reset all settings" (`main/ipc/settingsReset.ts`). */
const RESET_FILES = [
  'graphics.json',
  'motion.json',
  'desktop-backgrounds.json',
  'lighting.json',
];

/** Kept on purpose, with why. */
const KEPT_FILES = [
  // The sound: every output's EQ, layers and rack, the band layouts, what
  // each song remembers, and the files the outputs' sound moved out of.
  'device-profiles.json',
  'band-designs.json',
  'song-eq.json',
  'song-levels.json',
  'song-sound.json',
  'output-design-profiles-v1.json',
  'output-dsp-profiles-v1.json',
  // The engine and the outputs.
  'audio-engine.json',
  'output-formats.json',
  'remote-audio-lan.json',
  'remote-audio-links.json',
  // Where the window stands, its size and mode: a window that jumps or
  // changes shape on a reset reads as something breaking (checklist).
  'window-state.json',
  // What the listener made or keeps.
  'library-index.json',
  'library-playlists.json',
  '.migrated.json',
  'karaoke-session.json',
  'studio.json',
  'studio-notes.json',
  'studio-agent.json',
  'my-curves.json',
  // The account, what it owns, and what it has agreed to or been told.
  'account.json',
  'entitlement.json',
  'scene-store.json',
  'version-pins.json',
  'publications.json',
  'catalogue.json',
  'rejected.json',
  'removed.json',
  'blocked.json',
  'terms-agreed.json',
  'plus-terms-notice.json',
  'scene-announcements-seen.json',
  'scene-review-notice.json',
  'forum-github.json',
  // The app's own bookkeeping, and the corrections it downloaded.
  'bug-report-mark.json',
  'unattended-update.json',
  'computer-id.json',
  'listening-ledger.json',
  'usage-ledger.json',
  'scene-plays.json',
  'opra-version.json',
  'index.json',
];

/** Named in the source and not a remembered choice of the app's. */
const NOT_SETTING_FILES = [
  // Inside a Studio project, a scene or a chat's own folder.
  'pack.json',
  'scene.json',
  'world.json',
  'framing.json',
  '.fluideq-scene.json',
  'chat.json',
  'codex.json',
  'limits.json',
  'meta.json',
  'fluideq-mcp.json',
  // Another program's sign-in, read where it keeps it.
  '.credentials.json',
  'auth.json',
  // Exports and project files the listener saves where they choose.
  'fluideq.json',
  'fluideq-dsp.json',
  'fluideq-karaoke.json',
];

const JSON_NAME = /^[\w.-]+\.json$/;

const sourceFiles = (dir: string): string[] =>
  fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      return entry.name === '__tests__' || entry.name === 'i18n'
        ? []
        : sourceFiles(full);
    }
    return /\.tsx?$/.test(entry.name) && !entry.name.endsWith('.d.ts')
      ? [full]
      : [];
  });

/** Every JSON file name main or the shared code writes out whole. */
const fileNamesInSource = (): Map<string, string> => {
  const names = new Map<string, string>();
  ['src/main', 'src/common']
    .flatMap((root) => sourceFiles(path.join(REPO, root)))
    .forEach((file) => {
      const source = ts.createSourceFile(
        file,
        fs.readFileSync(file, 'utf8'),
        ts.ScriptTarget.Latest,
        false,
      );
      const visit = (node: ts.Node) => {
        if (
          (ts.isStringLiteral(node) ||
            ts.isNoSubstitutionTemplateLiteral(node)) &&
          JSON_NAME.test(node.text) &&
          !names.has(node.text)
        ) {
          names.set(node.text, path.relative(REPO, file));
        }
        ts.forEachChild(node, visit);
      };
      visit(source);
    });
  return names;
};

describe('the files main keeps', () => {
  const names = fileNamesInSource();
  const listed = [...RESET_FILES, ...KEPT_FILES, ...NOT_SETTING_FILES];

  it('finds the files it is meant to judge', () => {
    // The positive control: a scan that read nothing would pass the rest.
    expect(names.get('motion.json')).toBe(
      path.join('src', 'main', 'motionPreference.ts'),
    );
    expect(names.has('audio-engine.json')).toBe(true);
  });

  it('knows whether every one of them is a setting', () => {
    const undecided = [...names.keys()].filter(
      (name) => !listed.includes(name),
    );
    expect(undecided.map((name) => `${name} (${names.get(name)})`)).toEqual([]);
  });

  it('puts each in one list only', () => {
    expect(
      listed.filter((name, index) => listed.indexOf(name) !== index),
    ).toEqual([]);
  });

  it('lists nothing the source no longer names', () => {
    expect(listed.filter((name) => !names.has(name))).toEqual([]);
  });
});
