/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * Whether Claude is answering in any project, from what each project's
 * entries say as they are told. Said only when it turns: a reply streams an
 * entry per word, and each of those is the same "busy" as the one before.
 */
const createChatBusy = (onBusy: ((isBusy: boolean) => void) | undefined) => {
  const busyProjects = new Set<string>();
  return (projectId: string, isBusy: boolean): void => {
    const wasBusy = busyProjects.size > 0;
    if (isBusy) {
      busyProjects.add(projectId);
    } else {
      busyProjects.delete(projectId);
    }
    if (wasBusy !== busyProjects.size > 0) {
      onBusy?.(!wasBusy);
    }
  };
};

export default createChatBusy;
