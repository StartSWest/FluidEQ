import { ipcRenderer, type IpcRendererEvent } from 'electron';
import type {
  IStudioAgentDoor,
  IStudioAgentDrawAsk,
  IStudioAgentHearAsk,
  TStudioAgentDrawAnswer,
  TStudioAgentHeardAnswer,
} from '../common/studioAgent';

/**
 * The window's side of the Studio's agent door (`studioAgent/studioAgentDoor.ts`):
 * the card that opens and closes it, and the three things main asks of the
 * window when the member's AI calls — show the Studio on a project, draw a
 * scene, and say how the songs it heard move. Nothing here hands the page a
 * path or a way to open the door by itself: opening it is the member's
 * press, on the card's switch or on Copy AI prompt.
 */
export const studioAgentBridge = {
  getStudioAgentDoor: (): Promise<IStudioAgentDoor> =>
    ipcRenderer.invoke('studio-agent-door'),
  setStudioAgentDoor: (open: boolean): Promise<IStudioAgentDoor> =>
    ipcRenderer.invoke('studio-agent-door-set', open),
  /**
   * The door as the AI prompt needs it: opened for a member who has never
   * used the switch, left shut for one who switched it off (main decides).
   */
  openStudioAgentDoorForPrompt: (): Promise<IStudioAgentDoor> =>
    ipcRenderer.invoke('studio-agent-door-for-prompt'),
  newStudioAgentKey: (): Promise<IStudioAgentDoor> =>
    ipcRenderer.invoke('studio-agent-new-key'),
  /**
   * The window can answer: its listeners below are in place. `hears` says
   * the one for hear_the_music is among them; a window that does not say so
   * is never asked to hear.
   */
  studioAgentReady: (answers?: { hears: boolean }): Promise<void> =>
    ipcRenderer.invoke('studio-agent-ready', answers),
  /** The project the member's AI is looking at, by its Studio id. */
  onStudioAgentShow: (listener: (projectId: string) => void) => {
    const wrapped = (_event: IpcRendererEvent, projectId: unknown) => {
      if (typeof projectId === 'string') {
        listener(projectId);
      }
    };
    ipcRenderer.on('studio-agent-show', wrapped);
    return () => {
      ipcRenderer.removeListener('studio-agent-show', wrapped);
    };
  },
  onStudioAgentDraw: (listener: (ask: IStudioAgentDrawAsk) => void) => {
    const wrapped = (_event: IpcRendererEvent, ask: IStudioAgentDrawAsk) =>
      listener(ask);
    ipcRenderer.on('studio-agent-draw', wrapped);
    return () => {
      ipcRenderer.removeListener('studio-agent-draw', wrapped);
    };
  },
  studioAgentDrawn: (id: number, answer: TStudioAgentDrawAnswer) =>
    ipcRenderer.invoke('studio-agent-drawn', id, answer) as Promise<void>,
  onStudioAgentHear: (listener: (ask: IStudioAgentHearAsk) => void) => {
    const wrapped = (_event: IpcRendererEvent, ask: IStudioAgentHearAsk) =>
      listener(ask);
    ipcRenderer.on('studio-agent-hear', wrapped);
    return () => {
      ipcRenderer.removeListener('studio-agent-hear', wrapped);
    };
  },
  studioAgentHeard: (id: number, answer: TStudioAgentHeardAnswer) =>
    ipcRenderer.invoke('studio-agent-heard', id, answer) as Promise<void>,
};
