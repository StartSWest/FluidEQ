/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { useEffect, useSyncExternalStore } from 'react';

/**
 * The message being written in the Studio's chat, one per project, as the
 * window holds it (Ivan, 2026-10-26: "the app restarted and I lost the
 * message — save it per scene"). Main keeps each on disk until it is sent
 * (`main/studioChat/chatDraft.ts`); here it is held outside the pane, so
 * folding the pane, opening another scene and coming back, or the narrow
 * window's tab standing in for the pane all show the same words.
 *
 * Every change goes to main as it is made. A project is asked for its kept
 * draft the first time it is shown; if the member has already typed or
 * attached something by the time the answer comes, what they did wins.
 */

export interface IChatDraft {
  text: string;
  /** The stage's picture going with the message, marks and all. */
  stage?: Uint8Array;
}

interface IHeldDraft extends IChatDraft {
  /** Changed in this window since the project was first shown. */
  touched: boolean;
}

const EMPTY: IHeldDraft = { text: '', touched: false };
const drafts = new Map<string, IHeldDraft>();
const listeners = new Set<() => void>();

const bridge = () => window.electron?.ipcRenderer;

const notify = () => listeners.forEach((listener) => listener());

/** Asks main for a project's kept draft, once a window. */
export const loadChatDraft = (projectId: string) => {
  if (drafts.has(projectId)) {
    return;
  }
  drafts.set(projectId, EMPTY);
  bridge()
    ?.studioChatDraft?.(projectId)
    .then((kept) => {
      const now = drafts.get(projectId);
      if (kept && now && !now.touched) {
        drafts.set(projectId, {
          text: kept.text,
          ...(kept.stage ? { stage: kept.stage } : {}),
          touched: false,
        });
        notify();
      }
      return undefined;
    })
    .catch(() => undefined);
};

const change = (projectId: string, next: Partial<IChatDraft>) => {
  const now = drafts.get(projectId) ?? EMPTY;
  const held: IHeldDraft = { ...now, ...next, touched: true };
  if (!held.stage) {
    delete held.stage;
  }
  drafts.set(projectId, held);
  notify();
};

export const setChatDraftText = (projectId: string, text: string) => {
  change(projectId, { text });
  bridge()
    ?.studioChatDraftChange?.({ projectId, text })
    .catch(() => undefined);
};

export const setChatDraftStage = (projectId: string, stage?: Uint8Array) => {
  change(projectId, { stage });
  bridge()
    ?.studioChatDraftChange?.({ projectId, stage: stage ?? null })
    .catch(() => undefined);
};

/** A project taken off the Studio's list takes its draft with it. */
export const forgetChatDraft = (projectId: string) => {
  drafts.set(projectId, { ...EMPTY, touched: true });
  notify();
  bridge()
    ?.studioChatDraftChange?.({ projectId, text: '', stage: null })
    .catch(() => undefined);
};

const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};

/** The project's message box, asked of main the first time it is shown. */
export const useChatDraft = (projectId: string | undefined): IChatDraft => {
  useEffect(() => {
    if (projectId) {
      loadChatDraft(projectId);
    }
  }, [projectId]);
  const snapshot = () =>
    (projectId ? drafts.get(projectId) : undefined) ?? EMPTY;
  return useSyncExternalStore(subscribe, snapshot, snapshot);
};

/** For tests: forget every draft and anyone listening, as a new window does. */
export const resetChatDrafts = () => {
  drafts.clear();
  listeners.clear();
};
