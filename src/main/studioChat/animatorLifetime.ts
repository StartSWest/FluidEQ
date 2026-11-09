/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { chatAnimationOf, chatProjectOf } from '../../common/studioChat';

/**
 * How many animators' Claude Codes stay running once they have finished.
 *
 * An animator's Claude Code stays up after its reply, for the next message's
 * prompt cache, until the app quits — and each is 350-400 MB (measured
 * 2026-11-09). The scene's chat may start three at once
 * (`MAX_ANIMATORS_AT_ONCE`), but a project with a dozen animals, or a note
 * planted in a shared project that waits for each animator to finish before
 * asking for the next, would leave a dozen of them standing.
 *
 * Past three in a project, or five on the machine (about 2 GB), the one used
 * longest ago is ended — never one in the middle of a reply. Its thread is
 * not lost: the chat keeps it on disk, and the next message to that animator
 * starts a Claude Code that resumes it, as a scene chat let go does.
 */
export const MAX_ANIMATORS_PER_PROJECT = 3;
export const MAX_ANIMATORS = 5;

/**
 * A project's animators among the chats with a Claude Code running, by
 * animation name, and of those the ones in the middle of a reply.
 */
export const animatorsIn = (
  projectId: string,
  running: readonly string[],
  isBusy: (key: string) => boolean,
): { live: string[]; working: string[] } => {
  const animators = running.flatMap((key) => {
    const name = chatAnimationOf(key);
    return name !== undefined && chatProjectOf(key) === projectId
      ? [{ key, name }]
      : [];
  });
  return {
    live: animators.map(({ name }) => name),
    working: animators.filter(({ key }) => isBusy(key)).map(({ name }) => name),
  };
};

export interface IRunningAnimator {
  key: string;
  project: string;
  /** In the middle of a reply, or about to begin one. */
  busy: boolean;
  /** When it was last given a message: larger is more recent. */
  used: number;
}

/** The animators to end, oldest first, so both limits hold again. */
export const idleAnimatorsToEnd = (
  animators: readonly IRunningAnimator[],
): string[] => {
  const ending: string[] = [];
  const endOldest = (among: readonly IRunningAnimator[], limit: number) => {
    const standing = among.filter(({ key }) => !ending.includes(key));
    standing
      .filter(({ busy }) => !busy)
      .sort((a, b) => a.used - b.used)
      .slice(0, Math.max(0, standing.length - limit))
      .forEach(({ key }) => ending.push(key));
  };
  [...new Set(animators.map(({ project }) => project))].forEach((project) =>
    endOldest(
      animators.filter((animator) => animator.project === project),
      MAX_ANIMATORS_PER_PROJECT,
    ),
  );
  endOldest(animators, MAX_ANIMATORS);
  return ending;
};

export interface IAnimatorLifetimeDeps {
  /** Every chat with a Claude Code running, scenes' and animators'. */
  running(): readonly string[];
  isBusy(key: string): boolean;
  /** Ends a chat's Claude Code; its thread stays on disk. */
  end(key: string): void;
}

export const createAnimatorLifetime = ({
  running,
  isBusy,
  end,
}: IAnimatorLifetimeDeps) => {
  let order = 0;
  const lastUsed = new Map<string, number>();
  return {
    /** A chat was given a message. */
    used: (key: string) => {
      order += 1;
      lastUsed.set(key, order);
    },
    /** Ends the idle animators past the limits; asked whenever a reply ends. */
    trim: () => {
      const animators = running().flatMap((key): IRunningAnimator[] =>
        chatAnimationOf(key) === undefined
          ? []
          : [
              {
                key,
                project: chatProjectOf(key),
                busy: isBusy(key),
                used: lastUsed.get(key) ?? 0,
              },
            ],
      );
      idleAnimatorsToEnd(animators).forEach((key) => {
        lastUsed.delete(key);
        end(key);
      });
    },
  };
};
