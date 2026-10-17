import { ipcRenderer, type IpcRendererEvent } from 'electron';
import type {
  IStudioChat,
  IStudioChatCompact,
  IStudioChatContext,
  IStudioChatLimits,
  IStudioChatMessage,
  IStudioChatPackAsk,
  IStudioChatCodexState,
  IStudioChatPast,
  IStudioChatQueued,
  TStudioChatAnswer,
  TStudioChatAsk,
  TStudioChatAvailability,
  TStudioChatEntry,
  TStudioChatPackAnswer,
  TStudioChatRestore,
} from '../common/studioChat';

/**
 * The window's side of the Studio's chat (`studioChat/studioChat.ts`). It
 * works on the open project only: main decides which that is, and no path,
 * no process and nothing of the member's Claude account reaches the page.
 */
const studioChatBridge = {
  studioChatAvailability: (): Promise<TStudioChatAvailability> =>
    ipcRenderer.invoke('studio-chat-availability'),
  /** Claude Code's own sign-in; settles when it has ended. */
  studioChatSignIn: (): Promise<TStudioChatAvailability> =>
    ipcRenderer.invoke('studio-chat-sign-in'),
  studioChatLoad: (): Promise<IStudioChat | undefined> =>
    ipcRenderer.invoke('studio-chat-load'),
  studioChatSend: (message: IStudioChatMessage): Promise<void> =>
    ipcRenderer.invoke('studio-chat-send', message),
  /** Claude Code's /compact, on the member's picks. */
  studioChatCompact: (picks: IStudioChatCompact): Promise<void> =>
    ipcRenderer.invoke('studio-chat-compact', picks),
  /** The failed reply at the end of the chat, answered again in its place. */
  studioChatRetry: (picks: IStudioChatCompact): Promise<void> =>
    ipcRenderer.invoke('studio-chat-retry', picks),
  studioChatStop: (): Promise<void> => ipcRenderer.invoke('studio-chat-stop'),
  /** A queued message taken back before it went. */
  studioChatUnqueue: (id: string): Promise<void> =>
    ipcRenderer.invoke('studio-chat-unqueue', id),
  onStudioChatQueue: (
    listener: (change: {
      projectId: string;
      queued: IStudioChatQueued[];
    }) => void,
  ) => {
    const wrapped = (
      _event: IpcRendererEvent,
      change: { projectId: string; queued: IStudioChatQueued[] },
    ) => listener(change);
    ipcRenderer.on('studio-chat-queue', wrapped);
    return () => {
      ipcRenderer.removeListener('studio-chat-queue', wrapped);
    };
  },
  /** How full a project's context window is, after each message Claude writes. */
  onStudioChatContext: (
    listener: (change: {
      projectId: string;
      context: IStudioChatContext;
    }) => void,
  ) => {
    const wrapped = (
      _event: IpcRendererEvent,
      change: { projectId: string; context: IStudioChatContext },
    ) => listener(change);
    ipcRenderer.on('studio-chat-context', wrapped);
    return () => {
      ipcRenderer.removeListener('studio-chat-context', wrapped);
    };
  },
  /** The plan's limits as Claude Code last reported them, if ever. */
  studioChatLimits: (): Promise<IStudioChatLimits | undefined> =>
    ipcRenderer.invoke('studio-chat-limits'),
  onStudioChatLimits: (listener: (limits: IStudioChatLimits) => void) => {
    const wrapped = (_event: IpcRendererEvent, limits: IStudioChatLimits) =>
      listener(limits);
    ipcRenderer.on('studio-chat-limits', wrapped);
    return () => {
      ipcRenderer.removeListener('studio-chat-limits', wrapped);
    };
  },
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

export default studioChatBridge;
