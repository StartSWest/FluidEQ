import { ipcRenderer, type IpcRendererEvent } from 'electron';
import type {
  IStudioChat,
  IStudioChatMessage,
  IStudioChatPackAsk,
  IStudioChatPast,
  TStudioChatAnswer,
  TStudioChatAsk,
  TStudioChatAvailability,
  TStudioChatCodex,
  TStudioChatEntry,
  TStudioChatPackAnswer,
  TStudioChatRestore,
} from '../common/studioChat';

/** ChatGPT's pictures as the chat's head shows them. */
export interface IStudioChatCodexState {
  codex: TStudioChatCodex;
  connected: boolean;
}

/**
 * The window's side of the Studio's chat (`studioChat/studioChat.ts`). It
 * works on the open project only: main decides which that is, and no path,
 * no process and nothing of the member's Claude account reaches the page.
 */
export const studioChatBridge = {
  studioChatAvailability: (): Promise<TStudioChatAvailability> =>
    ipcRenderer.invoke('studio-chat-availability'),
  /** Claude Code's own sign-in; settles when it has ended. */
  studioChatSignIn: (): Promise<TStudioChatAvailability> =>
    ipcRenderer.invoke('studio-chat-sign-in'),
  studioChatLoad: (): Promise<IStudioChat | undefined> =>
    ipcRenderer.invoke('studio-chat-load'),
  studioChatSend: (message: IStudioChatMessage): Promise<void> =>
    ipcRenderer.invoke('studio-chat-send', message),
  studioChatStop: (): Promise<void> => ipcRenderer.invoke('studio-chat-stop'),
  studioChatNew: (): Promise<IStudioChat | undefined> =>
    ipcRenderer.invoke('studio-chat-new'),
  studioChatRestore: (entryId: string): Promise<TStudioChatRestore> =>
    ipcRenderer.invoke('studio-chat-restore', entryId),
  /** The open project's earlier chats, newest first. */
  studioChatPast: (): Promise<IStudioChatPast[]> =>
    ipcRenderer.invoke('studio-chat-past'),
  /** An earlier chat opened in place of the open one, which is kept. */
  studioChatOpenPast: (id: string): Promise<IStudioChat | undefined> =>
    ipcRenderer.invoke('studio-chat-open-past', id),
  studioChatDeletePast: (id: string): Promise<IStudioChatPast[]> =>
    ipcRenderer.invoke('studio-chat-delete-past', id),
  /** The member's answer to a card the chat put up. */
  studioChatAnswer: (id: string, answer: TStudioChatAnswer): Promise<void> =>
    ipcRenderer.invoke('studio-chat-answer', id, answer),
  studioChatCodex: (): Promise<IStudioChatCodexState | undefined> =>
    ipcRenderer.invoke('studio-chat-codex'),
  /** Codex's own sign-in; settles when it has ended. */
  studioChatCodexSignIn: (): Promise<IStudioChatCodexState | undefined> =>
    ipcRenderer.invoke('studio-chat-codex-sign-in'),
  studioChatCodexDisconnect: (): Promise<IStudioChatCodexState | undefined> =>
    ipcRenderer.invoke('studio-chat-codex-disconnect'),
  /** The artwork main asked for, as WebP, or why there is none. */
  studioChatPacked: (
    id: number,
    answer: TStudioChatPackAnswer,
  ): Promise<void> => ipcRenderer.invoke('studio-chat-packed', id, answer),
  onStudioChatAsk: (
    listener: (change: { projectId: string; ask?: TStudioChatAsk }) => void,
  ) => {
    const wrapped = (
      _event: IpcRendererEvent,
      change: { projectId: string; ask?: TStudioChatAsk },
    ) => listener(change);
    ipcRenderer.on('studio-chat-ask', wrapped);
    return () => {
      ipcRenderer.removeListener('studio-chat-ask', wrapped);
    };
  },
  onStudioChatPack: (listener: (ask: IStudioChatPackAsk) => void) => {
    const wrapped = (_event: IpcRendererEvent, ask: IStudioChatPackAsk) =>
      listener(ask);
    ipcRenderer.on('studio-chat-pack', wrapped);
    return () => {
      ipcRenderer.removeListener('studio-chat-pack', wrapped);
    };
  },
  onStudioChatEntry: (
    listener: (change: {
      projectId: string;
      entry: TStudioChatEntry;
      busy: boolean;
    }) => void,
  ) => {
    const wrapped = (
      _event: IpcRendererEvent,
      change: { projectId: string; entry: TStudioChatEntry; busy: boolean },
    ) => listener(change);
    ipcRenderer.on('studio-chat-entry', wrapped);
    return () => {
      ipcRenderer.removeListener('studio-chat-entry', wrapped);
    };
  },
};
