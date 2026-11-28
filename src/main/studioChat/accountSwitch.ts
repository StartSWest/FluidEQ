/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import type { TWatchFolder } from './claudeModels';

interface IAccountSwitchDeps {
  /**
   * Who is signed in to Claude Code now, as one key per account
   * (`signedInAccount`), or undefined when it gave no answer that can be
   * read - which says nothing about who is signed in.
   */
  who: () => Promise<string | undefined>;
  /** Claude Code's config folder, and the sign-in file it writes there. */
  folder: () => string;
  file: string;
  watch: TWatchFolder;
  /** The account signed in is another than the one the chats started on. */
  switched: () => void;
}

/**
 * The Claude account signed in, followed so a switch reaches the Studio's
 * chats: a chat's Claude Code is kept running between messages, and a
 * running Claude Code keeps the sign-in it started with, so after "Use
 * another account" - or `claude auth login` in a terminal - the next message
 * of an open chat ran on, and spent, the account just left (2026-11-28: Ivan
 * switched because one account had reached its weekly limit, and the first
 * message after the switch met that same limit).
 *
 * Heard from Claude Code's sign-in file changing, and from FluidEQ's own
 * sign-in having landed (`check`, for a keychain that writes no file); each
 * asks who is signed in, one question at a time, and a change heard during
 * one asks once more after it. Only another account counts: every other
 * Claude Code session on the machine rewrites the same file whenever it
 * renews its own sign-in (`signInWindow.ts`).
 *
 * Followed only from the first chat on (`follow`): before a chat runs there
 * is nothing a switch could leave behind. A change heard before the first
 * answer has said who the chats started on is counted as a switch, because
 * that answer may already be the new account's, and a chat left on the old
 * one is the bug this exists for; the price is one needless restart of the
 * chats when a renewal lands in that second.
 */
const createAccountSwitch = ({
  who,
  folder,
  file,
  watch,
  switched,
}: IAccountSwitchDeps) => {
  let stop: (() => void) | undefined;
  let following = false;
  /** Who the chats started on, as last answered. */
  let known: string | undefined;
  /** A change was heard before anyone was known. */
  let unsure = false;
  let asking = false;
  let again = false;

  const ask = async (): Promise<void> => {
    if (asking) {
      again = true;
      return;
    }
    asking = true;
    again = false;
    const now = await who().catch(() => undefined);
    asking = false;
    if (now !== undefined) {
      const before = known;
      known = now;
      if (before === undefined ? unsure : before !== now) {
        unsure = false;
        switched();
      }
    }
    if (again && following) {
      await ask();
    }
  };

  const heard = () => {
    if (known === undefined) {
      unsure = true;
    }
    ask().catch(() => undefined);
  };

  return {
    /** A chat runs: from now on a switch of account is followed. */
    follow: () => {
      if (following) {
        return;
      }
      following = true;
      stop = watch(folder(), (name) => {
        if (name === file) {
          heard();
        }
      });
      ask().catch(() => undefined);
    },
    /** FluidEQ's own sign-in landed, maybe as somebody else. */
    check: () => {
      if (following) {
        heard();
      }
    },
    dispose: () => {
      following = false;
      stop?.();
      stop = undefined;
    },
  };
};

export type TAccountSwitch = ReturnType<typeof createAccountSwitch>;

export default createAccountSwitch;
