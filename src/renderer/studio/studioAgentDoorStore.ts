import { useSyncExternalStore } from 'react';
import type { IStudioAgentDoor } from 'common/studioAgent';

/**
 * The Studio's agent door as the window last heard it from main
 * (`main/studioAgent/studioAgentDoor.ts`), shared by everything that shows
 * or opens it: the card with the switch (`StudioAgentLink`) and Copy AI
 * prompt (`StudioMaker`), which opens it for the prompt's own connection.
 * Each keeping its own copy, the card went on saying "off" over a door the
 * copy had just opened.
 */

let door: IStudioAgentDoor | undefined;
const listeners = new Set<() => void>();

const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};

const snapshot = () => door;

/** Main's answer, kept and told to every subscriber; nothing when none came. */
const adopt = async (
  answer: Promise<IStudioAgentDoor> | undefined,
): Promise<IStudioAgentDoor | undefined> => {
  const next = await answer;
  if (next) {
    door = next;
    listeners.forEach((listener) => listener());
  }
  return next;
};

const bridge = () => window.electron?.ipcRenderer;

export const useStudioAgentDoor = (): IStudioAgentDoor | undefined =>
  useSyncExternalStore(subscribe, snapshot, snapshot);

export const loadStudioAgentDoor = () =>
  adopt(bridge()?.getStudioAgentDoor?.());

export const setStudioAgentDoorOpen = (open: boolean) =>
  adopt(bridge()?.setStudioAgentDoor?.(open));

export const newStudioAgentDoorKey = () =>
  adopt(bridge()?.newStudioAgentKey?.());

/**
 * The door for the prompt about to be copied: opened unless the member
 * switched it off, which main decides and says.
 */
export const openStudioAgentDoorForPrompt = () =>
  adopt(bridge()?.openStudioAgentDoorForPrompt?.());

/** For tests: forget the door, as a new window does. */
export const resetStudioAgentDoorStore = () => {
  door = undefined;
};
