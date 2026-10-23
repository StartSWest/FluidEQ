/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import type { ChildProcess } from 'child_process';
import fs from 'fs';

interface ISignInWindow {
  /** The sign-in's own window: its end is the end of the sign-in. */
  child: ChildProcess;
  /** Where the tool keeps its sign-in, and the file it writes it to. */
  folder: string;
  file: string;
  /** Who is signed in now, or nothing for nobody: asked when the file changes. */
  who: () => Promise<string | undefined>;
  /** Who was signed in before the window opened. */
  before: string | undefined;
}

/**
 * A sign-in in a window of its own (Claude Code's, Codex's), over the moment
 * it lands rather than when its window is closed (Ivan, 2026-10-16: "after
 * signed in with claude it needs to auto refresh same for codex"): the tool
 * writes its sign-in to a file, and when that file changes and the tool
 * answers someone other than before, the chat goes on. A window that stays
 * open after a sign-in, or one the member leaves behind, no longer holds the
 * chat at "signed out".
 *
 * Someone other than before, not merely someone: other Claude Code sessions
 * on the same machine rewrite the same file whenever they renew their own
 * sign-in, and a member choosing "Use another account" is signed in already.
 * Where the tool keeps its sign-in in a keychain instead (macOS), nothing
 * changes in the folder and the window's end is the signal, as it always was.
 */
const untilSignedIn = ({ child, folder, file, who, before }: ISignInWindow) =>
  new Promise<void>((resolve) => {
    let watcher: fs.FSWatcher | undefined;
    let done = false;
    let asking = false;
    let again = false;
    const end = () => {
      if (!done) {
        done = true;
        watcher?.close();
        resolve();
      }
    };
    // One question at a time; a change while one is asked asks once more.
    const ask = async (): Promise<void> => {
      if (asking) {
        again = true;
        return;
      }
      asking = true;
      again = false;
      const now = await who().catch(() => undefined);
      asking = false;
      if (now !== undefined && now !== before) {
        end();
      } else if (again && !done) {
        await ask();
      }
    };
    try {
      watcher = fs.watch(folder, { persistent: false }, (_type, name) => {
        if (name === file) {
          ask().catch(() => undefined);
        }
      });
      watcher.on('error', () => watcher?.close());
    } catch {
      // No folder yet (never signed in on this machine): the window's end is
      // the signal.
    }
    child.on('error', end);
    child.on('close', end);
  });

export default untilSignedIn;
