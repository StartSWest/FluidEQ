/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { ANIMATION_NAME } from '../../common/studioAnimation';
import { animatorChatKey } from '../../common/studioChat';
import type { TAgentProject } from '../studioAgent/agentProject';

/**
 * The chat an action is on: the open project's own, or one of its
 * animations' animators - the same folder, a key of its own
 * (`animatorChatKey`). Only ever the open project's: a chat is never reached
 * for a project the member is not on.
 */
export interface IChatTarget {
  key: string;
  folder: string;
}

/** What the window sent, read for one field. */
const field = (raw: unknown, name: string): unknown =>
  typeof raw === 'object' && raw !== null
    ? (raw as Record<string, unknown>)[name]
    : undefined;

export const createChatTargets = (agentProject: () => TAgentProject) => {
  /** The open project's own chat, the scene's. */
  const sceneChat = (): IChatTarget | undefined => {
    const project = agentProject();
    return project.ok ? { key: project.id, folder: project.folder } : undefined;
  };

  /**
   * An animation's animator in the open project, by the animation's name.
   * `inProject`, when a message says which project it was meant for - the
   * scene's chat starting an animator - must still be the open one: the
   * member may have opened another project since, and its animator is not
   * this one's.
   */
  const animatorChat = (
    name: unknown,
    inProject?: unknown,
  ): IChatTarget | undefined => {
    const project = agentProject();
    return project.ok &&
      typeof name === 'string' &&
      ANIMATION_NAME.test(name) &&
      (inProject === undefined || inProject === project.id)
      ? { key: animatorChatKey(project.id, name), folder: project.folder }
      : undefined;
  };

  /** The animator a message from the window names, and the project it says. */
  const animatorOf = (raw: unknown) =>
    animatorChat(field(raw, 'animation'), field(raw, 'projectId'));

  return { sceneChat, animatorChat, animatorOf };
};
