/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import type { TAgentProject } from '../studioAgent/agentProject';

/**
 * The chat an action is on: the open project's own, the scene's - the only
 * chat a project has (the animations' own chats were taken out on
 * 2026-11-10). Only ever the open project's: a chat is never reached for a
 * project the member is not on.
 */
export interface IChatTarget {
  key: string;
  folder: string;
}

export const createChatTargets = (agentProject: () => TAgentProject) => {
  /** The open project's own chat, the scene's. */
  const sceneChat = (): IChatTarget | undefined => {
    const project = agentProject();
    return project.ok ? { key: project.id, folder: project.folder } : undefined;
  };

  return { sceneChat };
};
